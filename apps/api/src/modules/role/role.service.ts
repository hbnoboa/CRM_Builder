import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
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

  async create(dto: CreateRoleDto, currentUser: CurrentUser) {
    // Gerar slug se não fornecido
    const slug = dto.slug || dto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Verificar se slug já existe no tenant
    const existing = await this.prisma.role.findFirst({
      where: {
        tenantId: currentUser.tenantId,
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
        tenantId: currentUser.tenantId,
        permissions: dto.permissions || [],
        isSystem: dto.isSystem || false,
      },
    });
  }

  async findAll(query: QueryRoleDto, currentUser: CurrentUser) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, isSystem, sortBy = 'name', sortOrder = 'asc' } = query;

    const where: Prisma.RoleWhereInput = {
      tenantId: currentUser.tenantId,
    };

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
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
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
}
