import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityService } from '../entity/entity.service';
import { UserRole, Prisma, EntityData, Entity } from '@prisma/client';
import { CurrentUser } from '../../common/types';

interface CreateDataDto {
  data: Record<string, unknown>;
}

interface QueryDataDto {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface EntitySettings {
  searchFields?: string[];
  titleField?: string;
  subtitleField?: string;
}

interface EntityField {
  slug: string;
  name: string;
  type: string;
  required?: boolean;
}

// Cache for entity lookups within a request (reduces duplicate queries)
const entityCache = new Map<string, { entity: Entity; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

@Injectable()
export class DataService {
  constructor(
    private prisma: PrismaService,
    private entityService: EntityService,
  ) {}

  // Get entity with short-lived cache to avoid duplicate queries within same request
  private async getEntityCached(workspaceId: string, entitySlug: string, currentUser: CurrentUser): Promise<Entity> {
    const cacheKey = `${workspaceId}:${entitySlug}:${currentUser.tenantId}`;
    const cached = entityCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.entity;
    }

    const entity = await this.entityService.findBySlug(workspaceId, entitySlug, currentUser);
    entityCache.set(cacheKey, { entity, timestamp: Date.now() });

    // Clean old entries periodically
    if (entityCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of entityCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          entityCache.delete(key);
        }
      }
    }

    return entity;
  }

  async create(entitySlug: string, workspaceId: string, dto: CreateDataDto, currentUser: CurrentUser) {
    // Buscar entidade (cached)
    const entity = await this.getEntityCached(workspaceId, entitySlug, currentUser);

    // Validar dados
    const fields = (entity.fields as unknown) as EntityField[];
    const errors = this.entityService.validateData(fields, dto.data as Record<string, unknown> || {});
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return this.prisma.entityData.create({
      data: {
        tenantId: currentUser.tenantId,
        entityId: entity.id,
        data: (dto.data || {}) as Prisma.InputJsonValue,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
    });
  }

  async findAll(
    entitySlug: string,
    workspaceId: string,
    query: QueryDataDto,
    currentUser: CurrentUser,
  ) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    // Buscar entidade (cached)
    const entity = await this.getEntityCached(workspaceId, entitySlug, currentUser);

    // Base where
    const where: Prisma.EntityDataWhereInput = {
      tenantId: currentUser.tenantId,
      entityId: entity.id,
    };

    // Aplicar filtro de escopo baseado na role
    this.applyScope(where, currentUser, 'read');

    // Busca textual
    if (search) {
      // Buscar em campos de busca configurados na entidade
      const settings = entity.settings as EntitySettings;
      const searchFields = settings?.searchFields || [];
      
      if (searchFields.length > 0) {
        where.OR = searchFields.map((field: string) => ({
          data: {
            path: [field],
            string_contains: search,
            mode: 'insensitive',
          },
        }));
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.entityData.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          updatedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.entityData.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      entity: {
        id: entity.id,
        name: entity.name,
        namePlural: entity.namePlural,
        slug: entity.slug,
        fields: entity.fields,
        settings: entity.settings,
      },
    };
  }

  async findOne(entitySlug: string, workspaceId: string, id: string, currentUser: CurrentUser) {
    const entity = await this.getEntityCached(workspaceId, entitySlug, currentUser);

    const record = await this.prisma.entityData.findFirst({
      where: {
        id,
        entityId: entity.id,
        tenantId: currentUser.tenantId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Registro não encontrado');
    }

    return {
      ...record,
      entity: {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        fields: entity.fields,
      },
    };
  }

  async update(entitySlug: string, workspaceId: string, id: string, dto: CreateDataDto, currentUser: CurrentUser) {
    const entity = await this.getEntityCached(workspaceId, entitySlug, currentUser);

    // Buscar registro
    const record = await this.prisma.entityData.findFirst({
      where: {
        id,
        entityId: entity.id,
        tenantId: currentUser.tenantId,
      },
    });

    if (!record) {
      throw new NotFoundException('Registro nao encontrado');
    }

    // Verificar permissão de escopo
    this.checkScope(record, currentUser, 'update');

    // Validar dados
    const fields = (entity.fields as unknown) as EntityField[];
    const errors = this.entityService.validateData(fields, dto.data as Record<string, unknown> || {});
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    // Merge dos dados existentes com os novos
    const mergedData = {
      ...(record.data as Record<string, unknown>),
      ...dto.data,
    };

    return this.prisma.entityData.update({
      where: { id },
      data: {
        data: mergedData as Prisma.InputJsonValue,
        updatedById: currentUser.id,
      },
    });
  }

  async remove(entitySlug: string, workspaceId: string, id: string, currentUser: CurrentUser) {
    const entity = await this.getEntityCached(workspaceId, entitySlug, currentUser);

    const record = await this.prisma.entityData.findFirst({
      where: {
        id,
        entityId: entity.id,
        tenantId: currentUser.tenantId,
      },
    });

    if (!record) {
      throw new NotFoundException('Registro não encontrado');
    }

    // Verificar permissão de escopo
    this.checkScope(record, currentUser, 'delete');

    await this.prisma.entityData.delete({ where: { id } });

    return { message: 'Registro excluído com sucesso' };
  }

  // Aplicar filtros de escopo na query
  private applyScope(where: Prisma.EntityDataWhereInput, user: CurrentUser, action: string) {
    // Admin e Platform Admin veem tudo
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      return;
    }

    // Manager vê tudo do tenant (para leitura)
    if (user.role === UserRole.MANAGER && action === 'read') {
      return;
    }

    // User e Viewer veem apenas da equipe (organização)
    if (user.organizationId) {
      // Buscar usuários da mesma organização
      where.createdBy = {
        organizationId: user.organizationId,
      };
    }
  }

  // Verificar se usuario pode modificar o registro
  private checkScope(record: EntityData, user: CurrentUser, action: string) {
    // Admin e Platform Admin podem tudo
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      return;
    }

    // Viewer não pode modificar
    if (user.role === UserRole.VIEWER) {
      throw new ForbiddenException('Você não tem permissão para modificar registros');
    }

    // Manager pode modificar registros da equipe
    if (user.role === UserRole.MANAGER) {
      // Para simplificar, permitimos se está no mesmo tenant
      // Em produção, verificar se createdBy está na mesma organização
      return;
    }

    // User só pode modificar próprios registros
    if (user.role === UserRole.USER) {
      if (record.createdById !== user.id) {
        throw new ForbiddenException('Você só pode modificar registros criados por você');
      }
    }
  }
}
