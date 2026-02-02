import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  async create(data: CreatePageDto, userId: string, workspaceId: string, tenantId: string) {
    return this.prisma.page.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        content: data.content || {},
        isPublished: data.isPublished || false,
        permissions: data.permissions || [],
        workspaceId,
        tenantId,
      },
    });
  }

  async findAll(workspaceId: string, query: QueryPageDto = {}) {
    const { page, limit, skip } = parsePaginationParams(query);
    const { search, isPublished, sortBy = 'updatedAt', sortOrder = 'desc' } = query;

    const where: Prisma.PageWhereInput = {
      workspaceId,
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

  async findOne(id: string, workspaceId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id, workspaceId },
    });

    if (!page) {
      throw new NotFoundException('Página não encontrada');
    }

    return page;
  }

  async findBySlug(slug: string, workspaceId: string) {
    const page = await this.prisma.page.findFirst({
      where: { slug, workspaceId },
    });

    if (!page) {
      throw new NotFoundException('Página não encontrada');
    }

    return page;
  }

  async update(id: string, data: UpdatePageDto, workspaceId: string) {
    await this.findOne(id, workspaceId);

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

  async publish(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    return this.prisma.page.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  async unpublish(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    return this.prisma.page.update({
      where: { id },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    });
  }

  async duplicate(id: string, workspaceId: string, tenantId: string) {
    const page = await this.findOne(id, workspaceId);

    const newSlug = `${page.slug}-copy-${Date.now()}`;
    
    return this.prisma.page.create({
      data: {
        title: `${page.title} (Cópia)`,
        slug: newSlug,
        description: page.description,
        content: page.content || {},
        permissions: page.permissions || [],
        workspaceId,
        tenantId,
        isPublished: false,
      },
    });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    return this.prisma.page.delete({
      where: { id },
    });
  }

  // Get page for public rendering (only published pages)
  async getPublicPage(slug: string, workspaceId: string) {
    const page = await this.prisma.page.findFirst({
      where: {
        slug,
        workspaceId,
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
        workspace: {
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
      workspaceId: page.workspaceId,
      workspaceName: page.workspace.name,
    };
  }
}
