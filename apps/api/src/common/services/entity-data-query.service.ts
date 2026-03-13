import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityService } from '../../modules/entity/entity.service';
import { CustomRoleService } from '../../modules/custom-role/custom-role.service';
import { Prisma, Entity } from '@prisma/client';
import { CurrentUser } from '../types';
import { RoleType } from '../decorators/roles.decorator';
import { getEffectiveTenantId } from '../utils/tenant.util';
import { buildFilterClause } from '../utils/build-filter-clause';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface GlobalFilter {
  fieldSlug: string;
  fieldName?: string;
  fieldType: string;
  operator: string;
  value?: unknown;
  value2?: unknown;
}

export interface DashboardFilterOptions {
  filters?: string;
  dateStart?: string;
  dateEnd?: string;
}

export interface BuildWhereOptions {
  entitySlug: string;
  user: CurrentUser;
  tenantId?: string;
  parentRecordId?: string;
  includeChildren?: boolean;
  filters?: string;               // JSON stringified GlobalFilter[]
  dashboardFilters?: DashboardFilterOptions;
  search?: string;
  recordIds?: string[];
  hasChildrenIn?: string;
  skipScope?: boolean;            // para operacoes de sistema
}

export interface BuildWhereResult {
  where: Prisma.EntityDataWhereInput;
  entity: Entity;
  effectiveTenantId: string;
}

// ─── Entity Cache ───────────────────────────────────────────────────────────

const entityCache = new Map<string, { entity: Entity; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class EntityDataQueryService {
  private readonly logger = new Logger(EntityDataQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entityService: EntityService,
    private readonly customRoleService: CustomRoleService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pipeline completo de construcao de WHERE para EntityData.
   * Aplica na ordem: entity → tenant → parentRecordId → recordIds → hasChildrenIn
   *   → scope → globalFilters → roleDataFilters → userFilters → dashboardFilters → search
   */
  async buildWhere(options: BuildWhereOptions): Promise<BuildWhereResult> {
    const {
      entitySlug,
      user,
      tenantId: queryTenantId,
      parentRecordId,
      includeChildren,
      filters,
      dashboardFilters,
      search,
      recordIds,
      hasChildrenIn,
      skipScope,
    } = options;

    const effectiveTenantId = getEffectiveTenantId(user, queryTenantId);

    // 1. Resolver entidade (com cache)
    const entity = await this.getEntityCached(entitySlug, user, effectiveTenantId);

    // 2. Base where
    const where: Prisma.EntityDataWhereInput = {
      entityId: entity.id,
    };

    // 3. Tenant isolation
    const userRoleType = user.customRole?.roleType as RoleType | undefined;
    if (userRoleType === 'PLATFORM_ADMIN') {
      if (queryTenantId) {
        where.tenantId = queryTenantId;
      }
    } else {
      where.tenantId = user.tenantId;
    }

    // 4. Sub-entidade / parentRecordId
    if (parentRecordId) {
      where.parentRecordId = parentRecordId;
    } else if (!includeChildren) {
      where.parentRecordId = null;
    }

    // 5. Record IDs especificos (export de selecionados)
    if (recordIds && recordIds.length > 0) {
      where.id = { in: recordIds };
    }

    // 6. hasChildrenIn — registros que tem filhos em entidade X (active + archived)
    if (hasChildrenIn) {
      const [activeChildren, archivedChildren] = await Promise.all([
        this.prisma.entityData.findMany({
          where: { entityId: hasChildrenIn, parentRecordId: { not: null } },
          select: { parentRecordId: true },
          distinct: ['parentRecordId'],
        }),
        this.prisma.archivedEntityData.findMany({
          where: { entityId: hasChildrenIn, parentRecordId: { not: null } },
          select: { parentRecordId: true },
          distinct: ['parentRecordId'],
        }),
      ]);
      const parentIds = [
        ...new Set([
          ...activeChildren.map(r => r.parentRecordId),
          ...archivedChildren.map(r => r.parentRecordId),
        ].filter(Boolean)),
      ] as string[];
      where.id = { in: parentIds.length > 0 ? parentIds : ['__none__'] };
    }

    // 7. Scope (own = apenas registros criados pelo usuario)
    if (!skipScope) {
      await this.applyScopeFromCustomRole(where, user, entitySlug);
    }

    // 8. Filtros globais da entidade (entity.settings.globalFilters)
    const entitySettings = entity.settings as Record<string, unknown> | null;
    const entityGlobalFilters = (entitySettings?.globalFilters || []) as GlobalFilter[];
    if (entityGlobalFilters.length > 0) {
      this.applyGlobalFilters(where, entityGlobalFilters);
    }

    // 9. Filtros de dados por role (customRole.permissions[].dataFilters)
    this.applyRoleDataFilters(where, user, entitySlug);

    // 10. Filtros do usuario (query parameter)
    if (filters) {
      await this.applyUserFilters(where, filters, effectiveTenantId);
    }

    // 11. Filtros de dashboard (cross-filters, date range, relative dates)
    if (dashboardFilters) {
      await this.applyDashboardFilters(where, dashboardFilters, effectiveTenantId);
    }

    // 12. Busca textual
    if (search) {
      this.applySearchClause(where, search, entity);
    }

    return { where, entity, effectiveTenantId };
  }

  /**
   * Converte EntityDataWhereInput para ArchivedEntityDataWhereInput.
   * Copia: entityId, tenantId, createdById, parentRecordId, OR (search), AND (filters).
   */
  buildArchivedWhere(
    where: Prisma.EntityDataWhereInput,
  ): Prisma.ArchivedEntityDataWhereInput {
    const aw: Prisma.ArchivedEntityDataWhereInput = {};

    if (where.id) aw.id = where.id as string | { in: string[] };
    if (where.entityId) aw.entityId = where.entityId as string;
    if (where.tenantId) aw.tenantId = where.tenantId as string;
    if (where.createdById) aw.createdById = where.createdById as string;
    if (where.parentRecordId !== undefined) aw.parentRecordId = where.parentRecordId as string | null;

    // Copy search OR clauses (data JSON path queries)
    if (where.OR) {
      aw.OR = where.OR as Prisma.ArchivedEntityDataWhereInput[];
    }

    // Copy AND clauses (global filters, role filters — all data JSON path queries)
    if (where.AND) {
      aw.AND = where.AND as Prisma.ArchivedEntityDataWhereInput[];
    }

    // Copy date filters
    if (where.createdAt) aw.createdAt = where.createdAt as Prisma.ArchivedEntityDataWhereInput['createdAt'];
    if (where.updatedAt) aw.updatedAt = where.updatedAt as Prisma.ArchivedEntityDataWhereInput['updatedAt'];

    return aw;
  }

  /**
   * Busca entidade por slug com cache de 5s para evitar queries duplicadas.
   */
  async getEntityCached(entitySlug: string, currentUser: CurrentUser, tenantId?: string): Promise<Entity> {
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

  /**
   * Aplica filtros de dashboard (cross-filters, slicer filters, date range).
   * Extraido de StatsService para reutilizacao.
   */
  async applyDashboardFilters(
    where: Prisma.EntityDataWhereInput,
    options: DashboardFilterOptions,
    tenantId?: string,
  ): Promise<void> {
    // Helper: match JSONB field that could be a plain value or {value, label} object
    const jsonbFieldMatch = (fieldSlug: string, val: unknown): Prisma.EntityDataWhereInput => {
      if (typeof val === 'boolean' || typeof val === 'number') {
        return { data: { path: [fieldSlug], equals: val as Prisma.InputJsonValue } };
      }
      // String values: field could store "BMW" or {"value":"BMW","label":"BMW"}
      return {
        OR: [
          { data: { path: [fieldSlug], equals: val as Prisma.InputJsonValue } },
          { data: { path: [fieldSlug, 'value'], equals: val as Prisma.InputJsonValue } },
        ],
      };
    };

    // Parse JSON filters (cross-filters + slicer filters)
    if (options.filters) {
      let filters: Array<{ fieldSlug: string; operator: string; value: unknown; value2?: unknown; fieldType?: string }>;
      try {
        filters = JSON.parse(options.filters);
      } catch {
        filters = [];
      }

      if (Array.isArray(filters) && filters.length > 0) {
        if (!where.AND) where.AND = [];
        const andArray = where.AND as Prisma.EntityDataWhereInput[];

        // Collect parent/child field filters to resolve in batch (equals/in operators)
        const parentFilters: Array<{ slug: string; value: unknown }> = [];
        const childFilters: Array<{ entitySlug: string; fieldSlug: string; value: unknown }> = [];

        // Collect cross-entity filters for complex operators (contains, gt, between, etc.)
        const parentComplexFilters: Array<{ slug: string; filter: { fieldType: string; operator: string; value: unknown; value2?: unknown } }> = [];
        const childComplexFilters: Array<{ entitySlug: string; fieldSlug: string; filter: { fieldType: string; operator: string; value: unknown; value2?: unknown } }> = [];
        const hasChildrenFilters: Array<{ subEntitySlug: string; value: boolean }> = [];

        for (const filter of filters) {
          if (filter.operator === 'equals' && filter.value !== undefined) {
            // Cross-filter: exact match on JSONB field
            let val: unknown = filter.value;
            if (val === 'true') val = true;
            else if (val === 'false') val = false;
            else if (val === '(vazio)') continue;

            if (filter.fieldSlug.startsWith('parent.')) {
              // Parent field filter — collect for batch resolution
              parentFilters.push({ slug: filter.fieldSlug.slice(7), value: val });
            } else if (filter.fieldSlug.startsWith('child.')) {
              // Child entity filter: child.<entitySlug>.<fieldSlug>
              const parts = filter.fieldSlug.split('.');
              if (parts.length >= 3) {
                childFilters.push({ entitySlug: parts[1], fieldSlug: parts.slice(2).join('.'), value: val });
              }
            } else if (filter.fieldSlug.startsWith('_hasChildren:')) {
              const subSlug = filter.fieldSlug.split(':')[1];
              if (subSlug) {
                hasChildrenFilters.push({
                  subEntitySlug: subSlug,
                  value: val === true || val === 'true',
                });
              }
            } else {
              andArray.push(jsonbFieldMatch(filter.fieldSlug, val));
            }
          } else if (filter.operator === 'in' && Array.isArray(filter.value)) {
            // Multi-select cross-filter: match ANY of the values in JSONB field
            const values = (filter.value as string[]).map((v) => {
              if (v === 'true') return true;
              if (v === 'false') return false;
              return v;
            });
            if (filter.fieldSlug.startsWith('parent.')) {
              // Parent multi-select: collect each value as a separate parent filter possibility
              for (const val of values) {
                parentFilters.push({ slug: filter.fieldSlug.slice(7), value: val });
              }
            } else if (filter.fieldSlug.startsWith('child.')) {
              const parts = filter.fieldSlug.split('.');
              if (parts.length >= 3) {
                for (const val of values) {
                  childFilters.push({ entitySlug: parts[1], fieldSlug: parts.slice(2).join('.'), value: val });
                }
              }
            } else {
              // OR across values: record matches if field equals ANY value
              andArray.push({
                OR: values.map((val) => jsonbFieldMatch(filter.fieldSlug, val)),
              });
            }
          } else if (filter.operator === 'range') {
            // Numeric range slicer
            const range = filter.value as { min?: number; max?: number };
            if (range?.min !== undefined) {
              andArray.push({
                data: { path: [filter.fieldSlug], gte: range.min },
              });
            }
            if (range?.max !== undefined) {
              andArray.push({
                data: { path: [filter.fieldSlug], lte: range.max },
              });
            }
          } else if (filter.operator === 'relative') {
            // Relative date filter on createdAt
            const now = new Date();
            let start: Date | undefined;
            const rel = filter.value as string;
            if (rel === 'last7days') { start = new Date(now); start.setDate(start.getDate() - 7); }
            else if (rel === 'last30days') { start = new Date(now); start.setDate(start.getDate() - 30); }
            else if (rel === 'last90days') { start = new Date(now); start.setDate(start.getDate() - 90); }
            else if (rel === 'thisMonth') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
            else if (rel === 'thisQuarter') { const q = Math.floor(now.getMonth() / 3); start = new Date(now.getFullYear(), q * 3, 1); }
            else if (rel === 'thisYear') { start = new Date(now.getFullYear(), 0, 1); }
            if (start) andArray.push({ createdAt: { gte: start, lte: now } });
          } else {
            // All other operators (contains, startsWith, endsWith, gt, gte, lt, lte, between, isEmpty, isNotEmpty)
            // Use buildFilterClause for proper type-aware filter construction
            const filterFieldType = (filter as { fieldType?: string }).fieldType || 'text';

            if (filter.fieldSlug.startsWith('parent.')) {
              parentComplexFilters.push({
                slug: filter.fieldSlug.slice(7),
                filter: { fieldType: filterFieldType, operator: filter.operator, value: filter.value, value2: (filter as { value2?: unknown }).value2 },
              });
            } else if (filter.fieldSlug.startsWith('child.')) {
              const parts = filter.fieldSlug.split('.');
              if (parts.length >= 3) {
                childComplexFilters.push({
                  entitySlug: parts[1],
                  fieldSlug: parts.slice(2).join('.'),
                  filter: { fieldType: filterFieldType, operator: filter.operator, value: filter.value, value2: (filter as { value2?: unknown }).value2 },
                });
              }
            } else if (filter.fieldSlug.startsWith('_hasChildren:')) {
              const subSlug = filter.fieldSlug.split(':')[1];
              if (subSlug) {
                hasChildrenFilters.push({
                  subEntitySlug: subSlug,
                  value: filter.value === true || filter.value === 'true',
                });
              }
            } else {
              // Direct field filter via buildFilterClause
              const clause = buildFilterClause(filter.fieldSlug, filterFieldType, filter.operator, filter.value, (filter as { value2?: unknown }).value2);
              if (clause) andArray.push(clause);
            }
          }
        }

        // Resolve parent field filters: find parent IDs that match, then filter by parentRecordId.
        // If the entity is NOT a sub-entity (no records with parentRecordId), fall back to
        // applying the filter directly on the field (strip "parent." prefix).
        if (parentFilters.length > 0) {
          // Group by slug: same slug → OR (multi-select), different slugs → AND
          const bySlug = new Map<string, unknown[]>();
          for (const pf of parentFilters) {
            if (!bySlug.has(pf.slug)) bySlug.set(pf.slug, []);
            bySlug.get(pf.slug)!.push(pf.value);
          }

          // Check if this entity actually has sub-entity records (parentRecordId != null)
          // Search BOTH active and archived tables
          const entityId = where.entityId as string | undefined;
          const [hasParentsActive, hasParentsArchived] = entityId
            ? await Promise.all([
                this.prisma.entityData.count({
                  where: { entityId, parentRecordId: { not: null } },
                  take: 1,
                }),
                this.prisma.archivedEntityData.count({
                  where: { entityId, parentRecordId: { not: null } },
                  take: 1,
                }),
              ])
            : [0, 0];
          const hasParents = hasParentsActive + hasParentsArchived;

          if (hasParents > 0) {
            // Entity IS a sub-entity: resolve via parentRecordId
            const parentConditions: Prisma.EntityDataWhereInput[] = [];
            for (const [slug, values] of bySlug) {
              if (values.length === 1) {
                parentConditions.push(jsonbFieldMatch(slug, values[0]));
              } else {
                parentConditions.push({
                  OR: values.map((val) => jsonbFieldMatch(slug, val)),
                });
              }
            }

            const parentWhere: Prisma.EntityDataWhereInput = { AND: parentConditions };
            if (tenantId) parentWhere.tenantId = tenantId;

            // Search parents in BOTH active and archived tables
            const [activeParents, archivedParents] = await Promise.all([
              this.prisma.entityData.findMany({
                where: parentWhere,
                select: { id: true },
              }),
              this.prisma.archivedEntityData.findMany({
                where: parentWhere as Prisma.ArchivedEntityDataWhereInput,
                select: { id: true },
              }),
            ]);
            const parentIds = [
              ...activeParents.map((p) => p.id),
              ...archivedParents.map((p) => p.id),
            ];

            andArray.push({
              parentRecordId: parentIds.length > 0 ? { in: parentIds } : { equals: '__no_match__' },
            });
          } else {
            // Entity is NOT a sub-entity: strip "parent." prefix and apply as direct field filter
            this.logger.log(`[PARENT_FILTER] NOT sub-entity, applying direct field filter`);
            for (const [slug, values] of bySlug) {
              if (values.length === 1) {
                andArray.push(jsonbFieldMatch(slug, values[0]));
              } else {
                andArray.push({
                  OR: values.map((val) => jsonbFieldMatch(slug, val)),
                });
              }
            }
          }
        }

        // Resolve child entity filters: find children that match, then filter parent by ID
        // child.<entitySlug>.<fieldSlug> = value → show parents that have matching children
        if (childFilters.length > 0) {
          // Group child filters by entity slug
          const byEntity = new Map<string, Array<{ fieldSlug: string; value: unknown }>>();
          for (const cf of childFilters) {
            if (!byEntity.has(cf.entitySlug)) byEntity.set(cf.entitySlug, []);
            byEntity.get(cf.entitySlug)!.push({ fieldSlug: cf.fieldSlug, value: cf.value });
          }

          for (const [childEntitySlug, fieldFilters] of byEntity) {
            // Find the child entity ID (scoped to tenant)
            const childEntityWhere: Prisma.EntityWhereInput = { slug: childEntitySlug };
            if (tenantId) childEntityWhere.tenantId = tenantId;

            const childEntity = await this.prisma.entity.findFirst({
              where: childEntityWhere,
              select: { id: true },
            });
            if (!childEntity) continue;

            // Group by fieldSlug: same field → OR (multi-select), different fields → AND
            const byField = new Map<string, unknown[]>();
            for (const ff of fieldFilters) {
              if (!byField.has(ff.fieldSlug)) byField.set(ff.fieldSlug, []);
              byField.get(ff.fieldSlug)!.push(ff.value);
            }

            const childConditions: Prisma.EntityDataWhereInput[] = [];
            for (const [fieldSlug, values] of byField) {
              if (values.length === 1) {
                childConditions.push(jsonbFieldMatch(fieldSlug, values[0]));
              } else {
                childConditions.push({
                  OR: values.map((val) => jsonbFieldMatch(fieldSlug, val)),
                });
              }
            }

            // Find child records that match and collect their parentRecordIds (scoped to tenant)
            // Search BOTH active and archived tables
            const childWhere: Prisma.EntityDataWhereInput = {
              entityId: childEntity.id,
              parentRecordId: { not: null },
              AND: childConditions,
            };
            if (tenantId) childWhere.tenantId = tenantId;

            const [activeChildren, archivedChildren] = await Promise.all([
              this.prisma.entityData.findMany({
                where: childWhere,
                select: { parentRecordId: true },
                distinct: ['parentRecordId'],
              }),
              this.prisma.archivedEntityData.findMany({
                where: childWhere as Prisma.ArchivedEntityDataWhereInput,
                select: { parentRecordId: true },
                distinct: ['parentRecordId'],
              }),
            ]);
            const matchedParentIds = [
              ...activeChildren.map((c) => c.parentRecordId),
              ...archivedChildren.map((c) => c.parentRecordId),
            ].filter(Boolean) as string[];

            andArray.push({
              id: matchedParentIds.length > 0 ? { in: matchedParentIds } : { equals: '__no_match__' },
            });
          }
        }

        // Resolve complex parent filters (operators other than equals/in)
        if (parentComplexFilters.length > 0) {
          const entityId = where.entityId as string | undefined;
          const [hasParentsActive, hasParentsArchived] = entityId
            ? await Promise.all([
                this.prisma.entityData.count({
                  where: { entityId, parentRecordId: { not: null } },
                  take: 1,
                }),
                this.prisma.archivedEntityData.count({
                  where: { entityId, parentRecordId: { not: null } },
                  take: 1,
                }),
              ])
            : [0, 0];
          const hasParents = hasParentsActive + hasParentsArchived;

          if (hasParents > 0) {
            // Entity IS a sub-entity: resolve via parentRecordId
            const parentConditions: Prisma.EntityDataWhereInput[] = [];
            for (const pf of parentComplexFilters) {
              const clause = buildFilterClause(pf.slug, pf.filter.fieldType, pf.filter.operator, pf.filter.value, pf.filter.value2);
              if (clause) parentConditions.push(clause);
            }

            if (parentConditions.length > 0) {
              const parentWhere: Prisma.EntityDataWhereInput = { AND: parentConditions };
              if (tenantId) parentWhere.tenantId = tenantId;

              const [activeParents, archivedParents] = await Promise.all([
                this.prisma.entityData.findMany({
                  where: parentWhere,
                  select: { id: true },
                }),
                this.prisma.archivedEntityData.findMany({
                  where: parentWhere as Prisma.ArchivedEntityDataWhereInput,
                  select: { id: true },
                }),
              ]);
              const parentIds = [
                ...activeParents.map((p) => p.id),
                ...archivedParents.map((p) => p.id),
              ];

              andArray.push({
                parentRecordId: parentIds.length > 0 ? { in: parentIds } : { equals: '__no_match__' },
              });
            }
          } else {
            // Entity is NOT a sub-entity: strip prefix and apply as direct field filter
            this.logger.log(`[PARENT_COMPLEX_FILTER] NOT sub-entity, applying direct field filter`);
            for (const pf of parentComplexFilters) {
              const clause = buildFilterClause(pf.slug, pf.filter.fieldType, pf.filter.operator, pf.filter.value, pf.filter.value2);
              if (clause) andArray.push(clause);
            }
          }
        }

        // Resolve complex child entity filters (operators other than equals/in)
        if (childComplexFilters.length > 0) {
          // Group by entity slug
          const byEntity = new Map<string, Array<{ fieldSlug: string; filter: { fieldType: string; operator: string; value: unknown; value2?: unknown } }>>();
          for (const cf of childComplexFilters) {
            if (!byEntity.has(cf.entitySlug)) byEntity.set(cf.entitySlug, []);
            byEntity.get(cf.entitySlug)!.push({ fieldSlug: cf.fieldSlug, filter: cf.filter });
          }

          for (const [childEntitySlug, fieldFilters] of byEntity) {
            const childEntityWhere: Prisma.EntityWhereInput = { slug: childEntitySlug };
            if (tenantId) childEntityWhere.tenantId = tenantId;

            const childEntity = await this.prisma.entity.findFirst({
              where: childEntityWhere,
              select: { id: true },
            });
            if (!childEntity) continue;

            const childConditions: Prisma.EntityDataWhereInput[] = [];
            for (const ff of fieldFilters) {
              const clause = buildFilterClause(ff.fieldSlug, ff.filter.fieldType, ff.filter.operator, ff.filter.value, ff.filter.value2);
              if (clause) childConditions.push(clause);
            }

            if (childConditions.length === 0) continue;

            const childWhere: Prisma.EntityDataWhereInput = {
              entityId: childEntity.id,
              parentRecordId: { not: null },
              AND: childConditions,
            };
            if (tenantId) childWhere.tenantId = tenantId;

            const [activeChildren, archivedChildren] = await Promise.all([
              this.prisma.entityData.findMany({
                where: childWhere,
                select: { parentRecordId: true },
                distinct: ['parentRecordId'],
              }),
              this.prisma.archivedEntityData.findMany({
                where: childWhere as Prisma.ArchivedEntityDataWhereInput,
                select: { parentRecordId: true },
                distinct: ['parentRecordId'],
              }),
            ]);
            const matchedParentIds = [
              ...activeChildren.map((c) => c.parentRecordId),
              ...archivedChildren.map((c) => c.parentRecordId),
            ].filter(Boolean) as string[];

            andArray.push({
              id: matchedParentIds.length > 0 ? { in: matchedParentIds } : { equals: '__no_match__' },
            });
          }
        }

        // Resolve _hasChildren filters (active + archived children)
        if (hasChildrenFilters.length > 0) {
          for (const hcf of hasChildrenFilters) {
            const childEntityWhere: Prisma.EntityWhereInput = { slug: hcf.subEntitySlug };
            if (tenantId) childEntityWhere.tenantId = tenantId;

            const childEntity = await this.prisma.entity.findFirst({
              where: childEntityWhere,
              select: { id: true },
            });
            if (!childEntity) continue;

            const childWhere = {
              entityId: childEntity.id,
              parentRecordId: { not: null } as { not: null },
              ...(tenantId && { tenantId }),
            };
            const [activeChildren, archivedChildren] = await Promise.all([
              this.prisma.entityData.findMany({
                where: childWhere,
                select: { parentRecordId: true },
                distinct: ['parentRecordId'],
              }),
              this.prisma.archivedEntityData.findMany({
                where: childWhere as Prisma.ArchivedEntityDataWhereInput,
                select: { parentRecordId: true },
                distinct: ['parentRecordId'],
              }),
            ]);
            const parentIdsWithChildren = [
              ...new Set([
                ...activeChildren.map((c) => c.parentRecordId),
                ...archivedChildren.map((c) => c.parentRecordId),
              ].filter(Boolean)),
            ] as string[];

            if (hcf.value) {
              // Has children
              andArray.push({
                id: parentIdsWithChildren.length > 0 ? { in: parentIdsWithChildren } : { equals: '__no_match__' },
              });
            } else {
              // No children
              if (parentIdsWithChildren.length > 0) {
                andArray.push({ id: { notIn: parentIdsWithChildren } });
              }
              // else: no records have children, so no filter needed
            }
          }
        }
      }
    }

    // Date range filter
    if (options.dateStart && options.dateEnd) {
      if (!where.AND) where.AND = [];
      const andArray = where.AND as Prisma.EntityDataWhereInput[];
      andArray.push({
        createdAt: {
          gte: new Date(options.dateStart),
          lte: new Date(options.dateEnd + 'T23:59:59.999Z'),
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Aplica escopo de acesso baseado na CustomRole.
   * scope='own' → filtra apenas registros criados pelo usuario.
   */
  private async applyScopeFromCustomRole(
    where: Prisma.EntityDataWhereInput,
    user: CurrentUser,
    entitySlug: string,
  ): Promise<void> {
    const scope = await this.customRoleService.getEntityScope(user.id, entitySlug);

    if (scope === 'own') {
      where.createdById = user.id;
      this.logger.debug(`Applying scope 'own' for user ${user.id} on entity ${entitySlug}`);
    }
  }

  /**
   * Aplica filtros globais na query (entity.settings.globalFilters ou role dataFilters).
   */
  applyGlobalFilters(
    where: Prisma.EntityDataWhereInput,
    globalFilters: GlobalFilter[],
  ): void {
    if (!globalFilters || globalFilters.length === 0) return;

    if (!where.AND) {
      where.AND = [];
    }
    const andArray = where.AND as Prisma.EntityDataWhereInput[];

    for (const filter of globalFilters) {
      const { fieldSlug, fieldType, operator, value, value2 } = filter;
      const filterClause = buildFilterClause(fieldSlug, fieldType, operator, value, value2);
      if (filterClause) {
        andArray.push(filterClause);
      }
    }
  }

  /**
   * Aplica filtros de dados por role na query.
   * PLATFORM_ADMIN/ADMIN nao recebem filtros.
   */
  applyRoleDataFilters(
    where: Prisma.EntityDataWhereInput,
    user: CurrentUser,
    entitySlug: string,
  ): void {
    const roleType = user.customRole?.roleType as RoleType | undefined;
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') return;
    if (!user.customRole) return;

    const roleFilters = this.customRoleService.getRoleDataFilters(
      user.customRole as { roleType: string; permissions: unknown },
      entitySlug,
    );

    if (roleFilters.length > 0) {
      this.applyGlobalFilters(where, roleFilters as unknown as GlobalFilter[]);
      this.logger.log(`Applied ${roleFilters.length} role data filters for user ${user.id} on ${entitySlug}`);
    }
  }

  /**
   * Aplica filtros do usuario passados via query parameter (JSON stringified).
   * Suporta prefixos cross-entity: parent.<fieldSlug>, child.<entitySlug>.<fieldSlug>,
   * e filtros virtuais _hasChildren:<subEntitySlug>.
   */
  private async applyUserFilters(
    where: Prisma.EntityDataWhereInput,
    filtersJson: string,
    tenantId?: string,
  ): Promise<void> {
    try {
      const filters = JSON.parse(filtersJson) as GlobalFilter[];
      if (!Array.isArray(filters) || filters.length === 0) return;

      const normalFilters: GlobalFilter[] = [];
      const parentFilters: Array<{ slug: string; filter: GlobalFilter }> = [];
      const childFilters: Array<{ entitySlug: string; fieldSlug: string; filter: GlobalFilter }> = [];
      const hasChildrenFilters: Array<{ subEntitySlug: string; value: boolean }> = [];

      for (const filter of filters) {
        if (filter.fieldSlug.startsWith('parent.')) {
          parentFilters.push({
            slug: filter.fieldSlug.slice(7),
            filter,
          });
        } else if (filter.fieldSlug.startsWith('child.')) {
          const parts = filter.fieldSlug.split('.');
          if (parts.length >= 3) {
            childFilters.push({
              entitySlug: parts[1],
              fieldSlug: parts.slice(2).join('.'),
              filter,
            });
          }
        } else if (filter.fieldSlug.startsWith('_hasChildren:')) {
          const subSlug = filter.fieldSlug.split(':')[1];
          if (subSlug) {
            hasChildrenFilters.push({
              subEntitySlug: subSlug,
              value: filter.value === true || filter.value === 'true',
            });
          }
        } else {
          normalFilters.push(filter);
        }
      }

      // Apply normal filters via existing method
      if (normalFilters.length > 0) {
        this.applyGlobalFilters(where, normalFilters);
      }

      // Resolve cross-entity filters
      if (parentFilters.length > 0 || childFilters.length > 0 || hasChildrenFilters.length > 0) {
        if (!where.AND) where.AND = [];
        const andArray = where.AND as Prisma.EntityDataWhereInput[];

        // Parent field filters: find parent records matching condition, then filter by parentRecordId
        if (parentFilters.length > 0) {
          const entityId = where.entityId as string | undefined;
          const hasParents = entityId
            ? await this.prisma.entityData.count({
                where: { entityId, parentRecordId: { not: null } },
                take: 1,
              })
            : 0;

          if (hasParents > 0) {
            // Build filter clauses for parent records
            const parentConditions: Prisma.EntityDataWhereInput[] = [];
            for (const pf of parentFilters) {
              const clause = buildFilterClause(pf.slug, pf.filter.fieldType, pf.filter.operator, pf.filter.value, pf.filter.value2);
              if (clause) parentConditions.push(clause);
            }

            if (parentConditions.length > 0) {
              const parentWhere: Prisma.EntityDataWhereInput = { AND: parentConditions };
              if (tenantId) parentWhere.tenantId = tenantId;

              const parentRecords = await this.prisma.entityData.findMany({
                where: parentWhere,
                select: { id: true },
              });
              const parentIds = parentRecords.map((p) => p.id);
              andArray.push({
                parentRecordId: parentIds.length > 0 ? { in: parentIds } : { equals: '__no_match__' },
              });
            }
          } else {
            // Not a sub-entity: strip prefix and apply as direct field filter
            for (const pf of parentFilters) {
              const clause = buildFilterClause(pf.slug, pf.filter.fieldType, pf.filter.operator, pf.filter.value, pf.filter.value2);
              if (clause) andArray.push(clause);
            }
          }
        }

        // Child entity filters: find children matching condition, then filter parent by ID
        if (childFilters.length > 0) {
          // Group by entity slug
          const byEntity = new Map<string, Array<{ fieldSlug: string; filter: GlobalFilter }>>();
          for (const cf of childFilters) {
            if (!byEntity.has(cf.entitySlug)) byEntity.set(cf.entitySlug, []);
            byEntity.get(cf.entitySlug)!.push({ fieldSlug: cf.fieldSlug, filter: cf.filter });
          }

          for (const [childEntitySlug, fieldFilters] of byEntity) {
            const childEntityWhere: Prisma.EntityWhereInput = { slug: childEntitySlug };
            if (tenantId) childEntityWhere.tenantId = tenantId;

            const childEntity = await this.prisma.entity.findFirst({
              where: childEntityWhere,
              select: { id: true },
            });
            if (!childEntity) continue;

            const childConditions: Prisma.EntityDataWhereInput[] = [];
            for (const ff of fieldFilters) {
              const clause = buildFilterClause(ff.fieldSlug, ff.filter.fieldType, ff.filter.operator, ff.filter.value, ff.filter.value2);
              if (clause) childConditions.push(clause);
            }

            if (childConditions.length === 0) continue;

            const childWhere: Prisma.EntityDataWhereInput = {
              entityId: childEntity.id,
              parentRecordId: { not: null },
              AND: childConditions,
            };
            if (tenantId) childWhere.tenantId = tenantId;

            const childRecords = await this.prisma.entityData.findMany({
              where: childWhere,
              select: { parentRecordId: true },
              distinct: ['parentRecordId'],
            });
            const parentIds = childRecords.map((c) => c.parentRecordId).filter(Boolean) as string[];
            andArray.push({
              id: parentIds.length > 0 ? { in: parentIds } : { equals: '__no_match__' },
            });
          }
        }

        // Has children filters (active + archived children)
        if (hasChildrenFilters.length > 0) {
          for (const hcf of hasChildrenFilters) {
            const childEntityWhere: Prisma.EntityWhereInput = { slug: hcf.subEntitySlug };
            if (tenantId) childEntityWhere.tenantId = tenantId;

            const childEntity = await this.prisma.entity.findFirst({
              where: childEntityWhere,
              select: { id: true },
            });
            if (!childEntity) continue;

            const childWhere = {
              entityId: childEntity.id,
              parentRecordId: { not: null } as { not: null },
              ...(tenantId && { tenantId }),
            };
            const [activeChildren, archivedChildren] = await Promise.all([
              this.prisma.entityData.findMany({
                where: childWhere,
                select: { parentRecordId: true },
                distinct: ['parentRecordId'],
              }),
              this.prisma.archivedEntityData.findMany({
                where: childWhere as Prisma.ArchivedEntityDataWhereInput,
                select: { parentRecordId: true },
                distinct: ['parentRecordId'],
              }),
            ]);
            const parentIdsWithChildren = [
              ...new Set([
                ...activeChildren.map((c) => c.parentRecordId),
                ...archivedChildren.map((c) => c.parentRecordId),
              ].filter(Boolean)),
            ] as string[];

            if (hcf.value) {
              // Has children
              andArray.push({
                id: parentIdsWithChildren.length > 0 ? { in: parentIdsWithChildren } : { equals: '__no_match__' },
              });
            } else {
              // No children
              if (parentIdsWithChildren.length > 0) {
                andArray.push({ id: { notIn: parentIdsWithChildren } });
              }
              // else: no records have children, so no filter needed
            }
          }
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to parse filters param: ${e}`);
    }
  }

  /**
   * Aplica busca textual nos searchFields da entidade.
   */
  private applySearchClause(
    where: Prisma.EntityDataWhereInput,
    search: string,
    entity: Entity,
  ): void {
    const settings = entity.settings as { searchFields?: string[] } | null;
    const searchFields = settings?.searchFields || [];

    if (searchFields.length > 0) {
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
}
