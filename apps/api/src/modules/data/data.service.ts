import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityService } from '../entity/entity.service';
import { NotificationService } from '../notification/notification.service';
import { CustomRoleService } from '../custom-role/custom-role.service';
import { UserRole, Prisma, EntityData, Entity } from '@prisma/client';
import {
  CurrentUser,
  createPaginationMeta,
  encodeCursor,
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../common/types';

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
  // Cursor pagination (melhor performance para listas grandes)
  cursor?: string;
  // Sparse fieldsets - reduz payload
  fields?: string; // Ex: "id,data,createdAt"
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
    private notificationService: NotificationService,
    private customRoleService: CustomRoleService,
  ) {}

  /**
   * Verifica se usuario tem permissao para acao na entidade
   * Lanca ForbiddenException se nao tiver
   */
  private async checkEntityPermission(
    userId: string,
    entitySlug: string,
    action: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete',
  ): Promise<void> {
    const hasPermission = await this.customRoleService.hasEntityPermission(userId, entitySlug, action);
    if (!hasPermission) {
      const actionLabels = {
        canCreate: 'criar registros em',
        canRead: 'visualizar',
        canUpdate: 'editar registros em',
        canDelete: 'excluir registros em',
      };
      throw new ForbiddenException(
        `Voce nao tem permissao para ${actionLabels[action]} "${entitySlug}"`,
      );
    }
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
    // Para PLATFORM_ADMIN sem tenantId especificado, buscar em qualquer tenant
    const effectiveTenantId = currentUser.role === UserRole.PLATFORM_ADMIN && !tenantId
      ? undefined
      : this.getEffectiveTenantId(currentUser, tenantId);
    const cacheKey = `${entitySlug}:${effectiveTenantId || 'any'}`;
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
    // Verificar permissao de criacao na entidade
    await this.checkEntityPermission(currentUser.id, entitySlug, 'canCreate');

    const targetTenantId = this.getEffectiveTenantId(currentUser, dto.tenantId);

    // Buscar entidade (cached)
    const entity = await this.getEntityCached(entitySlug, currentUser, targetTenantId);

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

    const record = await this.prisma.entityData.create({
      data: {
        tenantId: targetTenantId,
        entityId: entity.id,
        data: dataWithCustomApi as Prisma.InputJsonValue,
        parentRecordId: dto.parentRecordId || null,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
    });

    // Enviar notificacao para o tenant
    const settings = entity.settings as EntitySettings;
    const titleField = settings?.titleField || 'nome';
    const recordName = String((dataWithCustomApi as Record<string, unknown>)[titleField] || record.id);

    this.notificationService.notifyRecordCreated(
      targetTenantId,
      entity.name,
      recordName,
      currentUser.name,
    ).catch((err) => this.logger.error('Failed to send notification', err));

    return record;
  }

  async findAll(
    entitySlug: string,
    query: QueryDataDto,
    currentUser: CurrentUser,
  ) {
    // Verificar permissao de leitura na entidade
    await this.checkEntityPermission(currentUser.id, entitySlug, 'canRead');

    // Parse parameters
    const page = parseInt(String(query.page || '1'), 10) || 1;
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(query.limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
    const { search, sortBy = 'createdAt', sortOrder = 'desc', tenantId: queryTenantId, parentRecordId, cursor, fields } = query;

    const effectiveTenantId = this.getEffectiveTenantId(currentUser, queryTenantId);

    // Buscar entidade (cached)
    const entity = await this.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // Base where
    const where: Prisma.EntityDataWhereInput = {
      entityId: entity.id,
    };

    // Filtro de sub-entidade: se parentRecordId for passado, retorna apenas sub-registros
    // Se nao for passado, retorna apenas registros raiz (sem parentRecordId)
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

    // =========================================================================
    // CURSOR-BASED PAGINATION (mais eficiente para listas grandes)
    // =========================================================================
    const useCursor = !!cursor;
    let cursorClause: { id: string } | undefined;
    let skipClause: number | undefined;

    if (useCursor) {
      const decodedCursor = decodeCursor(cursor);
      if (decodedCursor) {
        cursorClause = { id: decodedCursor.id };
        skipClause = 1; // Pula o item do cursor
      }
    } else {
      // Offset pagination tradicional
      skipClause = (page - 1) * limit;
    }

    // OrderBy com id como tiebreaker para estabilidade
    const orderBy: Prisma.EntityDataOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
    ];
    if (sortBy !== 'id') {
      orderBy.push({ id: sortOrder });
    }

    // =========================================================================
    // EXECUTAR QUERIES EM PARALELO
    // =========================================================================
    // Para cursor pagination, buscamos limit + 1 para saber se tem mais paginas
    const takeWithExtra = limit + 1;

    // Include padrao para relacionamentos
    const includeClause = {
      tenant: {
        select: { id: true, name: true, slug: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      updatedBy: {
        select: { id: true, name: true, email: true },
      },
    };

    // Construir query base
    const findManyArgs: Prisma.EntityDataFindManyArgs = {
      where,
      take: takeWithExtra,
      orderBy,
      include: includeClause,
    };

    // Adicionar cursor ou skip
    if (useCursor && cursorClause) {
      findManyArgs.cursor = cursorClause;
      findManyArgs.skip = 1;
    } else {
      findManyArgs.skip = skipClause;
    }

    const [rawData, total] = await Promise.all([
      this.prisma.entityData.findMany(findManyArgs),
      // Count pode ser custoso para datasets grandes - usar estimativa se necessario
      this.prisma.entityData.count({ where }),
    ]);

    // Verificar se tem proxima pagina
    const hasNextPage = rawData.length > limit;
    const data = hasNextPage ? rawData.slice(0, limit) : rawData;
    const hasPreviousPage = useCursor ? true : page > 1;

    // Gerar cursores para navegacao
    let nextCursor: string | undefined;
    let previousCursor: string | undefined;

    if (data.length > 0) {
      const lastItem = data[data.length - 1];
      const firstItem = data[0];

      if (hasNextPage) {
        nextCursor = encodeCursor({
          id: lastItem.id,
          sortField: sortBy,
          sortValue: (lastItem as Record<string, unknown>)[sortBy] as string,
        });
      }

      if (hasPreviousPage && useCursor) {
        previousCursor = encodeCursor({
          id: firstItem.id,
          sortField: sortBy,
          sortValue: (firstItem as Record<string, unknown>)[sortBy] as string,
        });
      }
    }

    return {
      data,
      meta: createPaginationMeta(total, page, limit, {
        hasNextPage,
        hasPreviousPage,
        nextCursor,
        previousCursor,
      }),
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
    // Verificar permissao de leitura na entidade
    await this.checkEntityPermission(currentUser.id, entitySlug, 'canRead');

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
    // Verificar permissao de edicao na entidade
    await this.checkEntityPermission(currentUser.id, entitySlug, 'canUpdate');

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

    const updatedRecord = await this.prisma.entityData.update({
      where: { id },
      data: {
        data: mergedData as Prisma.InputJsonValue,
        updatedById: currentUser.id,
      },
    });

    // Enviar notificacao para o tenant
    const settings = entity.settings as EntitySettings;
    const titleField = settings?.titleField || 'nome';
    const recordName = String((mergedData as Record<string, unknown>)[titleField] || record.id);

    this.notificationService.notifyRecordUpdated(
      effectiveTenantId,
      entity.name,
      recordName,
      currentUser.name,
    ).catch((err) => this.logger.error('Failed to send notification', err));

    return updatedRecord;
  }

  async remove(entitySlug: string, id: string, currentUser: CurrentUser, tenantId?: string) {
    // Verificar permissao de exclusao na entidade
    await this.checkEntityPermission(currentUser.id, entitySlug, 'canDelete');

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

    // Extrair nome do registro antes de deletar
    const settings = entity.settings as EntitySettings;
    const titleField = settings?.titleField || 'nome';
    const recordData = record.data as Record<string, unknown>;
    const recordName = String(recordData[titleField] || record.id);

    await this.prisma.entityData.delete({ where: { id } });

    // Enviar notificacao para o tenant
    this.notificationService.notifyRecordDeleted(
      effectiveTenantId,
      entity.name,
      recordName,
      currentUser.name,
    ).catch((err) => this.logger.error('Failed to send notification', err));

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
