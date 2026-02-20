import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, PdfTemplate, PdfPageSize, PdfOrientation } from '@prisma/client';
import {
  CurrentUser,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  encodeCursor,
  decodeCursor,
  createPaginationMeta,
} from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { CreatePdfTemplateDto } from './dto/create-pdf-template.dto';
import { UpdatePdfTemplateDto } from './dto/update-pdf-template.dto';
import { QueryPdfTemplateDto } from './dto/query-pdf.dto';
import { PdfTemplateContent } from './interfaces/pdf-element.interface';

@Injectable()
export class PdfTemplateService {
  private readonly logger = new Logger(PdfTemplateService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Criar novo template
   */
  async create(dto: CreatePdfTemplateDto, currentUser: CurrentUser): Promise<PdfTemplate> {
    const targetTenantId = getEffectiveTenantId(currentUser, dto.tenantId);

    // Verificar se slug ja existe
    const existing = await this.prisma.pdfTemplate.findFirst({
      where: {
        tenantId: targetTenantId,
        slug: dto.slug,
      },
    });

    if (existing) {
      throw new ConflictException('Template com este slug ja existe');
    }

    // Validar entidade fonte se fornecida
    if (dto.sourceEntityId) {
      const entity = await this.prisma.entity.findFirst({
        where: {
          id: dto.sourceEntityId,
          tenantId: targetTenantId,
        },
      });

      if (!entity) {
        throw new NotFoundException('Entidade fonte nao encontrada');
      }
    }

    const template = await this.prisma.pdfTemplate.create({
      data: {
        tenantId: targetTenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        pageSize: dto.pageSize || PdfPageSize.A4,
        orientation: dto.orientation || PdfOrientation.PORTRAIT,
        margins: (dto.margins || { top: 70, right: 70, bottom: 70, left: 70 }) as unknown as Prisma.InputJsonValue,
        content: (dto.content || { body: [] }) as unknown as Prisma.InputJsonValue,
        sourceEntityId: dto.sourceEntityId,
        selectedFields: dto.selectedFields || [],
        logoUrl: dto.logoUrl,
        templateType: dto.templateType || 'single',
      },
      include: {
        sourceEntity: {
          select: {
            id: true,
            name: true,
            slug: true,
            fields: true,
          },
        },
      },
    });

    this.logger.log(`Template criado: ${template.id} (${template.name})`);
    return template;
  }

  /**
   * Listar templates do tenant
   */
  async findAll(currentUser: CurrentUser, query: QueryPdfTemplateDto) {
    const targetTenantId = getEffectiveTenantId(currentUser, query.tenantId);
    const limit = Math.min(parseInt(query.limit || String(DEFAULT_LIMIT)), MAX_LIMIT);

    const where: Prisma.PdfTemplateWhereInput = {
      tenantId: targetTenantId,
    };

    // Filtro por nome
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Filtro por entidade fonte
    if (query.sourceEntityId) {
      where.sourceEntityId = query.sourceEntityId;
    }

    // Filtro por tipo
    if (query.templateType) {
      where.templateType = query.templateType;
    }

    // Filtro por publicacao
    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }

    // Cursor para paginacao
    let cursor: Prisma.PdfTemplateWhereUniqueInput | undefined;
    if (query.cursor) {
      const decodedCursor = decodeCursor(query.cursor);
      if (decodedCursor) {
        cursor = { id: decodedCursor.id };
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.pdfTemplate.findMany({
        where,
        take: limit + 1,
        skip: cursor ? 1 : 0,
        cursor,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceEntity: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              generations: true,
            },
          },
        },
      }),
      this.prisma.pdfTemplate.count({ where }),
    ]);

    const hasMore = data.length > limit;
    if (hasMore) data.pop();

    const nextCursor = hasMore && data.length > 0 ? encodeCursor({ id: data[data.length - 1].id }) : null;

    return {
      data,
      meta: createPaginationMeta(total, 1, limit, {
        hasNextPage: hasMore,
        hasPreviousPage: !!cursor,
        nextCursor: nextCursor || undefined,
      }),
    };
  }

  /**
   * Buscar template por ID
   */
  async findOne(id: string, currentUser: CurrentUser, tenantId?: string): Promise<PdfTemplate> {
    const targetTenantId = getEffectiveTenantId(currentUser, tenantId);

    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        tenantId: targetTenantId,
      },
      include: {
        sourceEntity: {
          select: {
            id: true,
            name: true,
            slug: true,
            fields: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    return template;
  }

  /**
   * Buscar template por slug
   */
  async findBySlug(slug: string, currentUser: CurrentUser, tenantId?: string): Promise<PdfTemplate> {
    const targetTenantId = getEffectiveTenantId(currentUser, tenantId);

    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        slug,
        tenantId: targetTenantId,
      },
      include: {
        sourceEntity: {
          select: {
            id: true,
            name: true,
            slug: true,
            fields: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    return template;
  }

  /**
   * Atualizar template
   */
  async update(
    id: string,
    dto: UpdatePdfTemplateDto,
    currentUser: CurrentUser,
  ): Promise<PdfTemplate> {
    const targetTenantId = getEffectiveTenantId(currentUser, dto.tenantId);

    // Verificar se template existe
    const existing = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        tenantId: targetTenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Template nao encontrado');
    }

    // Verificar conflito de slug
    if (dto.slug && dto.slug !== existing.slug) {
      const slugConflict = await this.prisma.pdfTemplate.findFirst({
        where: {
          tenantId: targetTenantId,
          slug: dto.slug,
          id: { not: id },
        },
      });

      if (slugConflict) {
        throw new ConflictException('Template com este slug ja existe');
      }
    }

    // Validar entidade fonte se fornecida
    if (dto.sourceEntityId && dto.sourceEntityId !== existing.sourceEntityId) {
      const entity = await this.prisma.entity.findFirst({
        where: {
          id: dto.sourceEntityId,
          tenantId: targetTenantId,
        },
      });

      if (!entity) {
        throw new NotFoundException('Entidade fonte nao encontrada');
      }
    }

    const template = await this.prisma.pdfTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        pageSize: dto.pageSize,
        orientation: dto.orientation,
        margins: dto.margins as unknown as Prisma.InputJsonValue,
        content: dto.content as unknown as Prisma.InputJsonValue,
        sourceEntityId: dto.sourceEntityId,
        selectedFields: dto.selectedFields,
        logoUrl: dto.logoUrl,
        templateType: dto.templateType,
        version: { increment: 1 },
      },
      include: {
        sourceEntity: {
          select: {
            id: true,
            name: true,
            slug: true,
            fields: true,
          },
        },
      },
    });

    this.logger.log(`Template atualizado: ${template.id} (v${template.version})`);
    return template;
  }

  /**
   * Excluir template
   */
  async remove(id: string, currentUser: CurrentUser, tenantId?: string): Promise<void> {
    const targetTenantId = getEffectiveTenantId(currentUser, tenantId);

    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        tenantId: targetTenantId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    await this.prisma.pdfTemplate.delete({
      where: { id },
    });

    this.logger.log(`Template excluido: ${id}`);
  }

  /**
   * Duplicar template
   */
  async duplicate(id: string, currentUser: CurrentUser, tenantId?: string): Promise<PdfTemplate> {
    const targetTenantId = getEffectiveTenantId(currentUser, tenantId);

    const original = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        tenantId: targetTenantId,
      },
    });

    if (!original) {
      throw new NotFoundException('Template nao encontrado');
    }

    // Gerar novo slug unico
    let newSlug = `${original.slug}-copia`;
    let counter = 1;
    while (
      await this.prisma.pdfTemplate.findFirst({
        where: { tenantId: targetTenantId, slug: newSlug },
      })
    ) {
      newSlug = `${original.slug}-copia-${counter}`;
      counter++;
    }

    const duplicate = await this.prisma.pdfTemplate.create({
      data: {
        tenantId: targetTenantId,
        name: `${original.name} (Copia)`,
        slug: newSlug,
        description: original.description,
        icon: original.icon,
        pageSize: original.pageSize,
        orientation: original.orientation,
        margins: original.margins as Prisma.InputJsonValue,
        content: original.content as Prisma.InputJsonValue,
        sourceEntityId: original.sourceEntityId,
        selectedFields: original.selectedFields as Prisma.InputJsonValue,
        logoUrl: original.logoUrl,
        templateType: original.templateType,
        isPublished: false,
      },
      include: {
        sourceEntity: {
          select: {
            id: true,
            name: true,
            slug: true,
            fields: true,
          },
        },
      },
    });

    this.logger.log(`Template duplicado: ${original.id} -> ${duplicate.id}`);
    return duplicate;
  }

  /**
   * Publicar template
   */
  async publish(id: string, currentUser: CurrentUser, tenantId?: string): Promise<PdfTemplate> {
    const targetTenantId = getEffectiveTenantId(currentUser, tenantId);

    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        tenantId: targetTenantId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    // Validar que tem conteudo minimo
    const content = template.content as unknown as PdfTemplateContent;
    if (!content?.body || content.body.length === 0) {
      throw new ForbiddenException('Template deve ter pelo menos um elemento no body');
    }

    const updated = await this.prisma.pdfTemplate.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    this.logger.log(`Template publicado: ${id}`);
    return updated;
  }

  /**
   * Despublicar template
   */
  async unpublish(id: string, currentUser: CurrentUser, tenantId?: string): Promise<PdfTemplate> {
    const targetTenantId = getEffectiveTenantId(currentUser, tenantId);

    const template = await this.prisma.pdfTemplate.findFirst({
      where: {
        id,
        tenantId: targetTenantId,
      },
    });

    if (!template) {
      throw new NotFoundException('Template nao encontrado');
    }

    const updated = await this.prisma.pdfTemplate.update({
      where: { id },
      data: {
        isPublished: false,
      },
    });

    this.logger.log(`Template despublicado: ${id}`);
    return updated;
  }
}
