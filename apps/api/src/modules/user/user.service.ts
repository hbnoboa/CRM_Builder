import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { hasPlatformAccess } from '../../common/utils/platform-access';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/user.dto';
import { Prisma } from '@prisma/client';
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

// Identidade global (#10): "usuarios de um tenant" = usuarios COM membership nele.
// O cargo exibido e o da membership naquele tenant.
const ROLE_PREVIEW = { id: true, name: true, color: true, isSystem: true } as const;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private auditService: AuditService,
  ) {}

  /** Achata user + membership do tenant num shape compativel com o frontend. */
  private flatten(
    user: Record<string, unknown> & { tenantAccess?: Array<{ tenantId: string; customRoleId: string; customRole: unknown; tenant?: unknown }> },
  ): Record<string, unknown> {
    const { tenantAccess, ...rest } = user;
    const m = tenantAccess?.[0];
    return {
      ...rest,
      tenantId: m?.tenantId ?? null,
      customRoleId: m?.customRoleId ?? null,
      customRole: m?.customRole ?? null,
      ...(m?.tenant ? { tenant: m.tenant } : {}),
    };
  }

  async create(dto: CreateUserDto, currentUser: CurrentUser) {
    const targetTenantId = getEffectiveTenantId(currentUser, dto.tenantId);

    // Email agora e identidade GLOBAL.
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email ja esta em uso');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const { tenantId: _t, customRoleId, ...userData } = dto;
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
    const { search, role, status, tenantId: queryTenantId, cursor, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    // Lista sempre escopada a UM tenant (o atual ou o solicitado por quem tem plataforma).
    const effectiveTenantId = getEffectiveTenantId(currentUser, queryTenantId);

    const membershipFilter: Prisma.UserTenantAccessWhereInput = {
      tenantId: effectiveTenantId,
      deletedAt: null,
      status: 'ACTIVE',
    };
    // Filtro por cargo agora e por id do cargo (roleType removido).
    if (role) membershipFilter.customRoleId = role;

    const where: Prisma.UserWhereInput = { tenantAccess: { some: membershipFilter } };
    if (status) where.status = status;
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
    const isPlatform = hasPlatformAccess(currentUser.customRole?.modulePermissions);

    // Nao-plataforma: o usuario precisa ter membership no tenant atual.
    const where: Prisma.UserWhereInput = { id };
    if (!isPlatform) {
      where.tenantAccess = { some: { tenantId: currentUser.tenantId, deletedAt: null } };
    }

    const user = await this.prisma.user.findFirst({
      where,
      select: {
        id: true, email: true, name: true, avatar: true,
        cpf: true, cnpj: true, phone: true, status: true,
        lastLoginAt: true, createdAt: true, updatedAt: true,
        tenantAccess: {
          where: { deletedAt: null },
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

  async update(id: string, dto: UpdateUserDto, currentUser: CurrentUser) {
    const oldUser = await this.findOne(id, currentUser);

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 12);
    }
    if (dto.cpf) dto.cpf = dto.cpf.replace(/\D/g, '') || undefined;
    if (dto.cnpj) dto.cnpj = dto.cnpj.replace(/\D/g, '') || undefined;
    if (dto.phone) dto.phone = dto.phone.replace(/\D/g, '') || undefined;

    // customRoleId/tenantId nao moram mais no User -> vao para a membership.
    const { customRoleId, tenantId: _t, ...userData } = dto as UpdateUserDto & { tenantId?: string };

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
    if (!hasPlatformAccess(currentUser.customRole?.modulePermissions) && currentUser.tenantId !== dto.tenantId) {
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

    if (!hasPlatformAccess(currentUser.customRole?.modulePermissions) && currentUser.tenantId !== access.tenantId) {
      throw new ForbiddenException('Sem permissao para revogar este acesso');
    }

    if (access.isPrimary) {
      throw new ForbiddenException('Nao e possivel revogar o tenant primario (home) do usuario');
    }

    // Soft delete da membership (mantem historico).
    await this.prisma.userTenantAccess.delete({ where: { id: accessId } });

    this.logger.log(`Tenant access revoked: accessId ${accessId}`);
    return { message: 'Acesso revogado com sucesso' };
  }

  async listUserTenantAccess(currentUser: CurrentUser, userId: string) {
    // Nao-plataforma: so ve acessos de usuarios que compartilham o tenant atual.
    if (!hasPlatformAccess(currentUser.customRole?.modulePermissions)) {
      const shares = await this.prisma.userTenantAccess.findFirst({
        where: { userId, tenantId: currentUser.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!shares) throw new NotFoundException('Usuario nao encontrado');
    }

    return this.prisma.userTenantAccess.findMany({
      where: { userId },
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

    // User esta no allowlist de soft-delete -> delete vira soft (deletedAt).
    await this.prisma.user.delete({ where: { id } });

    this.auditService.log(currentUser, {
      action: 'delete',
      resource: 'user',
      resourceId: id,
      oldData: { name: oldUser.name, email: oldUser.email },
    }).catch(() => {});

    return { message: 'Usuario excluido com sucesso' };
  }
}
