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
  tenantId?: string; // Para PLATFORM_ADMIN filtrar por tenant
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

  // Helper para determinar o tenantId efetivo (PLATFORM_ADMIN pode acessar qualquer tenant)
  private getEffectiveTenantId(currentUser: CurrentUser, requestedTenantId?: string): string {
    if (currentUser.role === UserRole.PLATFORM_ADMIN && requestedTenantId) {
      return requestedTenantId;
    }
    return currentUser.tenantId;
  }

  // Get entity with short-lived cache to avoid duplicate queries within same request
  private async getEntityCached(entitySlug: string, currentUser: CurrentUser, tenantId?: string): Promise<Entity> {
    const effectiveTenantId = this.getEffectiveTenantId(currentUser, tenantId);
    const cacheKey = `${entitySlug}:${effectiveTenantId}`;
    const cached = entityCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.entity;
    }

    const entity = await this.entityService.findBySlug(entitySlug, currentUser, effectiveTenantId);
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

  async create(entitySlug: string, dto: CreateDataDto & { tenantId?: string }, currentUser: CurrentUser) {
    const targetTenantId = this.getEffectiveTenantId(currentUser, dto.tenantId);
    
    // Buscar entidade (cached)
    const entity = await this.getEntityCached(entitySlug, currentUser, targetTenantId);

    // Validar dados
    const fields = (entity.fields as unknown) as EntityField[];
    const errors = this.entityService.validateData(fields, dto.data as Record<string, unknown> || {});
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return this.prisma.entityData.create({
      data: {
        tenantId: targetTenantId,
        entityId: entity.id,
        data: (dto.data || {}) as Prisma.InputJsonValue,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
    });
  }

  async findAll(
    entitySlug: string,
    query: QueryDataDto,
    currentUser: CurrentUser,
  ) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc', tenantId: queryTenantId } = query;
    const skip = (page - 1) * limit;
    
    const effectiveTenantId = this.getEffectiveTenantId(currentUser, queryTenantId);

    // Buscar entidade (cached)
    const entity = await this.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // Base where
    const where: Prisma.EntityDataWhereInput = {
      entityId: entity.id,
    };

    // PLATFORM_ADMIN pode ver de qualquer tenant ou todos
    if (currentUser.role === UserRole.PLATFORM_ADMIN) {
      if (queryTenantId) {
        where.tenantId = queryTenantId;
      }
    } else {
      where.tenantId = currentUser.tenantId;
    }

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
          tenant: {
            select: { id: true, name: true, slug: true },
          },
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

  async findOne(entitySlug: string, id: string, currentUser: CurrentUser, tenantId?: string) {
    const effectiveTenantId = this.getEffectiveTenantId(currentUser, tenantId);
    const entity = await this.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // PLATFORM_ADMIN pode ver registro de qualquer tenant
    const whereClause: Prisma.EntityDataWhereInput = {
      id,
      entityId: entity.id,
    };
    
    if (currentUser.role !== UserRole.PLATFORM_ADMIN) {
      whereClause.tenantId = currentUser.tenantId;
    }

    const record = await this.prisma.entityData.findFirst({
      where: whereClause,
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Registro nao encontrado');
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

  async update(entitySlug: string, id: string, dto: CreateDataDto & { tenantId?: string }, currentUser: CurrentUser) {
    const effectiveTenantId = this.getEffectiveTenantId(currentUser, dto.tenantId);
    const entity = await this.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // PLATFORM_ADMIN pode editar registro de qualquer tenant
    const whereClause: Prisma.EntityDataWhereInput = {
      id,
      entityId: entity.id,
    };
    
    if (currentUser.role !== UserRole.PLATFORM_ADMIN) {
      whereClause.tenantId = currentUser.tenantId;
    }

    // Buscar registro
    const record = await this.prisma.entityData.findFirst({
      where: whereClause,
    });

    if (!record) {
      throw new NotFoundException('Registro nao encontrado');
    }

    // Verificar permissao de escopo (exceto PLATFORM_ADMIN)
    if (currentUser.role !== UserRole.PLATFORM_ADMIN) {
      this.checkScope(record, currentUser, 'update');
    }

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

  async remove(entitySlug: string, id: string, currentUser: CurrentUser, tenantId?: string) {
    const effectiveTenantId = this.getEffectiveTenantId(currentUser, tenantId);
    const entity = await this.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // PLATFORM_ADMIN pode deletar registro de qualquer tenant
    const whereClause: Prisma.EntityDataWhereInput = {
      id,
      entityId: entity.id,
    };
    
    if (currentUser.role !== UserRole.PLATFORM_ADMIN) {
      whereClause.tenantId = currentUser.tenantId;
    }

    const record = await this.prisma.entityData.findFirst({
      where: whereClause,
    });

    if (!record) {
      throw new NotFoundException('Registro nao encontrado');
    }

    // Verificar permissao de escopo (exceto PLATFORM_ADMIN)
    if (currentUser.role !== UserRole.PLATFORM_ADMIN) {
      this.checkScope(record, currentUser, 'delete');
    }

    await this.prisma.entityData.delete({ where: { id } });

    return { message: 'Registro excluido com sucesso' };
  }

  // Aplicar filtros de escopo na query
  private applyScope(where: Prisma.EntityDataWhereInput, user: CurrentUser, action: string) {
    // Admin e Platform Admin veem tudo
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      return;
    }

    // Manager ve tudo do tenant (para leitura)
    if (user.role === UserRole.MANAGER && action === 'read') {
      return;
    }

    // User e Viewer veem apenas seus proprios registros
    where.createdById = user.id;
  }

  // Verificar se usuario pode modificar o registro
  private checkScope(record: EntityData, user: CurrentUser, action: string) {
    // Admin e Platform Admin podem tudo
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      return;
    }

    // Viewer nao pode modificar
    if (user.role === UserRole.VIEWER) {
      throw new ForbiddenException('Voce nao tem permissao para modificar registros');
    }

    // Manager pode modificar registros do tenant
    if (user.role === UserRole.MANAGER) {
      return;
    }

    // User so pode modificar proprios registros
    if (user.role === UserRole.USER) {
      if (record.createdById !== user.id) {
        throw new ForbiddenException('Voce so pode modificar registros criados por voce');
      }
    }
  }
}
