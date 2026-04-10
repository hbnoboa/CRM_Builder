import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger, Inject, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityService } from '../entity/entity.service';
import { NotificationService } from '../notification/notification.service';
import { CustomRoleService } from '../custom-role/custom-role.service';
import { ComputedFieldsService } from './computed-fields.service';
import { WebhookService } from '../webhook/webhook.service';
import { ActionChainService } from '../action-chain/action-chain.service';
import { EntityAutomationService } from '../entity-automation/entity-automation.service';
import { Prisma, EntityData, Entity } from '@prisma/client';
import {
  CurrentUser,
  createPaginationMeta,
  encodeCursor,
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../common/types';
import { DASHBOARD_MAX_LIMIT } from '@crm-builder/shared';
import { RoleType } from '../../common/decorators/roles.decorator';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { EntityDataQueryService } from '../../common/services/entity-data-query.service';
import { AuditService } from '../audit/audit.service';
import { formatRecordData } from '../../common/utils/format-record';

interface CreateDataDto {
  data: Record<string, unknown>;
  parentRecordId?: string;
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
  // Filtros - JSON stringified array de GlobalFilter
  filters?: string; // Ex: '[{"fieldSlug":"status","operator":"equals","value":"ativo"}]'
  // IDs especificos para export
  recordIds?: string; // JSON stringified array de IDs: '["id1","id2"]'
  // Dashboard mode: fetch all records (up to DASHBOARD_MAX_LIMIT)
  all?: string; // 'true' para buscar todos os registros de uma vez
  // Dashboard filters — JSON stringified array of { fieldSlug, operator, value } with cross-entity prefixes
  dashboardFilters?: string;
  // Internal flag — bypasses MAX_LIMIT cap (used by export, not exposed via API)
  _skipMaxLimit?: boolean;
}

interface BusinessHoursConfig {
  timezone: string;
  schedule: Record<string, { start: string; end: string } | null>;
}

interface EntitySettings {
  searchFields?: string[];
  titleField?: string;
  subtitleField?: string;
  globalFilters?: GlobalFilter[];
  slaConfig?: {
    businessHours?: BusinessHoursConfig;
  };
  lockField?: string;
}

interface GlobalFilter {
  fieldSlug: string;
  fieldName: string;
  fieldType: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'isEmpty' | 'isNotEmpty';
  value?: unknown;
  value2?: unknown;
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
  relatedEntityId?: string;
  relatedEntitySlug?: string;
  relatedDisplayField?: string;
}

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name);

  constructor(
    private prisma: PrismaService,
    private entityService: EntityService,
    private notificationService: NotificationService,
    private customRoleService: CustomRoleService,
    private auditService: AuditService,
    private computedFieldsService: ComputedFieldsService,
    private queryService: EntityDataQueryService,
    @InjectQueue('automation-execution') private automationQueue: Queue,
    @Optional() @Inject(WebhookService) private webhookService?: WebhookService,
    @Optional() @Inject(ActionChainService) private actionChainService?: ActionChainService,
    @Optional() @Inject(EntityAutomationService) private entityAutomationService?: EntityAutomationService,
  ) {}

  /**
   * Dispara webhooks e action chains para eventos de dados
   */
  private async triggerAutomations(
    event: 'created' | 'updated' | 'deleted' | 'status-changed',
    tenantId: string,
    entity: { id: string; slug: string; name: string },
    record: Record<string, unknown>,
    user: CurrentUser,
    previousRecord?: Record<string, unknown>,
  ): Promise<void> {
    const context = {
      event,
      recordId: record.id as string,
      record,
      previousRecord,
      user: { id: user.id, name: user.name, email: user.email },
      entity: { id: entity.id, slug: entity.slug, name: entity.name },
    };

    // Disparar webhooks (legado) - ainda síncrono pois são fire-and-forget
    if (this.webhookService) {
      this.webhookService.triggerWebhooks(tenantId, context).catch((err) => {
        this.logger.error(`Erro ao disparar webhooks: ${err.message}`);
      });
    }

    // Disparar action chains (legado) - ainda síncrono pois são fire-and-forget
    if (this.actionChainService) {
      this.actionChainService.triggerByEvent(tenantId, event, {
        recordId: record.id as string,
        record,
        user: context.user,
        entity: context.entity,
      }).catch((err) => {
        this.logger.error(`Erro ao disparar action chains: ${err.message}`);
      });
    }

    // Buscar automações que devem ser disparadas
    // NOVO: Adicionar à fila ao invés de executar diretamente
    try {
      // Buscar automações ativas para este evento
      const automations = await this.prisma.entityAutomation.findMany({
        where: {
          entityId: entity.id,
          tenantId,
          isActive: true,
          trigger: event === 'status-changed' ? 'ON_STATUS_CHANGE' :
                  event === 'created' ? 'ON_CREATE' :
                  event === 'updated' ? 'ON_UPDATE' :
                  'ON_DELETE',
        },
        select: { id: true, name: true },
      });

      if (automations.length > 0) {
        this.logger.log(
          `[Automations] Enfileirando ${automations.length} automation(s) para ${event} em ${entity.slug} (record: ${record.id})`
        );

        // Adicionar cada automation à fila
        for (const automation of automations) {
          await this.automationQueue.add({
            automationId: automation.id,
            recordId: record.id as string,
            trigger: event,
            userId: user.id,
            tenantId,
            entitySlug: entity.slug,
            metadata: {
              automationName: automation.name,
              previousRecord,
            },
          }, {
            attempts: 3, // Retry até 3x
            backoff: {
              type: 'exponential',
              delay: 2000, // 2s, 4s, 8s
            },
            removeOnComplete: 100, // Manter últimos 100 jobs completados
            removeOnFail: 500, // Manter últimos 500 erros para debug
          });
        }

        this.logger.log(
          `[Automations] ${automations.length} automation(s) enfileirada(s) com sucesso`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[Automations] Erro ao enfileirar automations: ${errorMessage}`,
        errorStack
      );
      // Não lançar erro para não bloquear a operação principal
    }
  }

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

  async create(entitySlug: string, dto: CreateDataDto & { tenantId?: string }, currentUser: CurrentUser) {
    // Verificar permissao de criacao na entidade
    await this.checkEntityPermission(currentUser.id, entitySlug, 'canCreate');

    const targetTenantId = getEffectiveTenantId(currentUser, dto.tenantId);

    // Buscar entidade (cached)
    const entity = await this.queryService.getEntityCached(entitySlug, currentUser, targetTenantId);

    // Processar campos calculados (formula, rollup, timer, sla-status)
    const fields = (entity.fields as unknown) as EntityField[];
    const settings = entity.settings as EntitySettings;
    const inputData = dto.data as Record<string, unknown> || {};
    const dataWithComputedFields = await this.computedFieldsService.processComputedFields(
      inputData,
      fields,
      entity.id,
      targetTenantId,
      undefined, // recordId ainda nao existe no create
      undefined, // previousData
      settings,
    );

    // Validar dados (apos aplicar Custom API e campos calculados)
    const errors = this.entityService.validateData(fields, dataWithComputedFields);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    // Validar campos unicos
    await this.validateUniqueFields(fields, dataWithComputedFields, entity.id, targetTenantId);

    const record = await this.prisma.entityData.create({
      data: {
        tenantId: targetTenantId,
        entityId: entity.id,
        data: dataWithComputedFields as Prisma.InputJsonValue,
        parentRecordId: dto.parentRecordId || null,
        createdById: currentUser.id,
        updatedById: currentUser.id,
      },
    });

    // Enviar notificacao para o tenant
    const titleField = settings?.titleField || 'nome';
    const recordName = String((dataWithComputedFields as Record<string, unknown>)[titleField] || record.id);

    this.notificationService.notifyRecordCreated(
      targetTenantId,
      entity.name,
      recordName,
      currentUser.name,
      entitySlug,
      dataWithComputedFields as Record<string, unknown>,
    ).catch((err) => this.logger.error('Failed to send notification', err));

    this.auditService.log(currentUser, {
      action: 'create', resource: 'entity_data', resourceId: record.id,
      newData: dataWithComputedFields as Record<string, unknown>,
      metadata: { entitySlug, entityId: entity.id },
    }).catch(() => {});

    // Real-time: granular update for all tenant clients
    this.notificationService.emitDataChanged(targetTenantId, {
      operation: 'created',
      entitySlug,
      record: {
        id: record.id,
        data: record.data as Record<string, unknown>,
        parentRecordId: record.parentRecordId || null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      },
      userId: currentUser.id,
    });

    // Disparar webhooks e action chains
    this.triggerAutomations(
      'created',
      targetTenantId,
      { id: entity.id, slug: entitySlug, name: entity.name },
      { id: record.id, ...dataWithComputedFields },
      currentUser,
    );

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
    const isDashboardAll = query.all === 'true';
    const page = isDashboardAll ? 1 : (parseInt(String(query.page || '1'), 10) || 1);
    const dashboardLimit = DASHBOARD_MAX_LIMIT > 0 ? DASHBOARD_MAX_LIMIT : undefined; // 0 = sem limite
    const rawLimit = isDashboardAll
      ? (dashboardLimit ?? 999999999)
      : Math.max(1, parseInt(String(query.limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT);
    const limit = query._skipMaxLimit ? rawLimit : (isDashboardAll ? (dashboardLimit ?? 999999999) : Math.min(MAX_LIMIT, rawLimit));
    const { search, sortBy = 'createdAt', sortOrder = 'desc', tenantId: queryTenantId, parentRecordId, includeChildren, hasChildrenIn, cursor, fields } = query;

    // Parse recordIds se fornecidos
    let parsedRecordIds: string[] | undefined;
    if (query.recordIds) {
      try {
        const ids = JSON.parse(query.recordIds) as string[];
        if (Array.isArray(ids) && ids.length > 0) {
          parsedRecordIds = ids;
        }
      } catch { /* ignore parse error */ }
    }

    // Parse dashboardFilters se fornecidos
    let dashboardFilterOptions: { filters?: string } | undefined;
    if (query.dashboardFilters) {
      dashboardFilterOptions = { filters: query.dashboardFilters };
    }

    // Construir WHERE via servico centralizado
    const { where, entity, effectiveTenantId } = await this.queryService.buildWhere({
      entitySlug,
      user: currentUser,
      tenantId: queryTenantId,
      parentRecordId,
      includeChildren: includeChildren === 'true',
      filters: query.filters,
      search,
      recordIds: parsedRecordIds,
      hasChildrenIn,
      dashboardFilters: dashboardFilterOptions,
    });

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
    // ARCHIVED DATA: construir where equivalente para ArchivedEntityData
    // =========================================================================
    const archivedWhere = this.queryService.buildArchivedWhere(where);

    // =========================================================================
    // ORDENACAO E QUERIES
    // =========================================================================
    const TOP_LEVEL_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'id', 'parentRecordId']);
    const isParentDisplaySort = sortBy === '_parentDisplay';
    // Detectar se o sortBy e um campo sub-entity (ordenar por contagem de filhos)
    const entityFields = (entity.fields as unknown) as EntityField[];
    const sortSubEntityField = entityFields.find(f => f.slug === sortBy && f.type === 'sub-entity' && f.subEntityId);
    const isSubEntitySort = !!sortSubEntityField;
    const isJsonFieldSort = !isParentDisplaySort && !isSubEntitySort && !TOP_LEVEL_SORT_FIELDS.has(sortBy);

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
      const [activeItems, archivedItems, activeCount, archivedCount] = await Promise.all([
        this.prisma.entityData.findMany({
          where,
          select: { id: true, parentRecordId: true },
        }),
        this.prisma.archivedEntityData.findMany({
          where: archivedWhere,
          select: { id: true, parentRecordId: true },
        }),
        this.prisma.entityData.count({ where }),
        this.prisma.archivedEntityData.count({ where: archivedWhere }),
      ]);

      const allItems: Array<{ id: string; parentRecordId: string | null; _isArchived?: boolean }> = [
        ...activeItems,
        ...archivedItems.map(r => ({ ...r, _isArchived: true })),
      ];

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
      const paginatedIds = allItems.slice(offset, offset + limit);
      const activeIds = paginatedIds.filter(r => !r._isArchived).map(r => r.id);
      const archivedIds = paginatedIds.filter(r => r._isArchived).map(r => r.id);

      // Buscar registros completos de ambas tabelas
      const [fullActive, fullArchived] = await Promise.all([
        activeIds.length > 0
          ? this.prisma.entityData.findMany({
              where: { id: { in: activeIds } },
              include: includeClause,
            })
          : [],
        this.fetchArchivedRecordsFull(archivedIds),
      ]);

      const allFull = [...fullActive, ...fullArchived];
      const idOrder = new Map(paginatedIds.map((r, i) => [r.id, i]));
      data = allFull.sort((a, b) => (idOrder.get(a.id as string) ?? 0) - (idOrder.get(b.id as string) ?? 0));
      total = activeCount + archivedCount;
      hasNextPage = offset + limit < total;
      hasPreviousPage = page > 1;
    } else if (isSubEntitySort && !useCursor) {
      // Ordenacao por contagem de filhos (sub-entity): contar filhos, ordenar em memoria, paginar
      const [activeIds, archivedIds2, activeCount, archivedCount, childCounts] = await Promise.all([
        this.prisma.entityData.findMany({
          where,
          select: { id: true },
        }),
        this.prisma.archivedEntityData.findMany({
          where: archivedWhere,
          select: { id: true },
        }),
        this.prisma.entityData.count({ where }),
        this.prisma.archivedEntityData.count({ where: archivedWhere }),
        // Buscar TODAS as contagens de filhos da sub-entidade (sem IN clause)
        this.prisma.entityData.groupBy({
          by: ['parentRecordId'],
          where: {
            entityId: sortSubEntityField.subEntityId!,
            parentRecordId: { not: null },
          },
          _count: { id: true },
        }),
      ]);

      const allIds: Array<{ id: string; _isArchived?: boolean }> = [
        ...activeIds,
        ...archivedIds2.map(r => ({ ...r, _isArchived: true })),
      ];

      const countMap = new Map<string, number>();
      for (const c of childCounts) {
        if (c.parentRecordId) {
          countMap.set(c.parentRecordId, c._count.id);
        }
      }

      // Ordenar por contagem de filhos
      allIds.sort((a, b) => {
        const aCount = countMap.get(a.id) ?? 0;
        const bCount = countMap.get(b.id) ?? 0;
        const comp = aCount - bCount;
        return sortOrder === 'desc' ? -comp : comp;
      });

      // Paginar
      const offset = skipClause || (page - 1) * limit;
      const paginatedItems = allIds.slice(offset, offset + limit);
      const activePageIds = paginatedItems.filter(r => !r._isArchived).map(r => r.id);
      const archivedPageIds = paginatedItems.filter(r => r._isArchived).map(r => r.id);

      const [fullActive, fullArchived] = await Promise.all([
        activePageIds.length > 0
          ? this.prisma.entityData.findMany({
              where: { id: { in: activePageIds } },
              include: includeClause,
            })
          : [],
        this.fetchArchivedRecordsFull(archivedPageIds),
      ]);

      const allFull = [...fullActive, ...fullArchived];
      const idOrder = new Map(paginatedItems.map((r, i) => [r.id, i]));
      data = allFull.sort((a, b) => (idOrder.get(a.id as string) ?? 0) - (idOrder.get(b.id as string) ?? 0));
      total = activeCount + archivedCount;
      hasNextPage = offset + limit < total;
      hasPreviousPage = page > 1;
    } else if (isJsonFieldSort && !useCursor) {
      // Ordenacao por campo JSON: buscar IDs + valor do campo, ordenar em memoria, paginar
      const [activeItems, archivedItems2, activeCount, archivedCount] = await Promise.all([
        this.prisma.entityData.findMany({
          where,
          select: { id: true, data: true },
        }),
        this.prisma.archivedEntityData.findMany({
          where: archivedWhere,
          select: { id: true, data: true },
        }),
        this.prisma.entityData.count({ where }),
        this.prisma.archivedEntityData.count({ where: archivedWhere }),
      ]);

      const allItems: Array<{ id: string; data: unknown; _isArchived?: boolean }> = [
        ...activeItems,
        ...archivedItems2.map(r => ({ ...r, _isArchived: true })),
      ];

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
      const paginatedItems = allItems.slice(offset, offset + limit);
      const activePageIds = paginatedItems.filter(r => !r._isArchived).map(r => r.id);
      const archivedPageIds = paginatedItems.filter(r => r._isArchived).map(r => r.id);

      // Buscar registros completos de ambas tabelas
      const [fullActive, fullArchived] = await Promise.all([
        activePageIds.length > 0
          ? this.prisma.entityData.findMany({
              where: { id: { in: activePageIds } },
              include: includeClause,
            })
          : [],
        this.fetchArchivedRecordsFull(archivedPageIds),
      ]);

      const allFull = [...fullActive, ...fullArchived];
      // Reordenar conforme IDs paginados
      const idOrder = new Map(paginatedItems.map((r, i) => [r.id, i]));
      data = allFull.sort((a, b) => (idOrder.get(a.id as string) ?? 0) - (idOrder.get(b.id as string) ?? 0));
      total = activeCount + archivedCount;
      hasNextPage = offset + limit < total;
      hasPreviousPage = page > 1;
    } else {
      // Ordenacao por campo top-level: usar Prisma orderBy nativo
      // Com merge transparente de dados arquivados via boundary calculation
      const orderBy: Prisma.EntityDataOrderByWithRelationInput[] = [
        { [sortBy]: sortOrder },
      ];
      if (sortBy !== 'id') {
        orderBy.push({ id: sortOrder });
      }

      const archivedOrderBy: Prisma.ArchivedEntityDataOrderByWithRelationInput[] = [
        { [sortBy]: sortOrder } as Prisma.ArchivedEntityDataOrderByWithRelationInput,
      ];
      if (sortBy !== 'id') {
        archivedOrderBy.push({ id: sortOrder } as Prisma.ArchivedEntityDataOrderByWithRelationInput);
      }

      const [activeCount, archivedCount] = await Promise.all([
        this.prisma.entityData.count({ where }),
        this.prisma.archivedEntityData.count({ where: archivedWhere }),
      ]);
      const combinedTotal = activeCount + archivedCount;

      if (useCursor && cursorClause) {
        // Cursor pagination: manter comportamento original (apenas active)
        const findManyArgs: Prisma.EntityDataFindManyArgs = {
          where,
          take: limit + 1,
          orderBy,
          include: includeClause,
          cursor: cursorClause,
          skip: 1,
        };

        const rawData = await this.prisma.entityData.findMany(findManyArgs);
        hasNextPage = rawData.length > limit;
        data = hasNextPage ? rawData.slice(0, limit) : rawData;
        hasPreviousPage = true;
        total = combinedTotal;
      } else {
        // Offset pagination: boundary calculation across active + archived
        const offset = skipClause || (page - 1) * limit;

        // Para createdAt/updatedAt: active records sao mais recentes, archived sao mais antigos
        // DESC: active primeiro, archived depois
        // ASC: archived primeiro, active depois
        // Nota: id e parentRecordId (CUIDs) nao tem ordem temporal garantida,
        // mas a boundary e uma aproximacao aceitavel para paginacao
        const activeFirst = sortOrder === 'desc';
        const firstCount = activeFirst ? activeCount : archivedCount;

        if (offset + limit <= firstCount) {
          // Todos os registros desta pagina vem da primeira tabela
          if (activeFirst) {
            const rawData = await this.prisma.entityData.findMany({
              where, skip: offset, take: limit, orderBy, include: includeClause,
            });
            data = rawData;
          } else {
            const rawArchived = await this.prisma.archivedEntityData.findMany({
              where: archivedWhere, skip: offset, take: limit, orderBy: archivedOrderBy,
            });
            data = await this.fetchArchivedRecordsFull(rawArchived.map(r => r.id));
            // Manter ordem
            const idOrder = new Map(rawArchived.map((r, i) => [r.id, i]));
            data.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
              (idOrder.get(a.id as string) ?? 0) - (idOrder.get(b.id as string) ?? 0));
          }
        } else if (offset >= firstCount) {
          // Todos os registros vem da segunda tabela
          const secondOffset = offset - firstCount;
          if (activeFirst) {
            // Segunda tabela = archived
            const rawArchived = await this.prisma.archivedEntityData.findMany({
              where: archivedWhere, skip: secondOffset, take: limit, orderBy: archivedOrderBy,
            });
            data = await this.fetchArchivedRecordsFull(rawArchived.map(r => r.id));
            const idOrder = new Map(rawArchived.map((r, i) => [r.id, i]));
            data.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
              (idOrder.get(a.id as string) ?? 0) - (idOrder.get(b.id as string) ?? 0));
          } else {
            // Segunda tabela = active
            const rawData = await this.prisma.entityData.findMany({
              where, skip: secondOffset, take: limit, orderBy, include: includeClause,
            });
            data = rawData;
          }
        } else {
          // Boundary: precisa de registros de ambas tabelas
          const firstTake = firstCount - offset;
          const secondTake = limit - firstTake;

          if (activeFirst) {
            const [activeData, rawArchived] = await Promise.all([
              this.prisma.entityData.findMany({
                where, skip: offset, take: firstTake, orderBy, include: includeClause,
              }),
              this.prisma.archivedEntityData.findMany({
                where: archivedWhere, skip: 0, take: secondTake, orderBy: archivedOrderBy,
              }),
            ]);
            const archivedData = await this.fetchArchivedRecordsFull(rawArchived.map(r => r.id));
            const idOrder = new Map(rawArchived.map((r, i) => [r.id, i]));
            archivedData.sort((a, b) =>
              (idOrder.get(a.id as string) ?? 0) - (idOrder.get(b.id as string) ?? 0));
            data = [...activeData, ...archivedData];
          } else {
            const [rawArchived, activeData] = await Promise.all([
              this.prisma.archivedEntityData.findMany({
                where: archivedWhere, skip: offset, take: firstTake, orderBy: archivedOrderBy,
              }),
              this.prisma.entityData.findMany({
                where, skip: 0, take: secondTake, orderBy, include: includeClause,
              }),
            ]);
            const archivedData = await this.fetchArchivedRecordsFull(rawArchived.map(r => r.id));
            const idOrder = new Map(rawArchived.map((r, i) => [r.id, i]));
            archivedData.sort((a, b) =>
              (idOrder.get(a.id as string) ?? 0) - (idOrder.get(b.id as string) ?? 0));
            data = [...archivedData, ...activeData];
          }
        }

        hasNextPage = offset + limit < combinedTotal;
        hasPreviousPage = page > 1;
        total = combinedTotal;
      }
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
          // Contar filhos em ambas tabelas (active + archived)
          const [activeCounts, archivedCounts] = await Promise.all([
            this.prisma.entityData.groupBy({
              by: ['parentRecordId'],
              where: {
                entityId: subField.subEntityId!,
                parentRecordId: { in: recordIds },
              },
              _count: { id: true },
            }),
            this.prisma.archivedEntityData.groupBy({
              by: ['parentRecordId'],
              where: {
                entityId: subField.subEntityId!,
                parentRecordId: { in: recordIds },
              },
              _count: { id: true },
            }),
          ]);

          for (const c of [...activeCounts, ...archivedCounts]) {
            if (!c.parentRecordId) continue;
            const existing = childCountsMap.get(c.parentRecordId) || {};
            existing[subField.slug] = (existing[subField.slug] || 0) + c._count.id;
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

    // =========================================================================
    // RESOLVER DISPLAY VALUES DE CAMPOS RELATION
    // =========================================================================
    if (enrichedData.length > 0) {
      const allEntityFields = (entity.fields as unknown) as EntityField[];
      const relationFields = allEntityFields.filter(f => f.type === 'relation' && f.relatedEntitySlug);

      if (relationFields.length > 0) {
        // Coletar todos os IDs de relacao por campo
        const idsByField = new Map<string, Set<string>>();
        for (const rf of relationFields) {
          const ids = new Set<string>();
          for (const record of enrichedData) {
            const recordData = (record as Record<string, unknown>).data as Record<string, unknown>;
            const val = recordData?.[rf.slug];
            if (val && typeof val === 'string') ids.add(val);
          }
          if (ids.size > 0) idsByField.set(rf.slug, ids);
        }

        // Batch-fetch registros relacionados
        const allRelationIds = [...new Set([...idsByField.values()].flatMap(s => [...s]))];
        if (allRelationIds.length > 0) {
          const relatedRecords = await this.prisma.entityData.findMany({
            where: { id: { in: allRelationIds } },
            select: { id: true, data: true, entityId: true },
          });
          const relatedMap = new Map(relatedRecords.map(r => [r.id, r]));

          // Construir mapa de displayField por campo relacao
          const displayFieldBySlug = new Map<string, string>();
          for (const rf of relationFields) {
            if (rf.relatedDisplayField) {
              displayFieldBySlug.set(rf.slug, rf.relatedDisplayField);
            } else {
              // Fallback: buscar entidade relacionada e pegar primeiro campo texto
              const relEntity = await this.prisma.entity.findFirst({
                where: { slug: rf.relatedEntitySlug, tenantId: effectiveTenantId },
                select: { fields: true },
              });
              if (relEntity) {
                const relFields = (relEntity.fields as unknown) as EntityField[];
                const firstTextField = relFields?.find(f => ['text', 'email'].includes(f.type));
                if (firstTextField) displayFieldBySlug.set(rf.slug, firstTextField.slug);
              }
            }
          }

          // Enriquecer registros substituindo IDs por { value, label }
          enrichedData = enrichedData.map(record => {
            const recordData = { ...((record as Record<string, unknown>).data as Record<string, unknown>) };
            let changed = false;

            for (const rf of relationFields) {
              const val = recordData[rf.slug];
              if (val && typeof val === 'string') {
                const related = relatedMap.get(val);
                if (related) {
                  const relData = related.data as Record<string, unknown>;
                  const displayField = displayFieldBySlug.get(rf.slug);
                  const label = displayField ? String(relData?.[displayField] || val) : val;
                  recordData[rf.slug] = { value: val, label };
                  changed = true;
                }
              }
            }

            return changed ? { ...record, data: recordData } : record;
          });
        }
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

    // =========================================================================
    // FORMATACAO: adicionar _formatted com valores formatados para display
    // =========================================================================
    enrichedData = enrichedData.map(record => {
      const recordData = (record as Record<string, unknown>).data as Record<string, unknown>;
      return {
        ...record,
        _formatted: formatRecordData(recordData, entityFields, {
          visibleFields: visibleFields,
        }),
      };
    });

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

  /**
   * Lista dados arquivados de uma entidade com paginacao simples.
   */
  async findAllArchived(
    entitySlug: string,
    query: QueryDataDto,
    currentUser: CurrentUser,
  ) {
    await this.checkEntityPermission(currentUser.id, entitySlug, 'canRead');

    const page = parseInt(String(query.page || '1'), 10) || 1;
    const rawArchivedLimit = Math.max(1, parseInt(String(query.limit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT);
    const limit = query._skipMaxLimit ? rawArchivedLimit : Math.min(MAX_LIMIT, rawArchivedLimit);
    const { search, sortBy = 'createdAt', sortOrder = 'desc', tenantId: queryTenantId } = query;

    const effectiveTenantId = getEffectiveTenantId(currentUser, queryTenantId);
    const entity = await this.queryService.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    const where: Prisma.ArchivedEntityDataWhereInput = {
      entityId: entity.id,
    };

    const userRoleType = currentUser.customRole?.roleType as RoleType | undefined;
    if (userRoleType === 'PLATFORM_ADMIN') {
      if (queryTenantId) where.tenantId = queryTenantId;
    } else {
      where.tenantId = currentUser.tenantId;
    }

    // Busca textual simples no JSON
    if (search) {
      const settings = entity.settings as EntitySettings;
      const searchFields = settings?.searchFields || [];
      if (searchFields.length > 0) {
        const searchVariants = [search];
        if (search !== search.toUpperCase()) searchVariants.push(search.toUpperCase());
        if (search !== search.toLowerCase()) searchVariants.push(search.toLowerCase());
        where.OR = searchFields.flatMap((field: string) =>
          searchVariants.map(term => ({
            data: { path: [field], string_contains: term },
          }))
        );
      }
    }

    const TOP_LEVEL_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'id', 'archivedAt']);
    const isTopLevel = TOP_LEVEL_SORT_FIELDS.has(sortBy);

    let data: Array<Record<string, unknown>>;
    let total: number;

    if (isTopLevel) {
      const [rawData, totalCount] = await Promise.all([
        this.prisma.archivedEntityData.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.prisma.archivedEntityData.count({ where }),
      ]);
      data = rawData.map(r => ({ ...r, _isArchived: true }));
      total = totalCount;
    } else {
      // JSON field sort: fetch all, sort in memory, paginate
      const [allItems, totalCount] = await Promise.all([
        this.prisma.archivedEntityData.findMany({
          where,
          select: { id: true, data: true },
        }),
        this.prisma.archivedEntityData.count({ where }),
      ]);

      allItems.sort((a, b) => {
        const aVal = (a.data as Record<string, unknown>)?.[sortBy];
        const bVal = (b.data as Record<string, unknown>)?.[sortBy];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const comp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
        return sortOrder === 'desc' ? -comp : comp;
      });

      const offset = (page - 1) * limit;
      const paginatedIds = allItems.slice(offset, offset + limit).map(r => r.id);

      const fullRecords = paginatedIds.length > 0
        ? await this.prisma.archivedEntityData.findMany({
            where: { id: { in: paginatedIds } },
          })
        : [];

      const idOrder = new Map(paginatedIds.map((id, i) => [id, i]));
      data = fullRecords
        .sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))
        .map(r => ({ ...r, _isArchived: true }));
      total = totalCount;
    }

    // Adicionar _formatted
    const archivedFields = (entity.fields as unknown) as Array<{ slug: string; type: string }>;
    const formattedData = data.map(record => ({
      ...record,
      _formatted: formatRecordData(record.data as Record<string, unknown>, archivedFields),
    }));

    return {
      data: formattedData,
      meta: createPaginationMeta(total, page, limit, {
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
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

    const effectiveTenantId = getEffectiveTenantId(currentUser, tenantId);
    const entity = await this.queryService.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // PLATFORM_ADMIN pode ver registro de qualquer tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.EntityDataWhereInput = {
      id,
      entityId: entity.id,
    };

    if (roleType !== 'PLATFORM_ADMIN') {
      whereClause.tenantId = currentUser.tenantId;
    }

    let record = await this.prisma.entityData.findFirst({
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

    // Fallback: buscar em ArchivedEntityData se nao encontrado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let recordResult: any = record;
    if (!record) {
      const archivedWhereClause: Prisma.ArchivedEntityDataWhereInput = {
        id,
        entityId: entity.id,
      };
      if (roleType !== 'PLATFORM_ADMIN') {
        archivedWhereClause.tenantId = currentUser.tenantId;
      }

      const archivedRecord = await this.prisma.archivedEntityData.findFirst({
        where: archivedWhereClause,
      });

      if (!archivedRecord) {
        throw new NotFoundException('Registro nao encontrado');
      }

      // Enriquecer com info de user/tenant manualmente
      const [users, tenantInfo] = await Promise.all([
        this.prisma.user.findMany({
          where: { id: { in: [archivedRecord.createdById, archivedRecord.updatedById].filter(Boolean) as string[] } },
          select: { id: true, name: true, email: true },
        }),
        this.prisma.tenant.findFirst({
          where: { id: archivedRecord.tenantId },
          select: { id: true, name: true, slug: true },
        }),
      ]);
      const userMap = new Map(users.map(u => [u.id, u]));

      recordResult = {
        ...archivedRecord,
        _isArchived: true,
        tenant: tenantInfo,
        createdBy: archivedRecord.createdById ? userMap.get(archivedRecord.createdById) || null : null,
        updatedBy: archivedRecord.updatedById ? userMap.get(archivedRecord.updatedById) || null : null,
      };
    }

    if (!recordResult) {
      throw new NotFoundException('Registro nao encontrado');
    }

    // Verificar scope: se usuario tem scope 'own', so pode ver proprios registros
    if (roleType !== 'PLATFORM_ADMIN') {
      const scope = await this.customRoleService.getEntityScope(currentUser.id, entitySlug);
      if (scope === 'own' && recordResult.createdById !== currentUser.id) {
        throw new ForbiddenException('Acesso negado a este registro');
      }
    }

    // Verificar filtros de dados por role (apenas para registros ativos — archived nao tem role filters)
    if (!recordResult._isArchived && roleType !== 'PLATFORM_ADMIN' && roleType !== 'ADMIN') {
      const roleFilterWhere: Prisma.EntityDataWhereInput = { id: recordResult.id };
      this.queryService.applyRoleDataFilters(roleFilterWhere, currentUser, entitySlug);

      // Se filtros foram adicionados, verificar se o registro passa
      if (roleFilterWhere.AND && (roleFilterWhere.AND as Prisma.EntityDataWhereInput[]).length > 0) {
        const allowed = await this.prisma.entityData.findFirst({ where: roleFilterWhere, select: { id: true } });
        if (!allowed) {
          throw new ForbiddenException('Acesso negado a este registro');
        }
      }
    }

    // Field-level permissions: filtrar campos que o usuario nao pode ver
    const fieldPerms = await this.customRoleService.getFieldPermissions(currentUser.id, entitySlug);
    let filteredRecord = recordResult;
    let visibleFields: string[] | undefined;
    let editableFields: string[] | undefined;

    if (fieldPerms && fieldPerms.length > 0) {
      const viewableSet = new Set(fieldPerms.filter(f => f.canView).map(f => f.fieldSlug));
      visibleFields = Array.from(viewableSet);
      editableFields = fieldPerms.filter(f => f.canEdit).map(f => f.fieldSlug);

      const recordData = recordResult.data as Record<string, unknown>;
      const filteredData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(recordData)) {
        if (viewableSet.has(key)) filteredData[key] = value;
      }
      filteredRecord = { ...recordResult, data: filteredData };
    }

    // Adicionar _formatted
    const findOneFields = (entity.fields as unknown) as Array<{ slug: string; type: string }>;
    const _formatted = formatRecordData(
      filteredRecord.data as Record<string, unknown>,
      findOneFields,
      { visibleFields },
    );

    return {
      ...filteredRecord,
      _formatted,
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
    const entity = await this.queryService.getEntityCached(entitySlug, currentUser, effectiveTenantId);

    // PLATFORM_ADMIN pode editar registro de qualquer tenant
    const roleType = currentUser.customRole?.roleType as RoleType | undefined;
    const whereClause: Prisma.EntityDataWhereInput = {
      id,
      entityId: entity.id,
    };

    if (roleType !== 'PLATFORM_ADMIN') {
      whereClause.tenantId = currentUser.tenantId;
    }

    // Buscar registro (active ou archived)
    let record = await this.prisma.entityData.findFirst({
      where: whereClause,
    });

    let isArchivedRecord = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let archivedRecord: any = null;

    if (!record) {
      // Fallback: buscar em ArchivedEntityData
      const archivedWhereClause: Prisma.ArchivedEntityDataWhereInput = {
        id,
        entityId: entity.id,
      };
      if (roleType !== 'PLATFORM_ADMIN') {
        archivedWhereClause.tenantId = currentUser.tenantId;
      }
      archivedRecord = await this.prisma.archivedEntityData.findFirst({
        where: archivedWhereClause,
      });
      if (!archivedRecord) {
        throw new NotFoundException('Registro nao encontrado');
      }
      isArchivedRecord = true;
    }

    const activeRecord = record || archivedRecord;

    // Verificar permissao de escopo (exceto PLATFORM_ADMIN)
    if (roleType !== 'PLATFORM_ADMIN') {
      // Para archived: verificar scope manualmente (checkScope espera EntityData)
      if (isArchivedRecord) {
        const scope = await this.customRoleService.getEntityScope(currentUser.id, entitySlug);
        if (scope === 'own' && archivedRecord.createdById !== currentUser.id) {
          throw new ForbiddenException('Acesso negado a este registro');
        }
      } else {
        await this.checkScope(record!, currentUser, entitySlug);
      }
    }

    // Lock check: se a entidade tem lockField e o registro esta travado, bloquear edicao
    const lockSettings = entity.settings as EntitySettings;
    if (lockSettings?.lockField) {
      const recordData = activeRecord.data as Record<string, unknown>;
      if (recordData[lockSettings.lockField] === true) {
        const rt = currentUser.customRole?.roleType;
        const isPrivileged = rt === 'PLATFORM_ADMIN' || rt === 'ADMIN';
        if (!isPrivileged) {
          // Checar canEditLocked na permission da entidade
          const permissions = currentUser.customRole?.permissions as Array<Record<string, unknown>> | undefined;
          const entityPerm = permissions?.find((p) => p.entitySlug === entitySlug);
          if (!entityPerm?.canEditLocked) {
            throw new ForbiddenException('Este registro esta finalizado e nao pode ser editado');
          }
        }
      }
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

    // Processar campos calculados (formula, rollup, timer, sla-status)
    const fields = (entity.fields as unknown) as EntityField[];
    const settings = entity.settings as EntitySettings;
    const previousData = activeRecord.data as Record<string, unknown>;
    const inputData = dto.data as Record<string, unknown> || {};
    const dataWithComputedFields = await this.computedFieldsService.processComputedFields(
      { ...previousData, ...inputData },
      fields,
      entity.id,
      effectiveTenantId,
      id,
      previousData,
      settings,
    );

    // Validar dados (apos aplicar Custom API e campos calculados)
    const errors = this.entityService.validateData(fields, dataWithComputedFields);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    // Validar campos unicos (excluindo o proprio registro)
    await this.validateUniqueFields(fields, dataWithComputedFields, entity.id, effectiveTenantId, id);

    // Merge dos dados existentes com os novos (incluindo Custom API e campos calculados)
    const mergedData = {
      ...(activeRecord.data as Record<string, unknown>),
      ...dataWithComputedFields,
    };

    let updatedRecord;
    if (isArchivedRecord) {
      // Update na tabela ArchivedEntityData
      updatedRecord = await this.prisma.archivedEntityData.update({
        where: { id },
        data: {
          data: mergedData as Prisma.InputJsonValue,
          updatedById: currentUser.id,
        },
      });
    } else {
      // Update na tabela EntityData (comportamento original)
      updatedRecord = await this.prisma.entityData.update({
        where: { id },
        data: {
          data: mergedData as Prisma.InputJsonValue,
          updatedById: currentUser.id,
        },
      });
    }

    // Enviar notificacao para o tenant
    const titleField = settings?.titleField || 'nome';
    const recordName = String((mergedData as Record<string, unknown>)[titleField] || activeRecord.id);

    this.notificationService.notifyRecordUpdated(
      effectiveTenantId,
      entity.name,
      recordName,
      currentUser.name,
      entitySlug,
      mergedData as Record<string, unknown>,
    ).catch((err) => this.logger.error('Failed to send notification', err));

    this.auditService.log(currentUser, {
      action: 'update', resource: 'entity_data', resourceId: id,
      oldData: activeRecord.data as Record<string, unknown>,
      newData: mergedData as Record<string, unknown>,
      metadata: { entitySlug, entityId: entity.id },
    }).catch(() => {});

    // Real-time: granular update for all tenant clients
    this.notificationService.emitDataChanged(effectiveTenantId, {
      operation: 'updated',
      entitySlug,
      record: {
        id: updatedRecord.id,
        data: mergedData as Record<string, unknown>,
        updatedAt: updatedRecord.updatedAt.toISOString(),
      },
      userId: currentUser.id,
    });

    // Disparar webhooks e action chains
    // Detectar se houve mudanca de status para evento 'status-changed'
    const statusFields = fields.filter((f: EntityField) => f.type === 'workflow-status' || f.type === 'select');
    let hasStatusChange = false;
    for (const statusField of statusFields) {
      const oldStatus = previousData[statusField.slug];
      const newStatus = (mergedData as Record<string, unknown>)[statusField.slug];
      if (oldStatus !== newStatus) {
        hasStatusChange = true;
        break;
      }
    }

    this.triggerAutomations(
      hasStatusChange ? 'status-changed' : 'updated',
      effectiveTenantId,
      { id: entity.id, slug: entitySlug, name: entity.name },
      { id: updatedRecord.id, ...mergedData },
      currentUser,
      previousData,
    );

    return updatedRecord;
  }

  async remove(entitySlug: string, id: string, currentUser: CurrentUser, tenantId?: string) {
    // Verificar permissao de exclusao na entidade
    await this.checkEntityPermission(currentUser.id, entitySlug, 'canDelete');

    const effectiveTenantId = getEffectiveTenantId(currentUser, tenantId);
    const entity = await this.queryService.getEntityCached(entitySlug, currentUser, effectiveTenantId);

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

    let isArchivedDeletion = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetRecord: any = record;

    if (!record) {
      // Fallback: buscar em ArchivedEntityData
      const archivedWhereClause: Prisma.ArchivedEntityDataWhereInput = {
        id,
        entityId: entity.id,
      };
      if (roleType !== 'PLATFORM_ADMIN') {
        archivedWhereClause.tenantId = currentUser.tenantId;
      }
      const archivedRecord = await this.prisma.archivedEntityData.findFirst({
        where: archivedWhereClause,
      });
      if (!archivedRecord) {
        throw new NotFoundException('Registro nao encontrado');
      }
      targetRecord = archivedRecord;
      isArchivedDeletion = true;
    }

    // Verificar permissao de escopo (exceto PLATFORM_ADMIN)
    if (roleType !== 'PLATFORM_ADMIN') {
      if (isArchivedDeletion) {
        const scope = await this.customRoleService.getEntityScope(currentUser.id, entitySlug);
        if (scope === 'own' && targetRecord.createdById !== currentUser.id) {
          throw new ForbiddenException('Acesso negado a este registro');
        }
      } else {
        await this.checkScope(record!, currentUser, entitySlug);
      }
    }

    // Extrair nome do registro antes de deletar
    const settings = entity.settings as EntitySettings;
    const titleField = settings?.titleField || 'nome';
    const recordData = targetRecord.data as Record<string, unknown>;
    const recordName = String(recordData[titleField] || targetRecord.id);

    if (isArchivedDeletion) {
      await this.prisma.archivedEntityData.delete({ where: { id } });
    } else {
      await this.prisma.entityData.delete({ where: { id } });
    }

    // Enviar notificacao para o tenant
    this.notificationService.notifyRecordDeleted(
      effectiveTenantId,
      entity.name,
      recordName,
      currentUser.name,
      entitySlug,
      recordData,
    ).catch((err) => this.logger.error('Failed to send notification', err));

    this.auditService.log(currentUser, {
      action: 'delete', resource: 'entity_data', resourceId: id,
      oldData: recordData,
      metadata: { entitySlug, entityId: entity.id },
    }).catch(() => {});

    // Real-time: granular update for all tenant clients
    this.notificationService.emitDataChanged(effectiveTenantId, {
      operation: 'deleted',
      entitySlug,
      recordId: id,
      userId: currentUser.id,
    });

    // Disparar webhooks e action chains
    this.triggerAutomations(
      'deleted',
      effectiveTenantId,
      { id: entity.id, slug: entitySlug, name: entity.name },
      { id, ...recordData },
      currentUser,
    );

    return { message: 'Registro excluido com sucesso' };
  }

  /**
   * Busca registros completos de ArchivedEntityData por IDs, retorna com _isArchived flag
   * e dados de user/tenant enriquecidos manualmente (ArchivedEntityData nao tem relations Prisma).
   */
  private async fetchArchivedRecordsFull(
    ids: string[],
  ): Promise<Array<Record<string, unknown>>> {
    if (ids.length === 0) return [];

    const records = await this.prisma.archivedEntityData.findMany({
      where: { id: { in: ids } },
    });

    // Coletar user IDs para buscar nomes
    const userIds = new Set<string>();
    const tenantIds = new Set<string>();
    for (const r of records) {
      if (r.createdById) userIds.add(r.createdById);
      if (r.updatedById) userIds.add(r.updatedById);
      tenantIds.add(r.tenantId);
    }

    const [users, tenants] = await Promise.all([
      userIds.size > 0
        ? this.prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, name: true, email: true },
          })
        : [],
      tenantIds.size > 0
        ? this.prisma.tenant.findMany({
            where: { id: { in: [...tenantIds] } },
            select: { id: true, name: true, slug: true },
          })
        : [],
    ]);

    const userMap = new Map(users.map(u => [u.id, u]));
    const tenantMap = new Map(tenants.map(t => [t.id, t]));

    return records.map(r => ({
      ...r,
      _isArchived: true,
      createdBy: r.createdById ? userMap.get(r.createdById) || null : null,
      updatedBy: r.updatedById ? userMap.get(r.updatedById) || null : null,
      tenant: tenantMap.get(r.tenantId) || null,
    }));
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
  private async checkScope(record: EntityData, user: CurrentUser, entitySlug: string) {
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

    // CUSTOM: respeitar o scope da permissao (all ou own)
    if (roleType === 'CUSTOM') {
      const scope = await this.customRoleService.getEntityScope(user.id, entitySlug);
      if (scope === 'all') return;
      // scope === 'own' ou null: so pode modificar proprios registros
      if (record.createdById !== user.id) {
        throw new ForbiddenException('Voce so pode modificar registros criados por voce');
      }
      return;
    }

    // USER so pode modificar proprios registros
    if (roleType === 'USER') {
      if (record.createdById !== user.id) {
        throw new ForbiddenException('Voce so pode modificar registros criados por voce');
      }
    }
  }
}
