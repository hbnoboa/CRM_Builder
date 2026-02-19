import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, type PdfTemplate } from '@prisma/client';
import type { CurrentUser } from '../../common/types';
import {
  CreatePdfTemplateDto,
  UpdatePdfTemplateDto,
  QueryPdfTemplateDto,
} from './dto';

@Injectable()
export class PdfTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePdfTemplateDto, user: CurrentUser) {
    // Verificar se slug ja existe
    const existing = await this.prisma.pdfTemplate.findUnique({
      where: {
        tenantId_slug: {
          tenantId: user.tenantId,
          slug: dto.slug,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Template com slug "${dto.slug}" ja existe`);
    }

    // Se entitySlug informado, buscar entityId
    let entityId: string | undefined;
    if (dto.entitySlug) {
      const entity = await this.prisma.entity.findFirst({
        where: {
          tenantId: user.tenantId,
          slug: dto.entitySlug,
        },
      });
      if (!entity) {
        throw new NotFoundException(`Entidade "${dto.entitySlug}" nao encontrada`);
      }
      entityId = entity.id;
    }

    return this.prisma.pdfTemplate.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        category: dto.category,
        entityId,
        entitySlug: dto.entitySlug,
        basePdf: (dto.basePdf ?? {}) as Prisma.InputJsonValue,
        schemas: (dto.schemas ?? []) as Prisma.InputJsonValue,
        settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
        isPublished: dto.isPublished ?? false,
        createdById: user.id,
      },
      include: {
        entity: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findAll(user: CurrentUser, query: QueryPdfTemplateDto) {
    const { search, entitySlug, category, isPublished, includeGlobal, page = 1, limit = 20 } = query;

    const where: Prisma.PdfTemplateWhereInput = {
      OR: [
        { tenantId: user.tenantId },
        ...(includeGlobal !== false ? [{ isGlobal: true }] : []),
      ],
      ...(search && {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }),
      ...(entitySlug && { entitySlug }),
      ...(category && { category }),
      ...(isPublished !== undefined && { isPublished }),
    };

    const [data, total] = await Promise.all([
      this.prisma.pdfTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          entity: {
            select: { id: true, name: true, slug: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          _count: {
            select: { generations: true },
          },
        },
      }),
      this.prisma.pdfTemplate.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: CurrentUser) {
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        OR: [
          { tenantId: user.tenantId },
          { isGlobal: true },
        ],
      },
      include: {
        entity: {
          select: { id: true, name: true, slug: true, fields: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        clonedFrom: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { generations: true, clones: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    return template;
  }

  async findBySlug(slug: string, user: CurrentUser) {
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        slug,
        OR: [
          { tenantId: user.tenantId },
          { isGlobal: true },
        ],
      },
      include: {
        entity: {
          select: { id: true, name: true, slug: true, fields: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template "${slug}" nao encontrado`);
    }

    return template;
  }

  async update(id: string, dto: UpdatePdfTemplateDto, user: CurrentUser) {
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    // Templates de sistema nao podem ser editados (exceto por PLATFORM_ADMIN)
    if (template.isSystem && user.customRole.roleType !== 'PLATFORM_ADMIN') {
      throw new ForbiddenException('Templates de sistema nao podem ser editados');
    }

    // Se mudou entitySlug, buscar entityId
    let entityId = template.entityId;
    if (dto.entitySlug !== undefined && dto.entitySlug !== template.entitySlug) {
      if (dto.entitySlug) {
        const entity = await this.prisma.entity.findFirst({
          where: {
            tenantId: user.tenantId,
            slug: dto.entitySlug,
          },
        });
        if (!entity) {
          throw new NotFoundException(`Entidade "${dto.entitySlug}" nao encontrada`);
        }
        entityId = entity.id;
      } else {
        entityId = null;
      }
    }

    // Se mudou slug, verificar se ja existe
    if (dto.slug && dto.slug !== template.slug) {
      const existing = await this.prisma.pdfTemplate.findUnique({
        where: {
          tenantId_slug: {
            tenantId: user.tenantId,
            slug: dto.slug,
          },
        },
      });
      if (existing) {
        throw new ConflictException(`Template com slug "${dto.slug}" ja existe`);
      }
    }

    const updateData: Prisma.PdfTemplateUpdateInput = {};

    if (dto.name) updateData.name = dto.name;
    if (dto.slug) updateData.slug = dto.slug;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.entitySlug !== undefined) {
      updateData.entitySlug = dto.entitySlug;
      if (entityId) {
        updateData.entity = { connect: { id: entityId } };
      } else {
        updateData.entity = { disconnect: true };
      }
    }
    if (dto.basePdf) updateData.basePdf = dto.basePdf as Prisma.InputJsonValue;
    if (dto.schemas) updateData.schemas = dto.schemas as Prisma.InputJsonValue;
    if (dto.settings) updateData.settings = dto.settings as Prisma.InputJsonValue;
    if (dto.isPublished !== undefined) {
      updateData.isPublished = dto.isPublished;
      updateData.publishedAt = dto.isPublished ? new Date() : null;
    }

    return this.prisma.pdfTemplate.update({
      where: { id },
      data: updateData,
      include: {
        entity: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async publish(id: string, user: CurrentUser) {
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    return this.prisma.pdfTemplate.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async unpublish(id: string, user: CurrentUser) {
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    return this.prisma.pdfTemplate.update({
      where: { id },
      data: {
        isPublished: false,
      },
    });
  }

  async duplicate(id: string, user: CurrentUser) {
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        OR: [
          { tenantId: user.tenantId },
          { isGlobal: true },
        ],
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    // Gerar novo slug unico
    let newSlug = `${template.slug}-copia`;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.pdfTemplate.findUnique({
        where: {
          tenantId_slug: {
            tenantId: user.tenantId,
            slug: newSlug,
          },
        },
      });
      if (!existing) break;
      newSlug = `${template.slug}-copia-${counter++}`;
    }

    // Se entitySlug do template original, verificar se existe no tenant
    let entityId: string | null = null;
    if (template.entitySlug) {
      const entity = await this.prisma.entity.findFirst({
        where: {
          tenantId: user.tenantId,
          slug: template.entitySlug,
        },
      });
      if (entity) {
        entityId = entity.id;
      }
    }

    return this.prisma.pdfTemplate.create({
      data: {
        tenantId: user.tenantId,
        name: `${template.name} (Copia)`,
        slug: newSlug,
        description: template.description,
        icon: template.icon,
        category: template.category,
        entityId,
        entitySlug: template.entitySlug,
        basePdf: (template.basePdf ?? {}) as Prisma.InputJsonValue,
        schemas: (template.schemas ?? []) as Prisma.InputJsonValue,
        settings: (template.settings ?? {}) as Prisma.InputJsonValue,
        isPublished: false,
        clonedFromId: template.id,
        createdById: user.id,
      },
      include: {
        entity: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        clonedFrom: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async remove(id: string, user: CurrentUser) {
    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    // Templates de sistema nao podem ser deletados
    if (template.isSystem) {
      throw new ForbiddenException('Templates de sistema nao podem ser deletados');
    }

    await this.prisma.pdfTemplate.delete({ where: { id } });

    return { message: 'Template removido com sucesso' };
  }

  async findByEntity(entitySlug: string, user: CurrentUser) {
    return this.prisma.pdfTemplate.findMany({
      where: {
        entitySlug,
        isPublished: true,
        OR: [
          { tenantId: user.tenantId },
          { isGlobal: true },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        category: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
