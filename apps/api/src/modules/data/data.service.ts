import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityService } from '../entity/entity.service';
import { UserRole, Prisma, EntityData, Entity } from '@prisma/client';
import { CurrentUser } from '../../common/types';

interface CreateDataDto {
  data: Record<string, unknown>;
  parentRecordId?: string;
}

// Interface para campos do inputSchema da Custom API
interface CustomApiFieldConfig {
  fieldSlug: string;
  enabled: boolean;
  valueMode: 'manual' | 'auto';
  manualValue?: unknown;
  dynamicValue?: string;
}

interface CustomApiInputSchema {
  _v?: number;
  selectedFields?: CustomApiFieldConfig[];
}

interface QueryDataDto {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  tenantId?: string; // Para PLATFORM_ADMIN filtrar por tenant
  parentRecordId?: string; // Para filtrar sub-registros de um registro pai
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
  private readonly logger = new Logger(DataService.name);

  constructor(
    private prisma: PrismaService,
    private entityService: EntityService,
  ) {}

  // Verifica se o usuario tem permissao especifica para a entidade atraves das roles customizadas
  private async checkEntityPermission(
    entityId: string,
    tenantId: string,
    userId: string,
    action: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete',
  ): Promise<boolean> {
    // Busca todas as roles customizadas do usuario que tem permissao para a entidade
    const userRolesWithEntityPerms = await this.prisma.userRole_.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            entityPermissions: {
              where: {
                entityId,
                tenantId,
              },
            },
          },
        },
      },
    });

    // Verifica se alguma role tem a permissao especifica
    for (const userRole of userRolesWithEntityPerms) {
      const entityPerm = userRole.role.entityPermissions[0];
      if (entityPerm && entityPerm[action]) {
        return true;
      }
    }

    return false;
  }

  // Verifica se existe qualquer restricao de entidade configurada para o usuario
  private async hasEntityRestrictions(userId: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.entityPermission.count({
      where: {
        tenantId,
        role: {
          users: {
            some: { userId },
          },
        },
      },
    });
    return count > 0;
  }

  // Busca Custom API configurada para a entidade (POST para create, PATCH para update)
  private async findCustomApiForEntity(
    entityId: string,
    tenantId: string,
    method: 'POST' | 'PATCH',
  ) {
    return this.prisma.customEndpoint.findFirst({
      where: {
        tenantId,
        sourceEntityId: entityId,
        method,
        isActive: true,
        mode: 'visual',
      },
    });
  }

  // Resolve valores dinamicos ({{user.email}}, {{now}}, etc)
  private resolveDynamicValue(template: string, user: CurrentUser): unknown {
    if (!template) return undefined;

    const now = new Date();
    const values: Record<string, unknown> = {
      'user.id': user.id,
      'user.email': user.email,
      'user.name': user.name,
      'user.role': user.role,
      'user.tenantId': user.tenantId,
      'now': now.toISOString(),
      'today': now.toISOString().split('T')[0],
      'timestamp': now.getTime(),
      'true': true,
      'false': false,
    };

    // Se template e exatamente um placeholder, retornar valor diretamente
    const singleMatch = template.match(/^\{\{(.+?)\}\}$/);
    if (singleMatch) {
      const key = singleMatch[1].trim();
      return values[key];
    }

    // Se template tem multiplos placeholders ou texto misto, substituir todos
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${key.replace('.', '\\.')}\\s*\\}\\}`, 'g'), String(value ?? ''));
    }

    return result;
  }

  // Aplica valores da Custom API aos dados
  private async applyCustomApiValues(
    data: Record<string, unknown>,
    entityId: string,
    tenantId: string,
    user: CurrentUser,
    method: 'POST' | 'PATCH',
  ): Promise<Record<string, unknown>> {
    const customApi = await this.findCustomApiForEntity(entityId, tenantId, method);

    if (!customApi) {
      return data;
    }

    const inputSchema = customApi.requestSchema as CustomApiInputSchema | null;
    const schemaFields = inputSchema?.selectedFields || [];

    if (schemaFields.length === 0) {
      return data;
    }

    const result = { ...data };

    for (const field of schemaFields) {
      if (!field.enabled) continue;

      switch (field.valueMode) {
        case 'auto':
          if (field.dynamicValue) {
            const resolvedValue = this.resolveDynamicValue(field.dynamicValue, user);
            if (resolvedValue !== undefined) {
              result[field.fieldSlug] = resolvedValue;
              this.logger.debug(`Custom API auto field: ${field.fieldSlug} = ${resolvedValue}`);
            }
          }
          break;

        case 'manual':
          if (field.manualValue !== undefined) {
            result[field.fieldSlug] = field.manualValue;
            this.logger.debug(`Custom API manual field: ${field.fieldSlug} = ${field.manualValue}`);
          }
          break;
      }
    }

    this.logger.log(`Applied Custom API values for entity ${entityId}: ${schemaFields.filter(f => f.enabled).map(f => f.fieldSlug).join(', ')}`);

    return result;
  }

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

    // Verificar permissao de entidade (exceto admins)
    if (currentUser.role !== UserRole.PLATFORM_ADMIN && currentUser.role !== UserRole.ADMIN) {
      const hasRestrictions = await this.hasEntityRestrictions(currentUser.id, targetTenantId);
      if (hasRestrictions) {
        const hasPermission = await this.checkEntityPermission(entity.id, targetTenantId, currentUser.id, 'canCreate');
        if (!hasPermission) {
          throw new ForbiddenException('Voce nao tem permissao para criar registros nesta entidade');
        }
      }
    }

    // Aplicar valores da Custom API (se existir)
    const dataWithCustomApi = await this.applyCustomApiValues(
      dto.data as Record<string, unknown> || {},
      entity.id,
      targetTenantId,
      currentUser,
      'POST',
    );

    // Validar dados (apos aplicar Custom API para incluir campos automaticos)
    const fields = (entity.fields as unknown) as EntityField[];
    const errors = this.entityService.validateData(fields, dataWithCustomApi);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return this.prisma.entityData.create({
      data: {
        tenantId: targetTenantId,
        entityId: entity.id,
        data: dataWithCustomApi as Prisma.InputJsonValue,
        parentRecordId: dto.parentRecordId || null,
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
    // Parse page and limit as integers (query params come as strings)
    const page = parseInt(String(query.page || '1'), 10) || 1;
    const limit = parseInt(String(query.limit || '20'), 10) || 20;
    const { search, sortBy = 'createdAt', sortOrder = 'desc', tenantId: queryTenantId, parentRecordId } = query;
    const skip = (page - 1) * limit;

    const effectiveTenantId = this.getEffectiveTenantId(currentUser, queryTenantId);

    // Buscar entidade (cached)
    const entity = await this.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // Verificar permissao de entidade para leitura (exceto admins)
    if (currentUser.role !== UserRole.PLATFORM_ADMIN && currentUser.role !== UserRole.ADMIN) {
      const hasRestrictions = await this.hasEntityRestrictions(currentUser.id, effectiveTenantId);
      if (hasRestrictions) {
        const hasPermission = await this.checkEntityPermission(entity.id, effectiveTenantId, currentUser.id, 'canRead');
        if (!hasPermission) {
          throw new ForbiddenException('Voce nao tem permissao para visualizar registros desta entidade');
        }
      }
    }

    // Base where
    const where: Prisma.EntityDataWhereInput = {
      entityId: entity.id,
    };

    // Filtro de sub-entidade: se parentRecordId for passado, retorna apenas sub-registros
    // Se não for passado, retorna apenas registros raiz (sem parentRecordId)
    if (parentRecordId) {
      where.parentRecordId = parentRecordId;
    } else {
      where.parentRecordId = null;
    }

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

    // Verificar permissao de entidade para leitura (exceto admins)
    if (currentUser.role !== UserRole.PLATFORM_ADMIN && currentUser.role !== UserRole.ADMIN) {
      const hasRestrictions = await this.hasEntityRestrictions(currentUser.id, effectiveTenantId);
      if (hasRestrictions) {
        const hasPermission = await this.checkEntityPermission(entity.id, effectiveTenantId, currentUser.id, 'canRead');
        if (!hasPermission) {
          throw new ForbiddenException('Voce nao tem permissao para visualizar registros desta entidade');
        }
      }
    }

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

    // Verificar permissao de entidade para atualizacao (exceto admins)
    if (currentUser.role !== UserRole.PLATFORM_ADMIN && currentUser.role !== UserRole.ADMIN) {
      const hasRestrictions = await this.hasEntityRestrictions(currentUser.id, effectiveTenantId);
      if (hasRestrictions) {
        const hasPermission = await this.checkEntityPermission(entity.id, effectiveTenantId, currentUser.id, 'canUpdate');
        if (!hasPermission) {
          throw new ForbiddenException('Voce nao tem permissao para atualizar registros desta entidade');
        }
      }
    }

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

    // Aplicar valores da Custom API (se existir) - usa PATCH para update
    const dataWithCustomApi = await this.applyCustomApiValues(
      dto.data as Record<string, unknown> || {},
      entity.id,
      effectiveTenantId,
      currentUser,
      'PATCH',
    );

    // Validar dados (apos aplicar Custom API)
    const fields = (entity.fields as unknown) as EntityField[];
    const errors = this.entityService.validateData(fields, dataWithCustomApi);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    // Merge dos dados existentes com os novos (incluindo Custom API)
    const mergedData = {
      ...(record.data as Record<string, unknown>),
      ...dataWithCustomApi,
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

    // Verificar permissao de entidade para exclusao (exceto admins)
    if (currentUser.role !== UserRole.PLATFORM_ADMIN && currentUser.role !== UserRole.ADMIN) {
      const hasRestrictions = await this.hasEntityRestrictions(currentUser.id, effectiveTenantId);
      if (hasRestrictions) {
        const hasPermission = await this.checkEntityPermission(entity.id, effectiveTenantId, currentUser.id, 'canDelete');
        if (!hasPermission) {
          throw new ForbiddenException('Voce nao tem permissao para excluir registros desta entidade');
        }
      }
    }

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

    // Para leitura, todos os usuarios do tenant podem ver todos os dados do tenant
    // O filtro por tenantId ja foi aplicado antes desta funcao
    if (action === 'read') {
      return;
    }

    // Para escrita (update/delete), apenas o criador pode modificar (exceto Manager)
    if (user.role === UserRole.MANAGER) {
      return;
    }

    // User so pode modificar proprios registros
    // Viewer nao pode modificar (tratado em checkScope)
    if (action !== 'read') {
      where.createdById = user.id;
    }
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
