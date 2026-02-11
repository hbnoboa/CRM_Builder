import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomRoleDto, UpdateCustomRoleDto, QueryCustomRoleDto, RoleType } from './dto/custom-role.dto';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { Prisma } from '@prisma/client';
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

  async create(dto: CreateCustomRoleDto, currentUser: CurrentUser) {
    const tenantId = getEffectiveTenantId(currentUser);

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
        roleType: 'CUSTOM', // Roles criadas manualmente sao sempre CUSTOM
        isSystem: false,
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
    const tenantId = getEffectiveTenantId(currentUser);

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
    const tenantId = getEffectiveTenantId(currentUser);

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
    const tenantId = getEffectiveTenantId(currentUser);

    const role = await this.findOne(id, currentUser);

    // Proteger roles de sistema: nome e roleType nao podem ser alterados
    if (role.isSystem) {
      if (dto.name && dto.name !== role.name) {
        throw new ForbiddenException('Nome de roles do sistema nao pode ser alterado');
      }
      if (dto.roleType && dto.roleType !== role.roleType) {
        throw new ForbiddenException('Tipo de roles do sistema nao pode ser alterado');
      }
    }

    // Verificar conflito de nome
    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.customRole.findFirst({
        where: { tenantId, name: dto.name, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException('Ja existe uma role com este nome');
      }
    }

    const data: Prisma.CustomRoleUpdateInput = {};
    if (!role.isSystem && dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.permissions !== undefined) data.permissions = dto.permissions as unknown as Prisma.InputJsonValue;
    if (dto.modulePermissions !== undefined) data.modulePermissions = (dto.modulePermissions || {}) as unknown as Prisma.InputJsonValue;
    if (dto.tenantPermissions !== undefined) data.tenantPermissions = dto.tenantPermissions as unknown as Prisma.InputJsonValue;

    return this.prisma.customRole.update({
      where: { id },
      data,
      include: {
        _count: { select: { users: true } },
      },
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    const role = await this.findOne(id, currentUser);

    // Roles de sistema nao podem ser excluidas
    if (role.isSystem) {
      throw new ForbiddenException('Roles do sistema nao podem ser excluidas');
    }

    // Verificar se ha usuarios usando esta role
    const usersCount = await this.prisma.user.count({
      where: { customRoleId: id },
    });

    if (usersCount > 0) {
      throw new ConflictException(`Esta role esta atribuida a ${usersCount} usuario(s). Reassine-os antes de excluir.`);
    }

    await this.prisma.customRole.delete({ where: { id } });
    return { message: 'Role excluida com sucesso' };
  }

  async assignToUser(roleId: string, userId: string, currentUser: CurrentUser) {
    const tenantId = getEffectiveTenantId(currentUser);

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
      select: {
        id: true,
        name: true,
        email: true,
        customRoleId: true,
        customRole: {
          select: { id: true, name: true, roleType: true, isSystem: true },
        },
      },
    });
  }

  async removeFromUser(userId: string, currentUser: CurrentUser) {
    const tenantId = getEffectiveTenantId(currentUser);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('Usuario nao encontrado');

    // Buscar role default do tenant
    const defaultRole = await this.prisma.customRole.findFirst({
      where: { tenantId, isDefault: true },
    });

    if (!defaultRole) {
      throw new NotFoundException('Tenant sem role default configurada');
    }

    // Atribuir role default ao inves de null
    return this.prisma.user.update({
      where: { id: userId },
      data: { customRoleId: defaultRole.id },
      select: {
        id: true,
        name: true,
        email: true,
        customRoleId: true,
        customRole: {
          select: { id: true, name: true, roleType: true, isSystem: true },
        },
      },
    });
  }

  /**
   * Verifica se um usuario tem permissao para uma entidade especifica
   */
  async hasEntityPermission(
    userId: string,
    entitySlug: string,
    action: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete',
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        customRoleId: true,
        customRole: {
          select: { roleType: true, permissions: true },
        },
      },
    });

    if (!user || !user.customRole) return false;

    const roleType = user.customRole.roleType as RoleType;

    // PLATFORM_ADMIN e ADMIN tem acesso total
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') {
      return true;
    }

    // MANAGER tem acesso total a CRUD
    if (roleType === 'MANAGER') {
      return ['canCreate', 'canRead', 'canUpdate', 'canDelete'].includes(action);
    }

    // USER tem acesso a criar, ler e atualizar proprios
    if (roleType === 'USER') {
      return ['canCreate', 'canRead', 'canUpdate'].includes(action);
    }

    // VIEWER so pode ler
    if (roleType === 'VIEWER') {
      return action === 'canRead';
    }

    // CUSTOM: usa permissoes definidas
    const permissions = user.customRole.permissions as unknown as Array<{
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
      select: {
        customRole: {
          select: { roleType: true, permissions: true },
        },
      },
    });

    if (!user || !user.customRole) return null;

    const roleType = user.customRole.roleType as RoleType;

    // PLATFORM_ADMIN e ADMIN veem tudo
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') {
      return 'all';
    }

    // MANAGER ve tudo do tenant
    if (roleType === 'MANAGER') {
      return 'all';
    }

    // VIEWER ve tudo mas nao edita
    if (roleType === 'VIEWER') {
      return 'all';
    }

    // USER ve apenas proprios
    if (roleType === 'USER') {
      return 'own';
    }

    // CUSTOM: usa permissoes definidas
    const permissions = user.customRole.permissions as unknown as Array<{
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
   * Retorna todas as entidades que o usuario pode acessar
   */
  async getUserAccessibleEntities(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        tenantId: true,
        customRole: {
          select: { roleType: true, permissions: true },
        },
      },
    });

    if (!user || !user.customRole) return [];

    const roleType = user.customRole.roleType as RoleType;

    // PLATFORM_ADMIN, ADMIN, MANAGER, USER e VIEWER acessam todas entidades
    // A diferenca esta no escopo (all vs own) verificado em getEntityScope
    if (['PLATFORM_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER'].includes(roleType)) {
      const entities = await this.prisma.entity.findMany({
        where: { tenantId: user.tenantId },
        select: { slug: true },
      });
      return entities.map((e) => e.slug);
    }

    // CUSTOM: usa permissoes definidas
    const permissions = user.customRole.permissions as unknown as Array<{
      entitySlug: string;
      canRead: boolean;
    }>;

    return permissions.filter((p) => p.canRead).map((p) => p.entitySlug);
  }

  /**
   * Retorna as permissoes de modulo do usuario
   */
  async getUserModulePermissions(userId: string): Promise<Record<string, boolean>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        customRole: {
          select: { roleType: true, modulePermissions: true },
        },
      },
    });

    if (!user || !user.customRole) return {};

    const roleType = user.customRole.roleType as RoleType;

    // PLATFORM_ADMIN e ADMIN tem tudo
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') {
      return { dashboard: true, users: true, settings: true, apis: true, pages: true, entities: true };
    }

    // Usar modulePermissions da customRole (ja configuradas no seed/migration)
    return user.customRole.modulePermissions as Record<string, boolean>;
  }
}
