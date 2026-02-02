import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CurrentUser,
  PaginationQuery,
  parsePaginationParams,
  createPaginationMeta,
} from '../../common/types';

export interface CreateOrganizationDto {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  description?: string;
  logo?: string;
}

export type QueryOrganizationDto = PaginationQuery;

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto, currentUser: CurrentUser) {
    // Verificar se slug já existe no tenant
    const existing = await this.prisma.organization.findFirst({
      where: {
        tenantId: currentUser.tenantId,
        slug: dto.slug,
      },
    });

    if (existing) {
      throw new ConflictException('Slug já está em uso');
    }

    return this.prisma.organization.create({
      data: {
        ...dto,
        tenantId: currentUser.tenantId,
      },
    });
  }

  async findAll(query: QueryOrganizationDto, currentUser: CurrentUser) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, sortBy = 'name', sortOrder = 'asc' } = query;

    const where: Prisma.OrganizationWhereInput = {
      tenantId: currentUser.tenantId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              users: true,
              workspaces: true,
            },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const org = await this.prisma.organization.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      include: {
        workspaces: true,
        _count: {
          select: {
            users: true,
            workspaces: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organização não encontrada');
    }

    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.organization.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    await this.prisma.organization.delete({ where: { id } });

    return { message: 'Organização excluída com sucesso' };
  }
}
