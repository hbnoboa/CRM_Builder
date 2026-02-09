import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import {
  CurrentUser,
  PaginationQuery,
  parsePaginationParams,
  createPaginationMeta,
} from '../../common/types';

export interface CreateRoleDto {
  name: string;
  slug?: string;
  description?: string;
  permissions?: string[];
  isSystem?: boolean;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface QueryRoleDto extends PaginationQuery {
  isSystem?: boolean;
}

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  // Helper para determinar o tenantId efetivo (PLATFORM_ADMIN pode acessar qualquer tenant)
  private getEffectiveTenantId(currentUser: CurrentUser, requestedTenantId?: string): string {
    if (currentUser.role === UserRole.PLATFORM_ADMIN && requestedTenantId) {
      return requestedTenantId;
    }
    return currentUser.tenantId;
  }

  async create(dto: CreateRoleDto & { tenantId?: string }, currentUser: CurrentUser) {
    const targetTenantId = this.getEffectiveTenantId(currentUser, dto.tenantId);
    
    // Gerar slug se não fornecido
    const slug = dto.slug || dto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Verificar se slug já existe no tenant
    const existing = await this.prisma.role.findFirst({
      where: {
        tenantId: targetTenantId,
        slug,
      },
    });

    if (existing) {
      throw new ConflictException('Slug já está em uso');
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        tenantId: targetTenantId,
        permissions: dto.permissions || [],
        isSystem: dto.isSystem || false,
      },
    });
  }

  async findAll(query: QueryRoleDto, currentUser: CurrentUser) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, isSystem, sortBy = 'name', sortOrder = 'asc', tenantId: queryTenantId } = query;

    // PLATFORM_ADMIN pode ver de qualquer tenant ou todos
    const where: Prisma.RoleWhereInput = {};
    
    if (currentUser.role === UserRole.PLATFORM_ADMIN) {
      if (queryTenantId) {
        where.tenantId = queryTenantId;
      }
    } else {
      where.tenantId = currentUser.tenantId;
    }

    if (isSystem !== undefined) {
      where.isSystem = isSystem;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { users: true },
          },
          tenant: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    // PLATFORM_ADMIN pode ver role de qualquer tenant
    const whereClause: Prisma.RoleWhereInput = { id };
    if (currentUser.role !== UserRole.PLATFORM_ADMIN) {
      whereClause.tenantId = currentUser.tenantId;
    }

    const role = await this.prisma.role.findFirst({
      where: whereClause,
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role não encontrada');
    }

    return role;
  }

  async update(id: string, dto: UpdateRoleDto, currentUser: CurrentUser) {
    const role = await this.findOne(id, currentUser);

    if (role.isSystem) {
      throw new BadRequestException('Roles do sistema não podem ser editadas');
    }

    return this.prisma.role.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    const role = await this.findOne(id, currentUser);

    if (role.isSystem) {
      throw new BadRequestException('Roles do sistema não podem ser excluídas');
    }

    await this.prisma.role.delete({ where: { id } });

    return { message: 'Role excluída com sucesso' };
  }

  async assignToUser(userId: string, roleId: string, currentUser: CurrentUser) {
    // Verificar se role existe
    await this.findOne(roleId, currentUser);

    // Verificar se já está atribuída
    const existing = await this.prisma.userRole_.findUnique({
      where: {
        userId_roleId: { userId, roleId },
      },
    });

    if (existing) {
      throw new ConflictException('Role já atribuída a este usuário');
    }

    return this.prisma.userRole_.create({
      data: { userId, roleId },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async removeFromUser(userId: string, roleId: string, currentUser: CurrentUser) {
    await this.findOne(roleId, currentUser);

    await this.prisma.userRole_.delete({
      where: {
        userId_roleId: { userId, roleId },
      },
    });

    return { message: 'Role removida do usuário' };
  }

  async getUserRoles(userId: string, _currentUser: CurrentUser) {
    return this.prisma.userRole_.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });
  }

  // ========== ENTITY PERMISSIONS ==========

  async getEntityPermissions(roleId: string, currentUser: CurrentUser) {
    // Verifica se role existe e usuario tem acesso
    await this.findOne(roleId, currentUser);

    return this.prisma.entityPermission.findMany({
      where: { roleId },
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
      },
    });
  }

  async setEntityPermission(
    roleId: string,
    entityId: string,
    permissions: { canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean },
    currentUser: CurrentUser,
  ) {
    // Verifica se role existe e usuario tem acesso
    const role = await this.findOne(roleId, currentUser);

    // Verifica se entity existe e pertence ao mesmo tenant
    const entity = await this.prisma.entity.findFirst({
      where: {
        id: entityId,
        tenantId: role.tenantId,
      },
    });

    if (!entity) {
      throw new NotFoundException('Entidade não encontrada');
    }

    // Upsert - cria ou atualiza
    return this.prisma.entityPermission.upsert({
      where: {
        roleId_entityId: { roleId, entityId },
      },
      create: {
        roleId,
        entityId,
        tenantId: role.tenantId,
        ...permissions,
      },
      update: permissions,
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
      },
    });
  }

  async removeEntityPermission(roleId: string, entityId: string, currentUser: CurrentUser) {
    // Verifica se role existe e usuario tem acesso
    await this.findOne(roleId, currentUser);

    await this.prisma.entityPermission.delete({
      where: {
        roleId_entityId: { roleId, entityId },
      },
    });

    return { message: 'Permissão de entidade removida' };
  }

  async bulkSetEntityPermissions(
    roleId: string,
    entityPermissions: Array<{
      entityId: string;
      canCreate: boolean;
      canRead: boolean;
      canUpdate: boolean;
      canDelete: boolean;
    }>,
    currentUser: CurrentUser,
  ) {
    // Verifica se role existe e usuario tem acesso
    const role = await this.findOne(roleId, currentUser);

    // Processa em transacao
    return this.prisma.$transaction(async (tx) => {
      // Remove permissoes existentes
      await tx.entityPermission.deleteMany({
        where: { roleId },
      });

      // Cria novas permissoes (apenas as que tem pelo menos uma permissao true)
      const permissionsToCreate = entityPermissions.filter(
        (p) => p.canCreate || p.canRead || p.canUpdate || p.canDelete,
      );

      if (permissionsToCreate.length > 0) {
        await tx.entityPermission.createMany({
          data: permissionsToCreate.map((p) => ({
            roleId,
            entityId: p.entityId,
            tenantId: role.tenantId,
            canCreate: p.canCreate,
            canRead: p.canRead,
            canUpdate: p.canUpdate,
            canDelete: p.canDelete,
          })),
        });
      }

      // Retorna permissoes atualizadas
      return tx.entityPermission.findMany({
        where: { roleId },
        include: {
          entity: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
        },
      });
    });
  }
}
