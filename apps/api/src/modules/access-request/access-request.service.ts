import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { TenantPlanService } from '../../common/services/tenant-plan.service';
import { assertAssignableRole } from '../../common/utils/member-governance';
import { assertPasswordPolicy } from '../../common/utils/password-policy';
import { tenantIdForHost } from '../../common/utils/custom-domain';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

const GENERIC_OK = 'Pedido enviado! Você recebe acesso assim que a administração da empresa aprovar.';

/**
 * Pedido de acesso pelo dominio proprio da empresa: a pessoa cria o pedido (nome,
 * e-mail, senha) e um administrador aprova escolhendo o cargo, ou recusa. Ninguem
 * entra sozinho. Resposta publica e sempre a mesma (nao revela quem ja tem conta).
 */
@Injectable()
export class AccessRequestService {
  private readonly logger = new Logger(AccessRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPlan: TenantPlanService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  // ── Publico ────────────────────────────────────────────────────────────

  async request(host: string, dto: { name: string; email: string; password: string }, ip?: string) {
    const tenantId = await tenantIdForHost(this.prisma, host);
    if (!tenantId) throw new BadRequestException('Peça acesso pelo endereço da empresa.');
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
    if (!tenant || tenant.status !== Status.ACTIVE) throw new BadRequestException('Esta empresa não está recebendo pedidos agora.');

    const name = dto.name.trim().slice(0, 120);
    const email = dto.email.trim().toLowerCase();
    await assertPasswordPolicy(this.prisma, [tenantId], dto.password);

    // Ja faz parte da empresa: nada a pedir (mesma resposta, para nao revelar)
    const member = await this.prisma.userTenantAccess.findFirst({
      where: { tenantId, deletedAt: null, status: Status.ACTIVE, user: { email, deletedAt: null } },
      select: { id: true },
    });
    if (member) return { ok: true, message: GENERIC_OK };

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const pending = await this.prisma.accessRequest.findFirst({ where: { tenantId, email, status: 'pending' } });
    const saved = pending
      ? await this.prisma.accessRequest.update({ where: { id: pending.id }, data: { name, passwordHash, ip } })
      : await this.prisma.accessRequest.create({ data: { tenantId, name, email, passwordHash, ip } });
    if (!pending) await this.notifyAdmins(tenantId, saved.name, saved.email);
    return { ok: true, message: GENERIC_OK };
  }

  /** Avisa quem pode cadastrar pessoas (acesso total ou Usuários: criar). */
  private async notifyAdmins(tenantId: string, name: string, email: string) {
    const members = await this.prisma.userTenantAccess.findMany({
      where: { tenantId, deletedAt: null, status: Status.ACTIVE },
      select: { userId: true, customRole: { select: { modulePermissions: true } } },
    });
    const admins = members.filter((m) => {
      const mp = (m.customRole?.modulePermissions || {}) as { allAccess?: boolean; users?: { canCreate?: boolean } };
      return mp.allAccess || mp.users?.canCreate;
    });
    await Promise.all(admins.map((a) => this.notifications.notifyUser(a.userId, {
      type: 'info',
      title: 'Pedido de acesso',
      message: `${name} (${email}) pediu acesso à empresa. Aprove ou recuse em Administração › Usuários.`,
      data: { kind: 'access-request', email },
    }, tenantId).catch((err) => this.logger.warn(`Aviso de pedido de acesso falhou: ${(err as Error).message}`))));
  }

  // ── Administracao ──────────────────────────────────────────────────────

  async list(currentUser: CurrentUser) {
    return this.prisma.accessRequest.findMany({
      where: { tenantId: currentUser.tenantId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async approve(currentUser: CurrentUser, id: string, customRoleId: string) {
    const tenantId = currentUser.tenantId;
    const req = await this.prisma.accessRequest.findFirst({ where: { id, tenantId, status: 'pending' } });
    if (!req) throw new NotFoundException('Pedido não encontrado');
    await assertAssignableRole(this.prisma, currentUser, customRoleId);
    await this.tenantPlan.assertCanAddUsers(tenantId);

    const existing = await this.prisma.user.findFirst({ where: { email: req.email, deletedAt: null } });
    let userId: string;
    if (existing) {
      // Ja tem conta no CRM Builder (outra empresa): entra com a senha que ja usa
      const already = await this.prisma.userTenantAccess.findFirst({ where: { userId: existing.id, tenantId, deletedAt: null, status: Status.ACTIVE } });
      if (already) throw new ConflictException('Esta pessoa já faz parte da empresa.');
      const hasPrimary = await this.prisma.userTenantAccess.count({ where: { userId: existing.id, isPrimary: true, deletedAt: null } });
      await this.prisma.userTenantAccess.upsert({
        where: { userId_tenantId: { userId: existing.id, tenantId } },
        update: { customRoleId, status: 'ACTIVE', deletedAt: null },
        create: { userId: existing.id, tenantId, customRoleId, status: 'ACTIVE', isPrimary: !hasPrimary },
      });
      userId = existing.id;
    } else {
      const user = await this.prisma.user.create({ data: { name: req.name, email: req.email, password: req.passwordHash } });
      await this.prisma.userTenantAccess.create({ data: { userId: user.id, tenantId, customRoleId, status: 'ACTIVE', isPrimary: true } });
      userId = user.id;
    }
    await this.prisma.accessRequest.update({
      where: { id }, data: { status: 'approved', customRoleId, decidedById: currentUser.id, decidedAt: new Date() },
    });
    this.tenantPlan.invalidate(tenantId);
    await this.audit.log(currentUser, { action: 'create', resource: 'user', resourceId: userId, newData: { email: req.email, customRoleId, via: 'pedido de acesso' } }).catch(() => undefined);
    return { ok: true, userId, existingAccount: !!existing };
  }

  async reject(currentUser: CurrentUser, id: string) {
    const req = await this.prisma.accessRequest.findFirst({ where: { id, tenantId: currentUser.tenantId, status: 'pending' } });
    if (!req) throw new NotFoundException('Pedido não encontrado');
    await this.prisma.accessRequest.update({ where: { id }, data: { status: 'rejected', decidedById: currentUser.id, decidedAt: new Date() } });
    return { ok: true };
  }
}
