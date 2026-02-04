import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';
import {
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

  async create(data: CreatePageDto, userId: string, tenantId: string) {
    return this.prisma.page.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        content: data.content || {},
        isPublished: data.isPublished || false,
        permissions: data.permissions || [],
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, query: QueryPageDto = {}) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, isPublished, sortBy = 'updatedAt', sortOrder = 'desc' } = query;

    const where: Prisma.PageWhereInput = {
      tenantId,
    };

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
      }),
      this.prisma.page.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string, tenantId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id, tenantId },
    });

    if (!page) {
      throw new NotFoundException('Pagina nao encontrada');
    }

    return page;
  }

  async findBySlug(slug: string, tenantId: string) {
    const page = await this.prisma.page.findFirst({
      where: { slug, tenantId },
    });

    if (!page) {
      throw new NotFoundException('Pagina nao encontrada');
    }

    return page;
  }

  async update(id: string, data: UpdatePageDto, tenantId: string) {
    await this.findOne(id, tenantId);

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

  async publish(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.page.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  async unpublish(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.page.update({
      where: { id },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    });
  }

  async duplicate(id: string, tenantId: string) {
    const page = await this.findOne(id, tenantId);

    const newSlug = `${page.slug}-copy-${Date.now()}`;

    return this.prisma.page.create({
      data: {
        title: `${page.title} (Copia)`,
        slug: newSlug,
        description: page.description,
        content: page.content || {},
        permissions: page.permissions || [],
        tenantId,
        isPublished: false,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.page.delete({
      where: { id },
    });
  }

  // Get page for preview (authenticated - allows unpublished pages)
  async getPreviewPage(slug: string, tenantId: string) {
    const page = await this.prisma.page.findFirst({
      where: {
        slug,
        tenantId,
      },
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
