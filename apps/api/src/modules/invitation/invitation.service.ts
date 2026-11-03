import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { TenantPlanService } from '../../common/services/tenant-plan.service';
import { assertAssignableRole } from '../../common/utils/member-governance';
import { appUrl } from '../../common/utils/app-url';
import { EmailService } from '../email/email.service';
import { transactionalEmail } from '../email/email-layout';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { AcceptInvitationDto, CreateInvitationDto, NEW_PASSWORD_RULE } from './dto/invitation.dto';

const INVITE_DAYS = 7;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

type InvitationStatus = 'pending' | 'expired' | 'accepted' | 'revoked';

/**
 * Convite para entrar numa empresa. O link carrega um token aleatorio (so o hash fica
 * no banco). Sem provedor de e-mail configurado, o convite continua valendo: a tela
 * mostra o link para o admin copiar e mandar por outro canal.
 */
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPlan: TenantPlanService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  // ── Administracao ───────────────────────────────────────────────────────

  async list(currentUser: CurrentUser) {
    const rows = await this.prisma.invitation.findMany({
      where: { tenantId: currentUser.tenantId, acceptedAt: null, revokedAt: null },
      select: {
        id: true, email: true, name: true, expiresAt: true, createdAt: true,
        customRole: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    return rows.map((r) => ({ ...r, expired: r.expiresAt < now }));
  }

  async create(currentUser: CurrentUser, dto: CreateInvitationDto) {
    const tenantId = currentUser.tenantId;
    const email = dto.email.trim().toLowerCase();
    await assertAssignableRole(this.prisma, currentUser, dto.customRoleId);

    const member = await this.prisma.userTenantAccess.findFirst({
      where: { tenantId, deletedAt: null, status: Status.ACTIVE, user: { email, deletedAt: null } },
      select: { id: true },
    });
    if (member) throw new ConflictException('Esta pessoa ja faz parte da empresa');
    await this.tenantPlan.assertCanAddUsers(tenantId);

    // Um convite valido por e-mail: o novo substitui os anteriores.
    await this.prisma.invitation.updateMany({
      where: { tenantId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const token = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId,
        email,
        name: dto.name?.trim() || null,
        customRoleId: dto.customRoleId,
        tokenHash: hashToken(token),
        invitedById: currentUser.id,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
      },
      select: { id: true, email: true, customRole: { select: { name: true } } },
    });

    this.audit.log(currentUser, {
      action: 'create',
      resource: 'invitation',
      resourceId: invitation.id,
      newData: { email, role: invitation.customRole.name },
    }).catch(() => {});

    return { id: invitation.id, email, ...(await this.deliver(currentUser, invitation.id, token)) };
  }

  /** Gera um link novo (o antigo deixa de valer) e reenvia o e-mail. */
  async resend(currentUser: CurrentUser, id: string) {
    const invitation = await this.findPending(currentUser.tenantId, id);
    await assertAssignableRole(this.prisma, currentUser, invitation.customRoleId);
    const token = randomBytes(32).toString('base64url');
    await this.prisma.invitation.update({
      where: { id },
      data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) },
    });
    return { id, email: invitation.email, ...(await this.deliver(currentUser, id, token)) };
  }

  async revoke(currentUser: CurrentUser, id: string) {
    await this.findPending(currentUser.tenantId, id);
    await this.prisma.invitation.update({ where: { id }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  // ── Publico (quem recebeu o link) ───────────────────────────────────────

  async publicInfo(token: string) {
    const invitation = await this.loadByToken(token);
    const account = await this.prisma.user.findFirst({
      where: { email: invitation.email, deletedAt: null },
      select: { id: true },
    });
    return {
      status: this.statusOf(invitation),
      email: invitation.email,
      name: invitation.name,
      company: invitation.tenant.name,
      role: invitation.customRole.name,
      invitedBy: invitation.invitedBy?.name ?? null,
      accountExists: !!account,
    };
  }

  async accept(token: string, dto: AcceptInvitationDto) {
    const invitation = await this.loadByToken(token);
    const status = this.statusOf(invitation);
    if (status === 'accepted') throw new ConflictException('Este convite ja foi usado');
    if (status !== 'pending') throw new GoneException('Este convite expirou ou foi cancelado. Peca um novo ao administrador.');
    if (invitation.tenant.status !== Status.ACTIVE) {
      throw new ForbiddenException({ code: 'TENANT_SUSPENDED', message: 'O acesso desta empresa esta suspenso' });
    }

    const user = await this.prisma.user.findFirst({
      where: { email: invitation.email, deletedAt: null },
      select: { id: true, password: true, status: true },
    });
    if (user) {
      // Quem ja tem conta confirma com a propria senha (o link sozinho nao basta).
      if (user.status !== Status.ACTIVE || !user.password || !(await bcrypt.compare(dto.password, user.password))) {
        throw new UnauthorizedException('Senha incorreta');
      }
    } else {
      if (!dto.name?.trim()) throw new BadRequestException('Informe seu nome');
      if (!NEW_PASSWORD_RULE.test(dto.password)) {
        throw new BadRequestException('Senha deve ter 8+ caracteres, com maiuscula, minuscula e numero');
      }
    }

    const current = user
      ? await this.prisma.userTenantAccess.findUnique({
          where: { userId_tenantId: { userId: user.id, tenantId: invitation.tenantId } },
          select: { status: true, deletedAt: true },
        })
      : null;
    if (!current || current.status !== Status.ACTIVE || current.deletedAt) {
      await this.tenantPlan.assertCanAddUsers(invitation.tenantId);
    }

    const userId = await this.prisma.$transaction(async (tx) => {
      const id = user
        ? user.id
        : (await tx.user.create({
            data: {
              email: invitation.email,
              name: dto.name!.trim(),
              password: await bcrypt.hash(dto.password, 12),
              status: Status.ACTIVE,
            },
            select: { id: true },
          })).id;
      const hasPrimary = await tx.userTenantAccess.count({ where: { userId: id, isPrimary: true, deletedAt: null } });
      await tx.userTenantAccess.upsert({
        where: { userId_tenantId: { userId: id, tenantId: invitation.tenantId } },
        update: { customRoleId: invitation.customRoleId, status: Status.ACTIVE, deletedAt: null, grantedById: invitation.invitedById },
        create: {
          userId: id,
          tenantId: invitation.tenantId,
          customRoleId: invitation.customRoleId,
          status: Status.ACTIVE,
          isPrimary: hasPrimary === 0,
          grantedById: invitation.invitedById,
        },
      });
      await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      return id;
    });

    this.tenantPlan.invalidate(invitation.tenantId);
    this.logger.log(`Convite aceito: ${invitation.email} -> ${invitation.tenant.name}`);
    // Ja entra na empresa que convidou (mesmo que a pessoa tenha outras).
    return this.auth.switchTenant(userId, invitation.tenantId);
  }

  // ── Interno ─────────────────────────────────────────────────────────────

  private async deliver(currentUser: CurrentUser, id: string, token: string) {
    const invitation = await this.prisma.invitation.findUniqueOrThrow({
      where: { id },
      select: { email: true, name: true, tenant: { select: { name: true } }, customRole: { select: { name: true } } },
    });
    const link = `${appUrl()}/pt-BR/invite/${token}`;
    const { html, text } = transactionalEmail({
      title: `Convite para ${invitation.tenant.name}`,
      paragraphs: [
        `Olá${invitation.name ? `, ${invitation.name}` : ''}!`,
        `${currentUser.name} convidou você para entrar na ${invitation.tenant.name} como ${invitation.customRole.name}.`,
        `O convite vale por ${INVITE_DAYS} dias.`,
      ],
      buttonLabel: 'Aceitar convite',
      url: link,
      footer: 'Se você não esperava este convite, pode ignorar este e-mail.',
    });
    const result = await this.email.send({ to: invitation.email, subject: `Convite para ${invitation.tenant.name}`, html, text });
    return { link, emailSent: result.sent };
  }

  private async findPending(tenantId: string, id: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, tenantId, acceptedAt: null, revokedAt: null },
      select: { id: true, email: true, customRoleId: true },
    });
    if (!invitation) throw new NotFoundException('Convite nao encontrado');
    return invitation;
  }

  private async loadByToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true, email: true, name: true, tenantId: true, customRoleId: true, invitedById: true,
        expiresAt: true, acceptedAt: true, revokedAt: true,
        tenant: { select: { name: true, status: true } },
        customRole: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
    });
    if (!invitation) throw new NotFoundException('Convite invalido');
    return invitation;
  }

  private statusOf(i: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }): InvitationStatus {
    if (i.acceptedAt) return 'accepted';
    if (i.revokedAt) return 'revoked';
    return i.expiresAt < new Date() ? 'expired' : 'pending';
  }
}
