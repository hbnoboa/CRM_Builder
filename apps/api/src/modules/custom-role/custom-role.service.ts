import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomRoleDto, UpdateCustomRoleDto, QueryCustomRoleDto } from './dto/custom-role.dto';
import { UserRole, Prisma } from '@prisma/client';
import {
  CurrentUser,
  createPaginationMeta,
  encodeCursor,
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../common/types';

@Injectable()
export class CustomRoleService {
  private readonly logger = new Logger(CustomRoleService.name);

  constructor(private prisma: PrismaService) {}

  private getEffectiveTenantId(currentUser: CurrentUser, requestedTenantId?: string): string {
    if (currentUser.role === UserRole.PLATFORM_ADMIN && requestedTenantId) {
      return requestedTenantId;
    }
    return currentUser.tenantId;
  }

  async create(dto: CreateCustomRoleDto, currentUser: CurrentUser) {
    const tenantId = this.getEffectiveTenantId(currentUser);

    // Verificar se nome já existe no tenant
    const existing = await this.prisma.customRole.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });

    if (existing) {
      throw new ConflictException('Já existe uma role com este nome');
    }

    return this.prisma.customRole.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        permissions: dto.permissions as unknown as Prisma.InputJsonValue,
        modulePermissions: (dto.modulePermissions || {}) as unknown as Prisma.InputJsonValue,
        isDefault: dto.isDefault || false,
      },
      include: {
        _count: { select: { users: true } },
      },
    });
  }

  async findAll(query: QueryCustomRoleDto, currentUser: CurrentUser) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;
    const { search, cursor, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const tenantId = this.getEffectiveTenantId(currentUser);

    const where: Prisma.CustomRoleWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
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

    const orderBy: Prisma.CustomRoleOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
    ];
    if (sortBy !== 'id') {
      orderBy.push({ id: sortOrder });
    }

    const takeWithExtra = limit + 1;

    const findManyArgs: Prisma.CustomRoleFindManyArgs = {
      where,
      take: takeWithExtra,
      orderBy,
      include: {
        _count: { select: { users: true } },
      },
    };

    if (useCursor && cursorClause) {
      findManyArgs.cursor = cursorClause;
      findManyArgs.skip = 1;
    } else {
      findManyArgs.skip = skip;
    }

    const [rawData, total] = await Promise.all([
      this.prisma.customRole.findMany(findManyArgs),
      this.prisma.customRole.count({ where }),
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
        nextCursor = encodeCursor({ id: lastItem.id, sortField: sortBy });
      }
      if (hasPreviousPage && useCursor) {
        previousCursor = encodeCursor({ id: firstItem.id, sortField: sortBy });
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
    const tenantId = this.getEffectiveTenantId(currentUser);

    const role = await this.prisma.customRole.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { users: true } },
        users: {
          select: { id: true, name: true, email: true, avatar: true },
          take: 10,
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role não encontrada');
    }

    return role;
  }

  async update(id: string, dto: UpdateCustomRoleDto, currentUser: CurrentUser) {
    const tenantId = this.getEffectiveTenantId(currentUser);

    await this.findOne(id, currentUser);

    // Verificar conflito de nome
    if (dto.name) {
      const existing = await this.prisma.customRole.findFirst({
        where: { tenantId, name: dto.name, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException('Já existe uma role com este nome');
      }
    }

    const data: Prisma.CustomRoleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.permissions !== undefined) data.permissions = dto.permissions as unknown as Prisma.InputJsonValue;
    if (dto.modulePermissions !== undefined) data.modulePermissions = (dto.modulePermissions || {}) as unknown as Prisma.InputJsonValue;

    return this.prisma.customRole.update({
      where: { id },
      data,
      include: {
        _count: { select: { users: true } },
      },
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    // Desassociar usuários antes de excluir
    await this.prisma.user.updateMany({
      where: { customRoleId: id },
      data: { customRoleId: null },
    });

    await this.prisma.customRole.delete({ where: { id } });
    return { message: 'Role excluída com sucesso' };
  }

  async assignToUser(roleId: string, userId: string, currentUser: CurrentUser) {
    const tenantId = this.getEffectiveTenantId(currentUser);

    // Verificar se a role existe e pertence ao tenant
    const role = await this.prisma.customRole.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) throw new NotFoundException('Role não encontrada');

    // Verificar se o usuário existe e pertence ao tenant
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    return this.prisma.user.update({
      where: { id: userId },
      data: { customRoleId: roleId },
      select: { id: true, name: true, email: true, role: true, customRoleId: true },
    });
  }

  async removeFromUser(userId: string, currentUser: CurrentUser) {
    const tenantId = this.getEffectiveTenantId(currentUser);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    return this.prisma.user.update({
      where: { id: userId },
      data: { customRoleId: null },
      select: { id: true, name: true, email: true, role: true, customRoleId: true },
    });
  }

  /**
   * Verifica se um usuário tem permissão para uma entidade específica
   */
  async hasEntityPermission(
    userId: string,
    entitySlug: string,
    action: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete',
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, customRoleId: true },
    });

    if (!user) return false;

    // PLATFORM_ADMIN e ADMIN tem acesso total
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      return true;
    }

    // Se não tem custom role, usa permissões default do base role
    if (!user.customRoleId) {
      return this.getDefaultPermissionForRole(user.role, action);
    }

    const customRole = await this.prisma.customRole.findUnique({
      where: { id: user.customRoleId },
      select: { permissions: true },
    });

    if (!customRole) return false;

    const permissions = customRole.permissions as unknown as Array<{
      entitySlug: string;
      canCreate: boolean;
      canRead: boolean;
      canUpdate: boolean;
      canDelete: boolean;
      scope?: 'all' | 'own';
    }>;

    const entityPerm = permissions.find((p) => p.entitySlug === entitySlug);
    if (!entityPerm) return false;

    return entityPerm[action] === true;
  }

  /**
   * Retorna o escopo de visibilidade do usuario para uma entidade
   * @returns 'all' | 'own' | null (null = sem acesso)
   */
  async getEntityScope(
    userId: string,
    entitySlug: string,
  ): Promise<'all' | 'own' | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, customRoleId: true },
    });

    if (!user) return null;

    // PLATFORM_ADMIN e ADMIN veem tudo
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      return 'all';
    }

    // MANAGER ve tudo do tenant
    if (user.role === UserRole.MANAGER && !user.customRoleId) {
      return 'all';
    }

    // USER e VIEWER sem custom role = escopo proprio
    if (!user.customRoleId) {
      if (user.role === UserRole.USER) return 'own';
      if (user.role === UserRole.VIEWER) return 'all'; // Viewer ve tudo mas nao edita
      return null;
    }

    const customRole = await this.prisma.customRole.findUnique({
      where: { id: user.customRoleId },
      select: { permissions: true },
    });

    if (!customRole) return null;

    const permissions = customRole.permissions as unknown as Array<{
      entitySlug: string;
      canRead: boolean;
      scope?: 'all' | 'own';
    }>;

    const entityPerm = permissions.find((p) => p.entitySlug === entitySlug);
    if (!entityPerm || !entityPerm.canRead) return null;

    // Default scope = 'all' para manter compatibilidade
    return entityPerm.scope || 'all';
  }

  /**
   * Retorna todas as entidades que o usuário pode acessar
   */
  async getUserAccessibleEntities(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, customRoleId: true, tenantId: true },
    });

    if (!user) return [];

    // PLATFORM_ADMIN e ADMIN acessam tudo
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      const entities = await this.prisma.entity.findMany({
        where: { tenantId: user.tenantId },
        select: { slug: true },
      });
      return entities.map((e) => e.slug);
    }

    if (!user.customRoleId) {
      // MANAGER, USER, VIEWER sem custom role = acesso a tudo com base nas permissões padrão
      if (user.role === UserRole.MANAGER || user.role === UserRole.USER) {
        const entities = await this.prisma.entity.findMany({
          where: { tenantId: user.tenantId },
          select: { slug: true },
        });
        return entities.map((e) => e.slug);
      }
      return [];
    }

    const customRole = await this.prisma.customRole.findUnique({
      where: { id: user.customRoleId },
      select: { permissions: true },
    });

    if (!customRole) return [];

    const permissions = customRole.permissions as unknown as Array<{
      entitySlug: string;
      canRead: boolean;
    }>;

    return permissions.filter((p) => p.canRead).map((p) => p.entitySlug);
  }

  /**
   * Retorna as permissões de módulo do usuário
   */
  async getUserModulePermissions(userId: string): Promise<Record<string, boolean>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, customRoleId: true },
    });

    if (!user) return {};

    // PLATFORM_ADMIN e ADMIN tem tudo
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      return { dashboard: true, users: true, settings: true, apis: true, pages: true, entities: true };
    }

    if (!user.customRoleId) {
      return this.getDefaultModulePermissionsForRole(user.role);
    }

    const customRole = await this.prisma.customRole.findUnique({
      where: { id: user.customRoleId },
      select: { modulePermissions: true },
    });

    if (!customRole) return {};
    return customRole.modulePermissions as Record<string, boolean>;
  }

  private getDefaultPermissionForRole(role: UserRole, action: string): boolean {
    switch (role) {
      case UserRole.MANAGER:
        return ['canCreate', 'canRead', 'canUpdate', 'canDelete'].includes(action);
      case UserRole.USER:
        return ['canCreate', 'canRead', 'canUpdate'].includes(action);
      case UserRole.VIEWER:
        return action === 'canRead';
      default:
        return false;
    }
  }

  private getDefaultModulePermissionsForRole(role: UserRole): Record<string, boolean> {
    switch (role) {
      case UserRole.MANAGER:
        return { dashboard: true, users: true, settings: false, apis: false, pages: false, entities: false };
      case UserRole.USER:
        return { dashboard: true, users: false, settings: false, apis: false, pages: false, entities: false };
      case UserRole.VIEWER:
        return { dashboard: true, users: false, settings: false, apis: false, pages: false, entities: false };
      default:
        return { dashboard: true };
    }
  }
}
