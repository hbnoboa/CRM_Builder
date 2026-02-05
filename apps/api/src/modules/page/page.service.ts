import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';
import {
  CurrentUser,
  PaginationQuery,
  parsePaginationParams,
  createPaginationMeta,
} from '../../common/types';

export interface QueryPageDto extends PaginationQuery {
  isPublished?: boolean;
}

@Injectable()
export class PageService {
  constructor(private prisma: PrismaService) {}

  // Helper para determinar o tenantId efetivo (PLATFORM_ADMIN pode acessar qualquer tenant)
  private getEffectiveTenantId(currentUser: CurrentUser, requestedTenantId?: string): string {
    if (currentUser.role === UserRole.PLATFORM_ADMIN && requestedTenantId) {
      return requestedTenantId;
    }
    return currentUser.tenantId;
  }

  async create(data: CreatePageDto & { tenantId?: string }, userId: string, currentUser: CurrentUser) {
    const targetTenantId = this.getEffectiveTenantId(currentUser, data.tenantId);
    
    return this.prisma.page.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        content: data.content || {},
        isPublished: data.isPublished || false,
        permissions: data.permissions || [],
        tenantId: targetTenantId,
      },
    });
  }

  async findAll(currentUser: CurrentUser, query: QueryPageDto = {}) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, isPublished, sortBy = 'updatedAt', sortOrder = 'desc', tenantId: queryTenantId } = query;

    // PLATFORM_ADMIN pode ver de qualquer tenant ou todos
    const where: Prisma.PageWhereInput = {};
    
    if (currentUser.role === UserRole.PLATFORM_ADMIN) {
      if (queryTenantId) {
        where.tenantId = queryTenantId;
      }
    } else {
      where.tenantId = currentUser.tenantId;
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          tenant: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.page.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    // PLATFORM_ADMIN pode ver pagina de qualquer tenant
    const whereClause: Prisma.PageWhereInput = { id };
    if (currentUser.role !== UserRole.PLATFORM_ADMIN) {
      whereClause.tenantId = currentUser.tenantId;
    }

    const page = await this.prisma.page.findFirst({
      where: whereClause,
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!page) {
      throw new NotFoundException('Pagina nao encontrada');
    }

    return page;
  }

  async findBySlug(slug: string, currentUser: CurrentUser) {
    // PLATFORM_ADMIN pode ver pagina de qualquer tenant
    const whereClause: Prisma.PageWhereInput = { slug };
    if (currentUser.role !== UserRole.PLATFORM_ADMIN) {
      whereClause.tenantId = currentUser.tenantId;
    }

    const page = await this.prisma.page.findFirst({
      where: whereClause,
    });

    if (!page) {
      throw new NotFoundException('Pagina nao encontrada');
    }

    return page;
  }

  async update(id: string, data: UpdatePageDto, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.page.update({
      where: { id },
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        content: data.content,
        isPublished: data.isPublished,
        permissions: data.permissions,
        updatedAt: new Date(),
      },
    });
  }

  async publish(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.page.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  async unpublish(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.page.update({
      where: { id },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    });
  }

  async duplicate(id: string, currentUser: CurrentUser) {
    const page = await this.findOne(id, currentUser);

    const newSlug = `${page.slug}-copy-${Date.now()}`;

    return this.prisma.page.create({
      data: {
        title: `${page.title} (Copia)`,
        slug: newSlug,
        description: page.description,
        content: page.content || {},
        permissions: page.permissions || [],
        tenantId: page.tenantId,
        isPublished: false,
      },
    });
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    return this.prisma.page.delete({
      where: { id },
    });
  }

  // Get page for preview (authenticated - allows unpublished pages)
  async getPreviewPage(slug: string, currentUser: CurrentUser) {
    const whereClause: Prisma.PageWhereInput = { slug };
    if (currentUser.role !== UserRole.PLATFORM_ADMIN) {
      whereClause.tenantId = currentUser.tenantId;
    }
    
    const page = await this.prisma.page.findFirst({
      where: whereClause,
    });

    if (!page) {
      throw new NotFoundException('Pagina nao encontrada');
    }

    return {
      title: page.title,
      content: page.content,
      isPublished: page.isPublished,
    };
  }

  // Get page for public rendering (only published pages)
  async getPublicPage(slug: string, tenantId: string) {
    const page = await this.prisma.page.findFirst({
      where: {
        slug,
        tenantId,
        isPublished: true,
      },
    });

    if (!page) {
      throw new NotFoundException('Pagina nao encontrada');
    }

    return {
      title: page.title,
      content: page.content,
    };
  }

  // Get page by slug only (for simpler public URLs)
  async getPublicPageBySlug(slug: string) {
    const page = await this.prisma.page.findFirst({
      where: {
        slug,
        isPublished: true,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!page) {
      throw new NotFoundException('Pagina nao encontrada');
    }

    return {
      title: page.title,
      content: page.content,
      tenantId: page.tenantId,
      tenantName: page.tenant.name,
    };
  }
}
