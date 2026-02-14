import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityService } from '../entity/entity.service';
import { NotificationService } from '../notification/notification.service';
import { CustomRoleService } from '../custom-role/custom-role.service';
import { Prisma, EntityData, Entity } from '@prisma/client';
import {
  CurrentUser,
  createPaginationMeta,
  encodeCursor,
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../common/types';
import { RoleType } from '../../common/decorators/roles.decorator';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';

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

export interface QueryDataDto {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  tenantId?: string; // Para PLATFORM_ADMIN filtrar por tenant
  parentRecordId?: string; // Para filtrar sub-registros de um registro pai
  includeChildren?: string; // 'true' para incluir registros filhos (sub-entidades)
  hasChildrenIn?: string; // ID da entidade filha - retorna apenas registros que tem filhos nessa entidade
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
  label?: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  subEntityId?: string;
  subEntitySlug?: string;
  parentDisplayField?: string;
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
      'user.roleType': user.customRole?.roleType,
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

  // Get entity with short-lived cache to avoid duplicate queries within same request
  private async getEntityCached(entitySlug: string, currentUser: CurrentUser, tenantId?: string): Promise<Entity> {
    // Para PLATFORM_ADMIN sem tenantId especificado, buscar em qualquer tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const effectiveTenantId = roleType === 'PLATFORM_ADMIN' && !tenantId
      ? undefined
      : getEffectiveTenantId(currentUser, tenantId);
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

    const targetTenantId = getEffectiveTenantId(currentUser, dto.tenantId);

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

    // Validar campos unicos
    await this.validateUniqueFields(fields, dataWithCustomApi, entity.id, targetTenantId);

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
    const { search, sortBy = 'createdAt', sortOrder = 'desc', tenantId: queryTenantId, parentRecordId, includeChildren, hasChildrenIn, cursor, fields } = query;

    const effectiveTenantId = getEffectiveTenantId(currentUser, queryTenantId);

    // Buscar entidade (cached)
    const entity = await this.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // Base where
    const where: Prisma.EntityDataWhereInput = {
      entityId: entity.id,
    };

    // Filtro: apenas registros que tem filhos em uma entidade especifica
    if (hasChildrenIn) {
      const parentIdsResult = await this.prisma.entityData.findMany({
        where: { entityId: hasChildrenIn, parentRecordId: { not: null } },
        select: { parentRecordId: true },
        distinct: ['parentRecordId'],
      });
      const parentIds = parentIdsResult.map(r => r.parentRecordId).filter(Boolean) as string[];
      where.id = { in: parentIds.length > 0 ? parentIds : ['__none__'] };
    }

    // Filtro de sub-entidade:
    // - parentRecordId passado: retorna apenas sub-registros daquele pai
    // - includeChildren=true: retorna todos (inclusive sub-registros)
    // - nenhum dos dois: retorna apenas registros raiz (sem parentRecordId)
    if (parentRecordId) {
      where.parentRecordId = parentRecordId;
    } else if (includeChildren !== 'true') {
      where.parentRecordId = null;
    }

    // PLATFORM_ADMIN pode ver de qualquer tenant ou todos
    const userRoleType = currentUser.customRole?.roleType as RoleType | undefined;
    if (userRoleType === 'PLATFORM_ADMIN') {
      if (queryTenantId) {
        where.tenantId = queryTenantId;
      }
    } else {
      where.tenantId = currentUser.tenantId;
    }

    // Aplicar filtro de escopo baseado na CustomRole (own = apenas proprios registros)
    await this.applyScopeFromCustomRole(where, currentUser, entitySlug);

    // Busca textual
    if (search) {
      const settings = entity.settings as EntitySettings;
      const searchFields = settings?.searchFields || [];

      if (searchFields.length > 0) {
        // JSON path queries nao suportam mode: 'insensitive' no Prisma
        // Buscamos tanto com o termo original quanto em uppercase para chassis etc.
        const searchVariants = [search];
        if (search !== search.toUpperCase()) searchVariants.push(search.toUpperCase());
        if (search !== search.toLowerCase()) searchVariants.push(search.toLowerCase());

        where.OR = searchFields.flatMap((field: string) =>
          searchVariants.map(term => ({
            data: {
              path: [field],
              string_contains: term,
            },
          }))
        );
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

    // =========================================================================
    // ORDENACAO E QUERIES
    // =========================================================================
    const TOP_LEVEL_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'id', 'parentRecordId']);
    const isParentDisplaySort = sortBy === '_parentDisplay';
    const isJsonFieldSort = !isParentDisplaySort && !TOP_LEVEL_SORT_FIELDS.has(sortBy);

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[];
    let total: number;
    let hasNextPage: boolean;
    let hasPreviousPage: boolean;

    if (isParentDisplaySort && !useCursor) {
      // Ordenacao por campo de display do pai: buscar IDs + parentRecordId, resolver displays, ordenar em memoria
      const [allItems, totalCount] = await Promise.all([
        this.prisma.entityData.findMany({
          where,
          select: { id: true, parentRecordId: true },
        }),
        this.prisma.entityData.count({ where }),
      ]);

      // Buscar registros pai para resolver o display
      const parentIds = [...new Set(allItems.map(r => r.parentRecordId).filter(Boolean))] as string[];
      const parentDisplayMap = new Map<string, string>();

      if (parentIds.length > 0) {
        const parentRecords = await this.prisma.entityData.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, data: true },
        });

        // Descobrir parentDisplayField
        const parentEntitiesForSort = await this.prisma.entity.findMany({
          where: { tenantId: effectiveTenantId },
          select: { fields: true, settings: true },
        });

        let displayField: string | undefined;
        for (const pe of parentEntitiesForSort) {
          const peFields = (pe.fields as unknown) as EntityField[];
          const subField = peFields?.find(f => f.type === 'sub-entity' && f.subEntityId === entity.id);
          if (subField?.parentDisplayField) {
            displayField = subField.parentDisplayField;
            break;
          }
        }
        if (!displayField) {
          for (const pe of parentEntitiesForSort) {
            const peSettings = pe.settings as EntitySettings;
            if (peSettings?.titleField) {
              displayField = peSettings.titleField;
              break;
            }
          }
        }

        for (const pr of parentRecords) {
          const prData = pr.data as Record<string, unknown>;
          parentDisplayMap.set(pr.id, displayField ? String(prData[displayField] || pr.id) : pr.id);
        }
      }

      // Ordenar em memoria pelo display do pai
      allItems.sort((a, b) => {
        const aVal = a.parentRecordId ? parentDisplayMap.get(a.parentRecordId) : null;
        const bVal = b.parentRecordId ? parentDisplayMap.get(b.parentRecordId) : null;
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const comp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        return sortOrder === 'desc' ? -comp : comp;
      });

      // Paginar
      const offset = skipClause || (page - 1) * limit;
      const paginatedIds = allItems.slice(offset, offset + limit).map(r => r.id);

      // Buscar registros completos
      const fullRecords = paginatedIds.length > 0
        ? await this.prisma.entityData.findMany({
            where: { id: { in: paginatedIds } },
            include: includeClause,
          })
        : [];

      const idOrder = new Map(paginatedIds.map((id, i) => [id, i]));
      data = fullRecords.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
      total = totalCount;
      hasNextPage = offset + limit < totalCount;
      hasPreviousPage = page > 1;
    } else if (isJsonFieldSort && !useCursor) {
      // Ordenacao por campo JSON: buscar IDs + valor do campo, ordenar em memoria, paginar
      const [allItems, totalCount] = await Promise.all([
        this.prisma.entityData.findMany({
          where,
          select: { id: true, data: true },
        }),
        this.prisma.entityData.count({ where }),
      ]);

      // Ordenar em memoria pelo campo JSON
      allItems.sort((a, b) => {
        const aVal = (a.data as Record<string, unknown>)?.[sortBy];
        const bVal = (b.data as Record<string, unknown>)?.[sortBy];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const comp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
        return sortOrder === 'desc' ? -comp : comp;
      });

      // Paginar
      const offset = skipClause || (page - 1) * limit;
      const paginatedIds = allItems.slice(offset, offset + limit).map(r => r.id);

      // Buscar registros completos
      const fullRecords = paginatedIds.length > 0
        ? await this.prisma.entityData.findMany({
            where: { id: { in: paginatedIds } },
            include: includeClause,
          })
        : [];

      // Reordenar conforme IDs paginados
      const idOrder = new Map(paginatedIds.map((id, i) => [id, i]));
      data = fullRecords.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
      total = totalCount;
      hasNextPage = offset + limit < totalCount;
      hasPreviousPage = page > 1;
    } else {
      // Ordenacao por campo top-level: usar Prisma orderBy nativo
      const orderBy: Prisma.EntityDataOrderByWithRelationInput[] = [
        { [sortBy]: sortOrder },
      ];
      if (sortBy !== 'id') {
        orderBy.push({ id: sortOrder });
      }

      const takeWithExtra = limit + 1;

      const findManyArgs: Prisma.EntityDataFindManyArgs = {
        where,
        take: takeWithExtra,
        orderBy,
        include: includeClause,
      };

      if (useCursor && cursorClause) {
        findManyArgs.cursor = cursorClause;
        findManyArgs.skip = 1;
      } else {
        findManyArgs.skip = skipClause;
      }

      const [rawData, totalCount] = await Promise.all([
        this.prisma.entityData.findMany(findManyArgs),
        this.prisma.entityData.count({ where }),
      ]);

      hasNextPage = rawData.length > limit;
      data = hasNextPage ? rawData.slice(0, limit) : rawData;
      hasPreviousPage = useCursor ? true : page > 1;
      total = totalCount;
    }

    // =========================================================================
    // CONTAGEM DINAMICA DE FILHOS (sub-entidades)
    // =========================================================================
    let enrichedData: Array<Record<string, unknown>> = data;
    let parentEntityName: string | undefined;
    let parentEntitySlug: string | undefined;

    if (!parentRecordId && data.length > 0) {
      const entityFields = (entity.fields as unknown) as EntityField[];
      const subEntityFields = entityFields.filter(f => f.type === 'sub-entity' && f.subEntityId);

      if (subEntityFields.length > 0) {
        const recordIds = data.map(r => r.id);
        const childCountsMap = new Map<string, Record<string, number>>();

        for (const subField of subEntityFields) {
          const counts = await this.prisma.entityData.groupBy({
            by: ['parentRecordId'],
            where: {
              entityId: subField.subEntityId!,
              parentRecordId: { in: recordIds },
            },
            _count: { id: true },
          });

          for (const c of counts) {
            if (!c.parentRecordId) continue;
            const existing = childCountsMap.get(c.parentRecordId) || {};
            existing[subField.slug] = c._count.id;
            childCountsMap.set(c.parentRecordId, existing);
          }
        }

        enrichedData = data.map(record => ({
          ...record,
          _childCounts: childCountsMap.get(record.id) || {},
        }));
      }
    }

    // =========================================================================
    // ENRIQUECER SUB-REGISTROS COM INFO DO PAI
    // =========================================================================
    if (includeChildren === 'true' && data.length > 0) {
      const parentIds = [...new Set(data.map(r => r.parentRecordId).filter(Boolean))] as string[];

      if (parentIds.length > 0) {
        // Buscar registros pai para exibir campo de display
        const parentRecordsData = await this.prisma.entityData.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, data: true },
        });

        // Descobrir o parentDisplayField das entidades pai
        // Encontrar entidades que tem sub-entity apontando para esta
        const parentEntities = await this.prisma.entity.findMany({
          where: { tenantId: effectiveTenantId },
          select: { id: true, name: true, slug: true, fields: true, settings: true },
        });

        let parentDisplayField: string | undefined;

        for (const pe of parentEntities) {
          const peFields = (pe.fields as unknown) as EntityField[];
          const subField = peFields?.find(
            f => f.type === 'sub-entity' && f.subEntityId === entity.id,
          );
          if (subField) {
            parentEntityName = pe.name;
            parentEntitySlug = pe.slug;
            if (subField.parentDisplayField) {
              parentDisplayField = subField.parentDisplayField;
            }
            break;
          }
        }

        // Fallback: usar titleField do settings da entidade pai
        if (!parentDisplayField) {
          for (const pe of parentEntities) {
            const peSettings = pe.settings as EntitySettings;
            if (peSettings?.titleField) {
              parentDisplayField = peSettings.titleField;
              break;
            }
          }
        }

        const parentMap = new Map<string, string>();
        for (const pr of parentRecordsData) {
          const prData = pr.data as Record<string, unknown>;
          const displayValue = parentDisplayField
            ? String(prData[parentDisplayField] || pr.id)
            : pr.id;
          parentMap.set(pr.id, displayValue);
        }

        enrichedData = (enrichedData.length > 0 ? enrichedData : data).map(record => ({
          ...record,
          _parentDisplay: record.parentRecordId
            ? parentMap.get(record.parentRecordId as string) || null
            : null,
          _parentEntityName: parentEntityName || null,
          _parentEntitySlug: parentEntitySlug || null,
        }));
      }
    }

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

    // =========================================================================
    // FIELD-LEVEL PERMISSIONS: filtrar campos que o usuario nao pode ver
    // =========================================================================
    const fieldPerms = await this.customRoleService.getFieldPermissions(currentUser.id, entitySlug);
    let visibleFields: string[] | undefined;
    let editableFields: string[] | undefined;

    if (fieldPerms && fieldPerms.length > 0) {
      const viewableSet = new Set(fieldPerms.filter(f => f.canView).map(f => f.fieldSlug));
      visibleFields = Array.from(viewableSet);
      editableFields = fieldPerms.filter(f => f.canEdit).map(f => f.fieldSlug);

      enrichedData = enrichedData.map(record => {
        const recordData = (record as Record<string, unknown>).data as Record<string, unknown>;
        if (!recordData) return record;
        const filteredData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(recordData)) {
          if (viewableSet.has(key)) filteredData[key] = value;
        }
        return { ...record, data: filteredData };
      });
    }

    return {
      data: enrichedData,
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
        ...(parentEntitySlug ? {
          _parentEntity: { name: parentEntityName, slug: parentEntitySlug },
        } : {}),
      },
      ...(visibleFields ? { visibleFields, editableFields } : {}),
    };
  }

  async findOne(entitySlug: string, id: string, currentUser: CurrentUser, tenantId?: string) {
    // Verificar permissao de leitura na entidade
    await this.checkEntityPermission(currentUser.id, entitySlug, 'canRead');

    const effectiveTenantId = getEffectiveTenantId(currentUser, tenantId);
    const entity = await this.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // PLATFORM_ADMIN pode ver registro de qualquer tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.EntityDataWhereInput = {
      id,
      entityId: entity.id,
    };

    if (roleType !== 'PLATFORM_ADMIN') {
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

    // Verificar scope: se usuario tem scope 'own', so pode ver proprios registros
    if (roleType !== 'PLATFORM_ADMIN') {
      const scope = await this.customRoleService.getEntityScope(currentUser.id, entitySlug);
      if (scope === 'own' && record.createdById !== currentUser.id) {
        throw new ForbiddenException('Acesso negado a este registro');
      }
    }

    // Field-level permissions: filtrar campos que o usuario nao pode ver
    const fieldPerms = await this.customRoleService.getFieldPermissions(currentUser.id, entitySlug);
    let filteredRecord = record;
    let visibleFields: string[] | undefined;
    let editableFields: string[] | undefined;

    if (fieldPerms && fieldPerms.length > 0) {
      const viewableSet = new Set(fieldPerms.filter(f => f.canView).map(f => f.fieldSlug));
      visibleFields = Array.from(viewableSet);
      editableFields = fieldPerms.filter(f => f.canEdit).map(f => f.fieldSlug);

      const recordData = record.data as Record<string, unknown>;
      const filteredData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(recordData)) {
        if (viewableSet.has(key)) filteredData[key] = value;
      }
      filteredRecord = { ...record, data: filteredData as Prisma.JsonValue };
    }

    return {
      ...filteredRecord,
      entity: {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        fields: entity.fields,
      },
      ...(visibleFields ? { visibleFields, editableFields } : {}),
    };
  }

  async update(entitySlug: string, id: string, dto: CreateDataDto & { tenantId?: string }, currentUser: CurrentUser) {
    // Verificar permissao de edicao na entidade
    await this.checkEntityPermission(currentUser.id, entitySlug, 'canUpdate');

    const effectiveTenantId = getEffectiveTenantId(currentUser, dto.tenantId);
    const entity = await this.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // PLATFORM_ADMIN pode editar registro de qualquer tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.EntityDataWhereInput = {
      id,
      entityId: entity.id,
    };

    if (roleType !== 'PLATFORM_ADMIN') {
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
    if (roleType !== 'PLATFORM_ADMIN') {
      this.checkScope(record, currentUser, 'update');
    }

    // Field-level permissions: validar que o usuario so edita campos permitidos
    const fieldPerms = await this.customRoleService.getFieldPermissions(currentUser.id, entitySlug);
    if (fieldPerms && fieldPerms.length > 0) {
      const editableSet = new Set(fieldPerms.filter(f => f.canEdit).map(f => f.fieldSlug));
      const dtoData = dto.data as Record<string, unknown> || {};
      for (const key of Object.keys(dtoData)) {
        if (!editableSet.has(key)) {
          throw new ForbiddenException(`Sem permissao para editar o campo: ${key}`);
        }
      }
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

    // Validar campos unicos (excluindo o proprio registro)
    await this.validateUniqueFields(fields, dataWithCustomApi, entity.id, effectiveTenantId, id);

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

    const effectiveTenantId = getEffectiveTenantId(currentUser, tenantId);
    const entity = await this.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // PLATFORM_ADMIN pode deletar registro de qualquer tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.EntityDataWhereInput = {
      id,
      entityId: entity.id,
    };

    if (roleType !== 'PLATFORM_ADMIN') {
      whereClause.tenantId = currentUser.tenantId;
    }

    const record = await this.prisma.entityData.findFirst({
      where: whereClause,
    });

    if (!record) {
      throw new NotFoundException('Registro nao encontrado');
    }

    // Verificar permissao de escopo (exceto PLATFORM_ADMIN)
    if (roleType !== 'PLATFORM_ADMIN') {
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

  /**
   * Aplica filtros de escopo na query baseado na CustomRole
   * @param entitySlug - slug da entidade para buscar o scope
   */
  private async applyScopeFromCustomRole(
    where: Prisma.EntityDataWhereInput,
    user: CurrentUser,
    entitySlug: string,
  ): Promise<void> {
    // Buscar scope da custom role para esta entidade
    const scope = await this.customRoleService.getEntityScope(user.id, entitySlug);

    // Se scope = 'own', filtrar apenas registros criados pelo usuario
    if (scope === 'own') {
      where.createdById = user.id;
      this.logger.debug(`Applying scope 'own' for user ${user.id} on entity ${entitySlug}`);
    }
    // Se scope = 'all' ou null (ADMIN/PLATFORM_ADMIN), nao filtra por criador
  }

  // Validar campos marcados como unique
  private async validateUniqueFields(
    fields: EntityField[],
    data: Record<string, unknown>,
    entityId: string,
    tenantId: string,
    excludeRecordId?: string,
  ) {
    const uniqueFields = fields.filter(f => f.unique);
    if (uniqueFields.length === 0) return;

    for (const field of uniqueFields) {
      const value = data[field.slug];
      if (value === undefined || value === null || value === '') continue;

      const duplicates = await this.prisma.entityData.findMany({
        where: {
          entityId,
          tenantId,
          ...(excludeRecordId ? { id: { not: excludeRecordId } } : {}),
        },
        select: { id: true, data: true },
      });

      const duplicate = duplicates.find(record => {
        const recordData = record.data as Record<string, unknown>;
        return String(recordData[field.slug]) === String(value);
      });

      if (duplicate) {
        throw new BadRequestException(
          `O campo "${field.label || field.name}" deve ser unico. O valor "${value}" ja existe.`,
        );
      }
    }
  }

  // Verificar se usuario pode modificar o registro
  private checkScope(record: EntityData, user: CurrentUser, action: string) {
    const roleType = user.customRole?.roleType as RoleType | undefined;

    // Admin e Platform Admin podem tudo
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') {
      return;
    }

    // Viewer nao pode modificar
    if (roleType === 'VIEWER') {
      throw new ForbiddenException('Voce nao tem permissao para modificar registros');
    }

    // Manager pode modificar registros do tenant
    if (roleType === 'MANAGER') {
      return;
    }

    // User e CUSTOM so podem modificar proprios registros
    if (roleType === 'USER' || roleType === 'CUSTOM') {
      if (record.createdById !== user.id) {
        throw new ForbiddenException('Voce so pode modificar registros criados por voce');
      }
    }
  }
}
