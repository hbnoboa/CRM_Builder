import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/user.dto';
import { Prisma, Status } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  CurrentUser,
  createPaginationMeta,
  encodeCursor,
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { TenantPlanService } from '../../common/services/tenant-plan.service';
import { assertAssignableRole, loadManagedMember } from '../../common/utils/member-governance';
import { assertPasswordPolicy } from '../../common/utils/password-policy';

// Identidade global (#10): "usuarios de um tenant" = usuarios COM membership nele.
// O cargo exibido e o da membership naquele tenant.
const ROLE_PREVIEW = { id: true, name: true, color: true, isSystem: true, rank: true, modulePermissions: true } as const;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private auditService: AuditService,
    private tenantPlan: TenantPlanService,
  ) {}

  /** Achata user + membership do tenant num shape compativel com o frontend. */
  private flatten(
    user: Record<string, unknown> & { tenantAccess?: Array<{ tenantId: string; customRoleId: string; customRole: unknown; tenant?: unknown }> },
  ): Record<string, unknown> {
    const { tenantAccess, teamMemberships, ...rest } = user as typeof user & {
      teamMemberships?: Array<{ isLeader: boolean; team: { id: string; name: string; color: string | null } }>;
    };
    const m = tenantAccess?.[0];
    return {
      ...rest,
      ...(teamMemberships ? { teams: teamMemberships.map((t) => ({ ...t.team, isLeader: t.isLeader })) } : {}),
      tenantId: m?.tenantId ?? null,
      customRoleId: m?.customRoleId ?? null,
      customRole: m?.customRole ?? null,
      ...(m?.tenant ? { tenant: m.tenant } : {}),
    };
  }

  async create(dto: CreateUserDto, currentUser: CurrentUser) {
    const targetTenantId = getEffectiveTenantId(currentUser);
    await assertAssignableRole(this.prisma, currentUser, dto.customRoleId);
    await this.tenantPlan.assertCanAddUsers(targetTenantId);

    // Email agora e identidade GLOBAL.
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email ja esta em uso');
    }

    await assertPasswordPolicy(this.prisma, [targetTenantId], dto.password);
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const { customRoleId, ...userData } = dto;
    if (userData.cpf) userData.cpf = userData.cpf.replace(/\D/g, '') || undefined;
    if (userData.cnpj) userData.cnpj = userData.cnpj.replace(/\D/g, '') || undefined;
    if (userData.phone) userData.phone = userData.phone.replace(/\D/g, '') || undefined;

    // Cria a identidade (sem tenant/cargo).
    const newUser = await this.prisma.user.create({
      data: { ...userData, password: hashedPassword },
      select: {
        id: true, email: true, name: true, avatar: true,
        cpf: true, cnpj: true, phone: true, status: true, createdAt: true,
      },
    });

    // Membership home (primaria) — fonte da verdade do vinculo + cargo.
    const membership = await this.prisma.userTenantAccess.upsert({
      where: { userId_tenantId: { userId: newUser.id, tenantId: targetTenantId } },
      update: { customRoleId, status: 'ACTIVE', deletedAt: null, isPrimary: true },
      create: { userId: newUser.id, tenantId: targetTenantId, customRoleId, status: 'ACTIVE', isPrimary: true },
      include: { customRole: { select: ROLE_PREVIEW } },
    });

    this.notificationService.notifyNewUser(targetTenantId, newUser.name, currentUser.name)
      .catch((err) => this.logger.error('Failed to send notification', err));

    this.auditService.log(currentUser, {
      action: 'create',
      resource: 'user',
      resourceId: newUser.id,
      newData: { email: dto.email, name: dto.name, customRoleId },
    }).catch(() => {});

    return {
      ...newUser,
      tenantId: targetTenantId,
      customRoleId,
      customRole: membership.customRole,
    };
  }

  async findAll(query: QueryUserDto, currentUser: CurrentUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;
    const { search, role, status, cursor, teamId, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    // Lista sempre escopada ao tenant ativo do usuario.
    const effectiveTenantId = getEffectiveTenantId(currentUser);

    const membershipFilter: Prisma.UserTenantAccessWhereInput = {
      tenantId: effectiveTenantId,
      deletedAt: null,
      status: 'ACTIVE',
    };
    // Filtro por cargo agora e por id do cargo (roleType removido).
    if (role) membershipFilter.customRoleId = role;

    // Usuario tecnico de chave de API nao faz parte da equipe.
    const where: Prisma.UserWhereInput = { tenantAccess: { some: membershipFilter }, isServiceAccount: false };
    if (status) where.status = status;
    if (teamId) where.teamMemberships = { some: { teamId, team: { tenantId: effectiveTenantId } } };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const useCursor = !!cursor;
    let cursorClause: { id: string } | undefined;
    if (useCursor) {
      const decodedCursor = decodeCursor(cursor);
      if (decodedCursor) cursorClause = { id: decodedCursor.id };
    }

    const orderBy: Prisma.UserOrderByWithRelationInput[] = [{ [sortBy]: sortOrder }];
    if (sortBy !== 'id') orderBy.push({ id: sortOrder });

    const takeWithExtra = limit + 1;
    const findManyArgs: Prisma.UserFindManyArgs = {
      where,
      take: takeWithExtra,
      orderBy,
      select: {
        id: true, email: true, name: true, avatar: true,
        cpf: true, cnpj: true, phone: true, status: true, lastLoginAt: true, createdAt: true,
        tenantAccess: {
          where: { tenantId: effectiveTenantId },
          take: 1,
          select: {
            tenantId: true,
            customRoleId: true,
            customRole: { select: ROLE_PREVIEW },
            tenant: { select: { id: true, name: true, slug: true } },
          },
        },
        teamMemberships: {
          where: { team: { tenantId: effectiveTenantId } },
          select: { isLeader: true, team: { select: { id: true, name: true, color: true } } },
        },
      },
    };

    if (useCursor && cursorClause) {
      findManyArgs.cursor = cursorClause;
      findManyArgs.skip = 1;
    } else {
      findManyArgs.skip = skip;
    }

    const [rawData, total] = await Promise.all([
      this.prisma.user.findMany(findManyArgs),
      this.prisma.user.count({ where }),
    ]);

    const hasNextPage = rawData.length > limit;
    const sliced = hasNextPage ? rawData.slice(0, limit) : rawData;
    const data = sliced.map((u) => this.flatten(u as Parameters<typeof this.flatten>[0]));
    const hasPreviousPage = useCursor ? true : page > 1;

    let nextCursor: string | undefined;
    let previousCursor: string | undefined;
    if (data.length > 0) {
      const lastItem = data[data.length - 1];
      const firstItem = data[0];
      if (hasNextPage) {
        nextCursor = encodeCursor({ id: lastItem.id as string, sortField: sortBy });
      }
      if (hasPreviousPage && useCursor) {
        previousCursor = encodeCursor({ id: firstItem.id as string, sortField: sortBy });
      }
    }

    return {
      data,
      meta: createPaginationMeta(total, page, limit, {
        hasNextPage,
        hasPreviousPage,
        nextCursor,
        previousCursor,
      }),
    };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    // O usuario precisa ter membership no tenant atual.
    const where: Prisma.UserWhereInput = {
      id,
      tenantAccess: { some: { tenantId: currentUser.tenantId, deletedAt: null } },
    };

    const user = await this.prisma.user.findFirst({
      where,
      select: {
        id: true, email: true, name: true, avatar: true,
        cpf: true, cnpj: true, phone: true, status: true,
        lastLoginAt: true, createdAt: true, updatedAt: true,
        tenantAccess: {
          // Empresas de outros vinculos so aparecem para o proprio usuario.
          where: id === currentUser.id ? { deletedAt: null } : { deletedAt: null, tenantId: currentUser.tenantId },
          select: {
            tenantId: true,
            customRoleId: true,
            isPrimary: true,
            customRole: {
              select: { id: true, name: true, color: true, isSystem: true, permissions: true, modulePermissions: true },
            },
            tenant: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ isPrimary: 'desc' }],
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    // Cargo a exibir: o do tenant atual, senao o primario.
    const all = user.tenantAccess;
    const current = all.find((m) => m.tenantId === currentUser.tenantId) ?? all[0];
    const { tenantAccess, ...rest } = user;
    return {
      ...rest,
      tenantId: current?.tenantId ?? null,
      customRoleId: current?.customRoleId ?? null,
      customRole: current?.customRole ?? null,
      tenant: current?.tenant ?? null,
      tenants: all.map((m) => ({ tenantId: m.tenantId, tenant: m.tenant, customRole: m.customRole, isPrimary: m.isPrimary })),
    };
  }

  /**
   * O formulario manda cargo e situacao mesmo sem mudanca: tira o que ja esta igual,
   * para editar o proprio nome (ou o de alguem sem "atribuir cargo"/"mudar situacao")
   * nao virar tentativa de trocar cargo/situacao.
   */
  async dropUnchangedMembershipFields(id: string, dto: UpdateUserDto, currentUser: CurrentUser): Promise<void> {
    if (!dto.customRoleId && !dto.status) return;
    const membership = await this.prisma.userTenantAccess.findFirst({
      where: { userId: id, tenantId: currentUser.tenantId, deletedAt: null },
      select: { customRoleId: true, status: true, user: { select: { status: true } } },
    });
    if (!membership) return;
    if (dto.customRoleId && dto.customRoleId === membership.customRoleId) delete dto.customRoleId;
    if (dto.status) {
      const otherTenants = await this.prisma.userTenantAccess.count({
        where: { userId: id, tenantId: { not: currentUser.tenantId }, deletedAt: null },
      });
      // Membro de varias empresas: a situacao mora na membership; senao, no User.
      const current = otherTenants > 0 ? membership.status : membership.user.status;
      if (String(dto.status) === String(current)) delete dto.status;
    }
  }

  async update(id: string, dto: UpdateUserDto, currentUser: CurrentUser) {
    const oldUser = await this.findOne(id, currentUser);
    const target = await loadManagedMember(this.prisma, currentUser, id);

    if (target.isSelf && (dto.customRoleId || dto.status)) {
      throw new ForbiddenException('Voce nao pode mudar o proprio cargo ou a propria situacao');
    }
    if (!target.isSelf && target.inOtherTenants && (dto.email || dto.password)) {
      throw new ForbiddenException('Este usuario tambem acessa outras empresas: so ele pode trocar o proprio e-mail e senha');
    }
    if (dto.customRoleId) await assertAssignableRole(this.prisma, currentUser, dto.customRoleId);
    // Reativar conta conta vaga do plano (criar/convidar ja checam).
    if (dto.status === 'ACTIVE') {
      const currentStatus = target.inOtherTenants ? target.membership.status : oldUser.status;
      if (currentStatus !== 'ACTIVE') await this.tenantPlan.assertCanAddUsers(currentUser.tenantId);
    }

    if (dto.password) {
      const tenants = await this.prisma.userTenantAccess.findMany({ where: { userId: id, deletedAt: null }, select: { tenantId: true } });
      await assertPasswordPolicy(this.prisma, tenants.map((t) => t.tenantId), dto.password);
      dto.password = await bcrypt.hash(dto.password, 12);
    }
    if (dto.cpf) dto.cpf = dto.cpf.replace(/\D/g, '') || undefined;
    if (dto.cnpj) dto.cnpj = dto.cnpj.replace(/\D/g, '') || undefined;
    if (dto.phone) dto.phone = dto.phone.replace(/\D/g, '') || undefined;

    // customRoleId nao mora mais no User -> vai para a membership.
    const { customRoleId, ...userData } = dto;

    // Quem tambem e membro de outra empresa: a situacao vale so para o vinculo daqui.
    if (target.inOtherTenants && userData.status) {
      await this.prisma.userTenantAccess.update({ where: { id: target.membership.id }, data: { status: userData.status } });
      delete userData.status;
    }

    await this.prisma.user.update({ where: { id }, data: userData });

    // Cargo: atualiza a membership do tenant atual (autoritativa).
    if (customRoleId) {
      await this.prisma.userTenantAccess.upsert({
        where: { userId_tenantId: { userId: id, tenantId: currentUser.tenantId } },
        update: { customRoleId, status: 'ACTIVE', deletedAt: null },
        create: { userId: id, tenantId: currentUser.tenantId, customRoleId, status: 'ACTIVE' },
      });
    }

    this.auditService.log(currentUser, {
      action: 'update',
      resource: 'user',
      resourceId: id,
      oldData: { name: oldUser.name, email: oldUser.email, status: oldUser.status, customRoleId: oldUser.customRoleId },
      newData: { ...dto, password: undefined },
    }).catch(() => {});

    return this.findOne(id, currentUser);
  }

  // ═══════════════════════════════════════════════════════════════
  // TENANT ACCESS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async grantTenantAccess(
    currentUser: CurrentUser,
    dto: { userId: string; tenantId: string; customRoleId: string; expiresAt?: string },
  ) {
    // So concede acesso ao proprio tenant ativo.
    if (currentUser.tenantId !== dto.tenantId) {
      throw new ForbiddenException('Sem permissao para conceder acesso a este tenant');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, name: true },
    });
    if (!user) throw new NotFoundException('Usuario nao encontrado');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) throw new NotFoundException('Tenant nao encontrado');

    const role = await this.prisma.customRole.findFirst({
      where: { id: dto.customRoleId, tenantId: dto.tenantId },
      select: { id: true, name: true },
    });
    if (!role) throw new NotFoundException('Role nao encontrada neste tenant');
    await assertAssignableRole(this.prisma, currentUser, dto.customRoleId);

    // So conta no limite do plano quando o usuario ainda nao tinha acesso ativo.
    const existingAccess = await this.prisma.userTenantAccess.findUnique({
      where: { userId_tenantId: { userId: dto.userId, tenantId: dto.tenantId } },
      select: { status: true, deletedAt: true },
    });
    if (!existingAccess || existingAccess.status !== 'ACTIVE' || existingAccess.deletedAt) {
      await this.tenantPlan.assertCanAddUsers(dto.tenantId);
    }

    const access = await this.prisma.userTenantAccess.upsert({
      where: { userId_tenantId: { userId: dto.userId, tenantId: dto.tenantId } },
      create: {
        userId: dto.userId,
        tenantId: dto.tenantId,
        customRoleId: dto.customRoleId,
        grantedById: currentUser.id,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      update: {
        customRoleId: dto.customRoleId,
        status: 'ACTIVE',
        deletedAt: null,
        grantedById: currentUser.id,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        customRole: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Tenant access granted: user ${user.name} -> tenant ${tenant.name}`);
    return access;
  }

  async revokeTenantAccess(currentUser: CurrentUser, accessId: string) {
    const access = await this.prisma.userTenantAccess.findUnique({
      where: { id: accessId },
      select: { id: true, tenantId: true, userId: true, isPrimary: true },
    });

    if (!access) throw new NotFoundException('Acesso nao encontrado');

    if (currentUser.tenantId !== access.tenantId) {
      throw new ForbiddenException('Sem permissao para revogar este acesso');
    }

    if (access.isPrimary) {
      throw new ForbiddenException('Nao e possivel revogar o tenant primario (home) do usuario');
    }
    const target = await loadManagedMember(this.prisma, currentUser, access.userId);
    if (target.isSelf) throw new ForbiddenException('Voce nao pode revogar o proprio acesso');

    // Soft delete da membership (mantem historico).
    await this.prisma.userTenantAccess.delete({ where: { id: accessId } });

    this.logger.log(`Tenant access revoked: accessId ${accessId}`);
    return { message: 'Acesso revogado com sucesso' };
  }

  async listUserTenantAccess(currentUser: CurrentUser, userId: string) {
    // So ve o acesso do usuario ao tenant atual (nunca memberships em outros tenants).
    const shares = await this.prisma.userTenantAccess.findFirst({
      where: { userId, tenantId: currentUser.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!shares) throw new NotFoundException('Usuario nao encontrado');

    return this.prisma.userTenantAccess.findMany({
      where: { userId, tenantId: currentUser.tenantId },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        customRole: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    const oldUser = await this.findOne(id, currentUser);

    if (id === currentUser.id) {
      throw new ForbiddenException('Voce nao pode excluir sua propria conta');
    }
    const target = await loadManagedMember(this.prisma, currentUser, id);

    if (target.inOtherTenants) {
      // Membro de outras empresas: sai so desta (a conta continua nas outras).
      await this.prisma.userTenantAccess.delete({ where: { id: target.membership.id } });
      if (target.membership.isPrimary) {
        const next = await this.prisma.userTenantAccess.findFirst({
          where: { userId: id, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (next) await this.prisma.userTenantAccess.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    } else {
      // User esta no allowlist de soft-delete -> delete vira soft (deletedAt).
      await this.prisma.user.delete({ where: { id } });
      // O vinculo sai junto: senao a pessoa excluida segue contando no cargo.
      await this.prisma.userTenantAccess.updateMany({
        where: { userId: id, tenantId: currentUser.tenantId, deletedAt: null },
        data: { deletedAt: new Date(), status: Status.INACTIVE },
      });
    }

    this.auditService.log(currentUser, {
      action: 'delete',
      resource: 'user',
      resourceId: id,
      oldData: { name: oldUser.name, email: oldUser.email },
    }).catch(() => {});

    return { message: 'Usuario excluido com sucesso' };
  }
}
