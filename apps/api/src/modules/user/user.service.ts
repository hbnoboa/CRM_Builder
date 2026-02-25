import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
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
import { RoleType } from '../../common/decorators/roles.decorator';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, currentUser: CurrentUser) {
    // Determinar tenantId (PLATFORM_ADMIN pode criar em outro tenant)
    const targetTenantId = getEffectiveTenantId(currentUser, dto.tenantId);

    // Verificar se email ja existe no tenant
    const existing = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        tenantId: targetTenantId,
      },
    });

    if (existing) {
      throw new ConflictException('Email ja esta em uso');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Remove tenantId do dto para evitar duplicacao
    const { tenantId: _, ...userData } = dto;

    const newUser = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        tenantId: targetTenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        customRoleId: true,
        status: true,
        tenantId: true,
        createdAt: true,
        customRole: { select: { id: true, name: true, color: true, roleType: true, isSystem: true } },
      },
    });

    // Enviar notificacao para o tenant
    this.notificationService.notifyNewUser(
      targetTenantId,
      newUser.name,
      currentUser.name,
    ).catch((err) => this.logger.error('Failed to send notification', err));

    // Audit log (fire-and-forget, never log passwords)
    this.auditService.log(currentUser, {
      action: 'create',
      resource: 'user',
      resourceId: newUser.id,
      newData: { email: dto.email, name: dto.name, customRoleId: dto.customRoleId },
    }).catch(() => {});

    return newUser;
  }

  async findAll(query: QueryUserDto, currentUser: CurrentUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;
    const { search, role, status, tenantId: queryTenantId, cursor, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    // Base filter por tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const where: Prisma.UserWhereInput = {};

    if (roleType === 'PLATFORM_ADMIN') {
      if (queryTenantId) {
        where.tenantId = queryTenantId;
      }
    } else {
      where.tenantId = currentUser.tenantId;
    }

    // Filtros opcionais
    if (role) where.customRole = { roleType: role };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Cursor pagination
    const useCursor = !!cursor;
    let cursorClause: { id: string } | undefined;

    if (useCursor) {
      const decodedCursor = decodeCursor(cursor);
      if (decodedCursor) {
        cursorClause = { id: decodedCursor.id };
      }
    }

    // OrderBy com id como tiebreaker
    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
    ];
    if (sortBy !== 'id') {
      orderBy.push({ id: sortOrder });
    }

    const takeWithExtra = limit + 1;

    const findManyArgs: Prisma.UserFindManyArgs = {
      where,
      take: takeWithExtra,
      orderBy,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        customRoleId: true,
        status: true,
        tenantId: true,
        lastLoginAt: true,
        createdAt: true,
        customRole: {
          select: { id: true, name: true, color: true, roleType: true, isSystem: true },
        },
        tenant: {
          select: { id: true, name: true, slug: true },
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
    const data = hasNextPage ? rawData.slice(0, limit) : rawData;
    const hasPreviousPage = useCursor ? true : page > 1;

    let nextCursor: string | undefined;
    let previousCursor: string | undefined;

    if (data.length > 0) {
      const lastItem = data[data.length - 1];
      const firstItem = data[0];

      if (hasNextPage) {
        nextCursor = encodeCursor({
          id: lastItem.id,
          sortField: sortBy,
          sortValue: (lastItem as Record<string, unknown>)[sortBy] as string,
        });
      }

      if (hasPreviousPage && useCursor) {
        previousCursor = encodeCursor({
          id: firstItem.id,
          sortField: sortBy,
          sortValue: (firstItem as Record<string, unknown>)[sortBy] as string,
        });
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
    // PLATFORM_ADMIN pode ver usuario de qualquer tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.UserWhereInput = { id };
    if (roleType !== 'PLATFORM_ADMIN') {
      whereClause.tenantId = currentUser.tenantId;
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        customRoleId: true,
        status: true,
        tenantId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        customRole: {
          select: {
            id: true, name: true, color: true,
            roleType: true, isSystem: true,
            permissions: true, modulePermissions: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, currentUser: CurrentUser) {
    // Verifica se usuario existe (e se tem permissao)
    const oldUser = await this.findOne(id, currentUser);

    // Se mudando senha, fazer hash
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 12);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        customRoleId: true,
        status: true,
        tenantId: true,
        updatedAt: true,
        customRole: { select: { id: true, name: true, color: true, roleType: true, isSystem: true } },
      },
    });

    // Audit log (fire-and-forget, never log passwords)
    this.auditService.log(currentUser, {
      action: 'update',
      resource: 'user',
      resourceId: id,
      oldData: { name: oldUser.name, email: oldUser.email, status: oldUser.status, customRoleId: oldUser.customRoleId },
      newData: { ...dto, password: undefined },
    }).catch(() => {});

    return updatedUser;
  }

  // ═══════════════════════════════════════════════════════════════
  // TENANT ACCESS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async grantTenantAccess(
    currentUser: CurrentUser,
    dto: { userId: string; tenantId: string; customRoleId: string; expiresAt?: string },
  ) {
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;

    // Apenas PLATFORM_ADMIN ou ADMIN do tenant destino podem conceder acesso
    if (roleType !== 'PLATFORM_ADMIN' && currentUser.tenantId !== dto.tenantId) {
      throw new ForbiddenException('Sem permissao para conceder acesso a este tenant');
    }

    // Verificar que o usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, tenantId: true, name: true },
    });
    if (!user) throw new NotFoundException('Usuario nao encontrado');

    // Nao pode conceder acesso ao proprio home tenant
    if (user.tenantId === dto.tenantId) {
      throw new ConflictException('Usuario ja pertence a este tenant');
    }

    // Verificar que o tenant destino existe
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) throw new NotFoundException('Tenant nao encontrado');

    // Verificar que a role pertence ao tenant destino
    const role = await this.prisma.customRole.findFirst({
      where: { id: dto.customRoleId, tenantId: dto.tenantId },
      select: { id: true, name: true },
    });
    if (!role) throw new NotFoundException('Role nao encontrada neste tenant');

    // Criar ou atualizar acesso (upsert)
    const access = await this.prisma.userTenantAccess.upsert({
      where: {
        userId_tenantId: { userId: dto.userId, tenantId: dto.tenantId },
      },
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
        grantedById: currentUser.id,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        customRole: { select: { id: true, name: true, roleType: true } },
      },
    });

    this.logger.log(`Tenant access granted: user ${user.name} -> tenant ${tenant.name}`);
    return access;
  }

  async revokeTenantAccess(currentUser: CurrentUser, accessId: string) {
    const access = await this.prisma.userTenantAccess.findUnique({
      where: { id: accessId },
      select: { id: true, tenantId: true, userId: true },
    });

    if (!access) throw new NotFoundException('Acesso nao encontrado');

    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    if (roleType !== 'PLATFORM_ADMIN' && currentUser.tenantId !== access.tenantId) {
      throw new ForbiddenException('Sem permissao para revogar este acesso');
    }

    await this.prisma.userTenantAccess.delete({ where: { id: accessId } });

    this.logger.log(`Tenant access revoked: accessId ${accessId}`);
    return { message: 'Acesso revogado com sucesso' };
  }

  async listUserTenantAccess(currentUser: CurrentUser, userId: string) {
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;

    // PLATFORM_ADMIN pode ver de qualquer user, outros so de users do mesmo tenant
    if (roleType !== 'PLATFORM_ADMIN') {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, tenantId: currentUser.tenantId },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('Usuario nao encontrado');
    }

    return this.prisma.userTenantAccess.findMany({
      where: { userId },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        customRole: { select: { id: true, name: true, roleType: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    // Verifica se usuario existe (e se tem permissao)
    const oldUser = await this.findOne(id, currentUser);

    // Nao pode deletar a si mesmo
    if (id === currentUser.id) {
      throw new ForbiddenException('Voce nao pode excluir sua propria conta');
    }

    await this.prisma.user.delete({ where: { id } });

    // Audit log (fire-and-forget, never log passwords)
    this.auditService.log(currentUser, {
      action: 'delete',
      resource: 'user',
      resourceId: id,
      oldData: { name: oldUser.name, email: oldUser.email },
    }).catch(() => {});

    return { message: 'Usuario excluido com sucesso' };
  }
}
