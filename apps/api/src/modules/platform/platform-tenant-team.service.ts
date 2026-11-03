import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPlanService } from '../../common/services/tenant-plan.service';
import { hasFullTenantAccess } from '../../common/utils/platform-access';
import { TenantCopyService } from '../tenant/tenant-copy.service';
import { CopyTenantDataDto } from '../tenant/dto/copy-tenant-data.dto';
import { PlatformTenantAddMemberDto } from './dto/platform.dto';
import { PlatformAuditService } from './platform-audit.service';
import type { PlatformStaffPrincipal } from './platform-permissions';

/**
 * Equipe e estrutura de um cliente vistas pelo console: dono, cargos, membros
 * de outras empresas e copia de dados entre empresas. O que antes so o
 * "Super Admin" de dentro de um tenant fazia, agora so a equipe da plataforma faz.
 */
@Injectable()
export class PlatformTenantTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPlan: TenantPlanService,
    private readonly tenantCopy: TenantCopyService,
    private readonly audit: PlatformAuditService,
  ) {}

  // ── Cargos ──────────────────────────────────────────────────────────────

  async findRoles(tenantId: string) {
    await this.assertTenant(tenantId);
    const roles = await this.prisma.customRole.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        rank: true,
        isDefault: true,
        modulePermissions: true,
        _count: { select: { tenantAccessUsers: { where: { deletedAt: null } }, publicLinks: true } },
      },
      orderBy: [{ rank: 'asc' }, { name: 'asc' }],
    });
    return roles.map(({ modulePermissions, _count, ...role }) => ({
      ...role,
      fullAccess: hasFullTenantAccess(modulePermissions),
      members: _count.tenantAccessUsers,
      publicLinks: _count.publicLinks,
    }));
  }

  /** Remove cargo sem uso (sem membros, sem link publico e que nao e o padrao). */
  async deleteUnusedRole(actor: PlatformStaffPrincipal, tenantId: string, roleId: string) {
    const role = (await this.findRoles(tenantId)).find((r) => r.id === roleId);
    if (!role) throw new NotFoundException('Cargo nao encontrado');
    if (role.members > 0 || role.publicLinks > 0) {
      throw new ConflictException('Cargo em uso: so e possivel remover cargos sem membros e sem links publicos');
    }
    if (role.isDefault) {
      throw new ConflictException('Este e o cargo padrao de novos usuarios; escolha outro padrao antes');
    }
    await this.prisma.customRole.update({ where: { id: roleId }, data: { deletedAt: new Date() } });
    await this.audit.log(actor, {
      action: 'tenant.role_deleted',
      targetType: 'role',
      targetId: roleId,
      tenantId,
      metadata: { name: role.name },
    });
    return { success: true };
  }

  // ── Dono ────────────────────────────────────────────────────────────────

  async setOwner(actor: PlatformStaffPrincipal, tenantId: string, userId: string) {
    const tenant = await this.assertTenant(tenantId);
    const membership = await this.prisma.userTenantAccess.findFirst({
      where: { tenantId, userId, deletedAt: null, status: Status.ACTIVE, user: { deletedAt: null, status: Status.ACTIVE } },
      select: { customRole: { select: { modulePermissions: true } }, user: { select: { name: true, email: true } } },
    });
    if (!membership) throw new BadRequestException('O novo dono precisa ser um membro ativo da empresa');
    if (!hasFullTenantAccess(membership.customRole.modulePermissions)) {
      throw new BadRequestException('O dono precisa estar num cargo com acesso total (ex.: Administrador)');
    }
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { ownerId: userId } });
    await this.audit.log(actor, {
      action: 'tenant.owner_changed',
      targetType: 'tenant',
      targetId: tenantId,
      tenantId,
      metadata: { from: tenant.ownerId, to: userId, email: membership.user.email },
    });
    return { ownerId: userId };
  }

  // ── Membros ─────────────────────────────────────────────────────────────

  /** Da acesso a um usuario que ja existe (ex.: colaborador de outra empresa). */
  async addMember(actor: PlatformStaffPrincipal, tenantId: string, dto: PlatformTenantAddMemberDto) {
    await this.assertTenant(tenantId);
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, tenantAccess: { where: { deletedAt: null }, select: { tenantId: true, status: true, isPrimary: true } } },
    });
    if (!user) throw new NotFoundException('Nenhum usuario com esse e-mail; crie o usuario dentro da empresa');
    const role = await this.prisma.customRole.findFirst({
      where: { id: dto.customRoleId, tenantId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!role) throw new BadRequestException('Cargo nao pertence a esta empresa');

    const current = user.tenantAccess.find((a) => a.tenantId === tenantId);
    if (current?.status !== Status.ACTIVE) await this.tenantPlan.assertCanAddUsers(tenantId);

    await this.prisma.userTenantAccess.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId } },
      update: { customRoleId: role.id, status: Status.ACTIVE, deletedAt: null },
      create: {
        userId: user.id,
        tenantId,
        customRoleId: role.id,
        status: Status.ACTIVE,
        isPrimary: !user.tenantAccess.some((a) => a.isPrimary),
      },
    });
    await this.audit.log(actor, {
      action: 'tenant.member_added',
      targetType: 'user',
      targetId: user.id,
      tenantId,
      metadata: { email, role: role.name },
    });
    return { success: true };
  }

  // ── Copia de dados entre empresas ───────────────────────────────────────

  async getCopyableData(tenantId: string) {
    await this.assertTenant(tenantId);
    return this.tenantCopy.getCopyableData(tenantId);
  }

  async copyData(actor: PlatformStaffPrincipal, dto: CopyTenantDataDto) {
    if (dto.sourceTenantId === dto.targetTenantId) {
      throw new BadRequestException('Origem e destino precisam ser empresas diferentes');
    }
    await Promise.all([this.assertTenant(dto.sourceTenantId), this.assertTenant(dto.targetTenantId)]);
    const result = await this.tenantCopy.executeCopy(dto);
    await this.audit.log(actor, {
      action: 'tenant.data_copied',
      targetType: 'tenant',
      targetId: dto.targetTenantId,
      tenantId: dto.targetTenantId,
      metadata: { sourceTenantId: dto.sourceTenantId, copied: result.copied, skipped: result.skipped.length },
    });
    return result;
  }

  private async assertTenant(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, ownerId: true },
    });
    if (!tenant) throw new NotFoundException('Tenant nao encontrado');
    return tenant;
  }
}
