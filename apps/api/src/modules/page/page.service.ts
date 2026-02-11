import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreatePageDto, UpdatePageDto } from './dto/page.dto';
import {
  CurrentUser,
  PaginationQuery,
  parsePaginationParams,
  createPaginationMeta,
} from '../../common/types';
import { RoleType } from '../../common/decorators/roles.decorator';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';

export interface QueryPageDto extends PaginationQuery {
  isPublished?: boolean;
}

// Locales conhecidos para limpeza de hrefs
const KNOWN_LOCALES = ['pt-BR', 'en', 'es'];

/**
 * Remove prefixo de locale de um href se presente.
 * Ex: "/pt-BR/preview/page" -> "/preview/page"
 * Ex: "pt-BR/preview/page" -> "preview/page"
 */
function stripLocaleFromHref(href: string): string {
  if (!href || typeof href !== 'string') return href;

  for (const locale of KNOWN_LOCALES) {
    // Com barra no inicio: /pt-BR/preview -> /preview
    if (href.startsWith(`/${locale}/`)) {
      return href.slice(locale.length + 1);
    }
    // Sem barra no inicio: pt-BR/preview -> preview
    if (href.startsWith(`${locale}/`)) {
      return href.slice(locale.length + 1);
    }
    // Apenas o locale: /pt-BR -> /
    if (href === `/${locale}`) {
      return '/';
    }
  }
  return href;
}

/**
 * Percorre recursivamente o conteudo do Puck e limpa os hrefs
 * removendo prefixos de locale para evitar duplicacao.
 */
function cleanPuckContent(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => cleanPuckContent(item));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Se for um campo href, limpar o locale
      if (key === 'href' && typeof value === 'string') {
        result[key] = stripLocaleFromHref(value);
      } else {
        result[key] = cleanPuckContent(value);
      }
    }
    return result;
  }

  return obj;
}

@Injectable()
export class PageService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreatePageDto & { tenantId?: string }, userId: string, currentUser: CurrentUser) {
    const targetTenantId = getEffectiveTenantId(currentUser, data.tenantId);

    // Limpar hrefs do conteudo para remover prefixos de locale
    const cleanedContent = data.content ? cleanPuckContent(data.content) : {};

    return this.prisma.page.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        content: cleanedContent as Prisma.JsonObject,
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
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const where: Prisma.PageWhereInput = {};

    if (roleType === 'PLATFORM_ADMIN') {
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
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.PageWhereInput = { id };
    if (roleType !== 'PLATFORM_ADMIN') {
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
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.PageWhereInput = { slug };
    if (roleType !== 'PLATFORM_ADMIN') {
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

    // Limpar hrefs do conteudo para remover prefixos de locale
    const cleanedContent = data.content ? cleanPuckContent(data.content) : undefined;

    return this.prisma.page.update({
      where: { id },
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        content: cleanedContent as Prisma.JsonObject | undefined,
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

    // Limpar hrefs do conteudo para remover prefixos de locale
    const cleanedContent = page.content ? cleanPuckContent(page.content) : {};

    return this.prisma.page.create({
      data: {
        title: `${page.title} (Copia)`,
        slug: newSlug,
        description: page.description,
        content: cleanedContent as Prisma.JsonObject,
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
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.PageWhereInput = { slug };
    if (roleType !== 'PLATFORM_ADMIN') {
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
