import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomRoleService } from '../custom-role/custom-role.service';
import { CurrentUser } from '../../common/types';
import { RoleType } from '../../common/decorators/roles.decorator';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { buildFilterClause } from '../../common/utils/build-filter-clause';
import { Prisma, type PrismaClient } from '@prisma/client';
import { DataFilterDto } from '../custom-role/dto/custom-role.dto';

interface DashboardFilterOptions {
  filters?: string;
  dateStart?: string;
  dateEnd?: string;
}

interface GlobalFilter {
  fieldSlug: string;
  fieldType: string;
  operator: string;
  value: unknown;
  value2?: unknown;
}

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customRoleService: CustomRoleService,
  ) {}

  // Helper: resolve tenantId e roleType a partir do user
  private resolveContext(user: CurrentUser, queryTenantId?: string) {
    const roleType = (user.customRole?.roleType || 'USER') as RoleType;
    const effectiveTenantId = getEffectiveTenantId(user, queryTenantId);
    // PLATFORM_ADMIN vendo tenant especifico = trata como 'filtered' (ve tudo daquele tenant)
    const effectiveRole = (roleType === 'PLATFORM_ADMIN' && queryTenantId) ? 'filtered' : roleType;
    return { effectiveTenantId, roleType, effectiveRole };
  }

  // Helper: base where para tenant
  private getWhere(tenantId: string, effectiveRole: string) {
    if (effectiveRole === 'PLATFORM_ADMIN') return {};
    return { tenantId };
  }

  /**
   * Retorna entidades acessiveis ao usuario.
   * CUSTOM roles: apenas entidades com canRead=true na permissions[].
   * Outros roles: todas as entidades do tenant.
   */
  private async getAccessibleEntities(
    user: CurrentUser,
    effectiveTenantId: string,
    roleType: RoleType | string,
  ) {
    const where: Prisma.EntityWhereInput = { tenantId: effectiveTenantId };

    // CUSTOM role: filtrar por entidades com canRead
    if (roleType === 'CUSTOM') {
      const accessibleSlugs = await this.customRoleService.getUserAccessibleEntities(user.id);
      if (accessibleSlugs.length === 0) return [];
      where.slug = { in: accessibleSlugs };
    }

    const entities = await this.prisma.entity.findMany({
      where,
      select: { id: true, slug: true, name: true, settings: true, fields: true },
    });

    // Identificar sub-entidades (referenciadas por campo type=sub-entity)
    const subEntitySlugs = new Set<string>();
    for (const entity of entities) {
      const fields = (entity.fields as unknown as Array<{ type: string; subEntitySlug?: string }>) || [];
      for (const field of fields) {
        if (field.type === 'sub-entity' && field.subEntitySlug) {
          subEntitySlugs.add(field.subEntitySlug);
        }
      }
    }

    // Excluir sub-entidades
    return entities.filter((e) => !subEntitySlugs.has(e.slug));
  }

  /**
   * Conta registros de uma entidade aplicando filtros de role (scope + dataFilters + globalFilters).
   */
  private async countFilteredRecords(
    entity: { id: string; slug: string; settings: unknown },
    user: CurrentUser,
    effectiveTenantId: string,
    roleType: RoleType | string,
  ): Promise<{ active: number; archived: number }> {
    // Base where
    const where: Prisma.EntityDataWhereInput = {
      entityId: entity.id,
      tenantId: effectiveTenantId,
    };

    // Aplicar scope (own = apenas registros criados pelo usuario)
    if (roleType === 'CUSTOM' || roleType === 'USER') {
      const scope = await this.customRoleService.getEntityScope(user.id, entity.slug);
      if (scope === 'own') {
        where.createdById = user.id;
      }
    } else if (roleType !== 'PLATFORM_ADMIN' && roleType !== 'ADMIN' && roleType !== 'MANAGER' && roleType !== 'VIEWER' && roleType !== 'filtered') {
      // Unknown role type, restrict to own
      where.createdById = user.id;
    }

    // Aplicar filtros globais da entidade
    const entitySettings = entity.settings as Record<string, unknown> | null;
    const globalFilters = (entitySettings?.globalFilters || []) as GlobalFilter[];
    if (globalFilters.length > 0) {
      this.applyFilters(where, globalFilters);
    }

    // Aplicar filtros de dados por role
    if (roleType !== 'PLATFORM_ADMIN' && roleType !== 'ADMIN' && roleType !== 'filtered' && user.customRole) {
      const roleFilters = this.customRoleService.getRoleDataFilters(
        user.customRole as { roleType: string; permissions: unknown },
        entity.slug,
      );
      if (roleFilters.length > 0) {
        this.applyFilters(where, roleFilters as unknown as GlobalFilter[]);
      }
    }

    // Construir where para archived (mesma estrutura)
    const archivedWhere: Prisma.ArchivedEntityDataWhereInput = {};
    if (where.entityId) archivedWhere.entityId = where.entityId as string;
    if (where.tenantId) archivedWhere.tenantId = where.tenantId as string;
    if (where.createdById) archivedWhere.createdById = where.createdById as string;
    if (where.AND) archivedWhere.AND = where.AND as Prisma.ArchivedEntityDataWhereInput[];

    const [active, archived] = await Promise.all([
      this.prisma.entityData.count({ where }),
      this.prisma.archivedEntityData.count({ where: archivedWhere }),
    ]);

    return { active, archived };
  }

  /** Aplica filtros na clausula WHERE */
  private applyFilters(where: Prisma.EntityDataWhereInput, filters: GlobalFilter[]): void {
    if (!filters || filters.length === 0) return;
    if (!where.AND) where.AND = [];
    const andArray = where.AND as Prisma.EntityDataWhereInput[];

    for (const filter of filters) {
      const clause = buildFilterClause(filter.fieldSlug, filter.fieldType, filter.operator, filter.value, filter.value2);
      if (clause) andArray.push(clause);
    }
  }

  /**
   * Aplica filtros de dashboard (cross-filters, slicer filters, date range) na clausula WHERE.
   */
  private applyDashboardFilters(
    where: Prisma.EntityDataWhereInput,
    options?: DashboardFilterOptions,
  ): void {
    if (!options) return;

    // Parse JSON filters (cross-filters + slicer filters)
    if (options.filters) {
      let filters: Array<{ fieldSlug: string; operator: string; value: unknown }>;
      try {
        filters = JSON.parse(options.filters);
      } catch {
        filters = [];
      }

      if (Array.isArray(filters) && filters.length > 0) {
        if (!where.AND) where.AND = [];
        const andArray = where.AND as Prisma.EntityDataWhereInput[];

        for (const filter of filters) {
          if (filter.operator === 'equals' && filter.value !== undefined) {
            // Cross-filter: exact match on JSONB field
            let val: unknown = filter.value;
            if (val === 'true') val = true;
            else if (val === 'false') val = false;
            else if (val === '(vazio)') continue;

            andArray.push({
              data: {
                path: [filter.fieldSlug],
                equals: val as Prisma.InputJsonValue,
              },
            });
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

  async getDashboardStats(user: CurrentUser, queryTenantId?: string) {
    const { effectiveTenantId, roleType, effectiveRole } = this.resolveContext(user, queryTenantId);
    const where = this.getWhere(effectiveTenantId, effectiveRole);

    // Buscar entidades acessiveis
    const entities = await this.getAccessibleEntities(user, effectiveTenantId, roleType);

    // Contar registros filtrados por entity
    let totalRecords = 0;
    if (entities.length > 0) {
      const counts = await Promise.all(
        entities.map((e) => this.countFilteredRecords(e, user, effectiveTenantId, roleType)),
      );
      totalRecords = counts.reduce((sum, c) => sum + c.active + c.archived, 0);
    }

    const [totalUsers, totalTenants] = await Promise.all([
      this.prisma.user.count({ where }),
      roleType === 'PLATFORM_ADMIN'
        ? this.prisma.tenant.count()
        : Promise.resolve(0),
    ]);

    return {
      totalEntities: entities.length,
      totalRecords,
      totalUsers,
      ...(roleType === 'PLATFORM_ADMIN' ? { totalTenants } : {}),
    };
  }

  async getRecordsOverTime(user: CurrentUser, queryTenantId?: string, days: number = 30) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Buscar entidades acessiveis
    const entities = await this.getAccessibleEntities(user, effectiveTenantId, roleType);
    const entityIds = entities.map((e) => e.id);

    if (entityIds.length === 0) {
      return this.fillDates(startDate, {});
    }

    // Base where com filtro de data e entidades acessiveis
    const where: Prisma.EntityDataWhereInput = {
      entityId: { in: entityIds },
      tenantId: effectiveTenantId,
      createdAt: { gte: startDate },
    };

    // Aplicar scope para USER/CUSTOM
    if (roleType === 'USER') {
      where.createdById = user.id;
    } else if (roleType === 'CUSTOM') {
      // Para CUSTOM, verificar se alguma entidade tem scope 'own'
      // Simplificacao: se todas as entidades tem scope 'own', filtrar
      const hasOwnScope = await this.hasAnyOwnScope(user, entities);
      if (hasOwnScope) {
        where.createdById = user.id;
      }
    }

    const records = await this.prisma.entityData.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = records.reduce(
      (acc: Record<string, number>, record: { createdAt: Date }) => {
        const date = record.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {},
    );

    return this.fillDates(startDate, grouped);
  }

  private fillDates(startDate: Date, grouped: Record<string, number>) {
    const result: { date: string; count: number }[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      result.push({ date: dateStr, count: grouped[dateStr] || 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  /** Verifica se o usuario tem scope 'own' em alguma entidade */
  private async hasAnyOwnScope(
    user: CurrentUser,
    entities: { slug: string }[],
  ): Promise<boolean> {
    const permissions = (user.customRole?.permissions || []) as Array<{
      entitySlug: string;
      scope?: 'all' | 'own';
    }>;

    for (const entity of entities) {
      const perm = permissions.find((p) => p.entitySlug === entity.slug);
      if (perm?.scope === 'own') return true;
    }
    return false;
  }

  async getEntitiesDistribution(user: CurrentUser, queryTenantId?: string) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);

    // Buscar entidades acessiveis
    const entities = await this.getAccessibleEntities(user, effectiveTenantId, roleType);

    if (entities.length === 0) return [];

    // Contar registros filtrados por entity
    const results = await Promise.all(
      entities.map(async (entity) => {
        const counts = await this.countFilteredRecords(entity, user, effectiveTenantId, roleType);
        return {
          name: entity.name,
          slug: entity.slug,
          records: counts.active + counts.archived,
        };
      }),
    );

    return results.filter((item) => item.records > 0);
  }

  async getUsersActivity(user: CurrentUser, queryTenantId?: string, days: number = 7) {
    const { effectiveTenantId, effectiveRole } = this.resolveContext(user, queryTenantId);
    const where = this.getWhere(effectiveTenantId, effectiveRole);

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        lastLoginAt: true,
      },
      orderBy: { lastLoginAt: { sort: 'desc', nulls: 'last' } },
      take: 10,
    });

    return users;
  }

  /**
   * Busca uma entidade especifica e valida acesso do usuario.
   */
  private async getEntityBySlug(
    user: CurrentUser,
    entitySlug: string,
    effectiveTenantId: string,
    roleType: RoleType | string,
  ) {
    const entities = await this.getAccessibleEntities(user, effectiveTenantId, roleType);
    const entity = entities.find((e) => e.slug === entitySlug);
    if (!entity) return null;
    return entity;
  }

  /**
   * Monta WHERE base para EntityData de uma entidade, com scope de role.
   */
  private async buildEntityDataWhere(
    user: CurrentUser,
    entityId: string,
    effectiveTenantId: string,
    roleType: RoleType | string,
    entitySlug: string,
    entitySettings?: unknown,
  ): Promise<Prisma.EntityDataWhereInput> {
    const where: Prisma.EntityDataWhereInput = {
      entityId,
      tenantId: effectiveTenantId,
    };

    // Aplicar scope para USER/CUSTOM
    if (roleType === 'CUSTOM' || roleType === 'USER') {
      const scope = await this.customRoleService.getEntityScope(user.id, entitySlug);
      if (scope === 'own') {
        where.createdById = user.id;
      }
    } else if (
      roleType !== 'PLATFORM_ADMIN' &&
      roleType !== 'ADMIN' &&
      roleType !== 'MANAGER' &&
      roleType !== 'VIEWER' &&
      roleType !== 'filtered'
    ) {
      where.createdById = user.id;
    }

    // Aplicar filtros globais
    const settings = entitySettings as Record<string, unknown> | null;
    const globalFilters = (settings?.globalFilters || []) as GlobalFilter[];
    if (globalFilters.length > 0) {
      this.applyFilters(where, globalFilters);
    }

    // Aplicar filtros de dados por role
    if (
      roleType !== 'PLATFORM_ADMIN' &&
      roleType !== 'ADMIN' &&
      roleType !== 'filtered' &&
      user.customRole
    ) {
      const roleFilters = this.customRoleService.getRoleDataFilters(
        user.customRole as { roleType: string; permissions: unknown },
        entitySlug,
      );
      if (roleFilters.length > 0) {
        this.applyFilters(where, roleFilters as unknown as GlobalFilter[]);
      }
    }

    return where;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Stats por Entidade (Dashboard Widgets)
  // ═══════════════════════════════════════════════════════════════════════

  async getEntityRecordCount(
    user: CurrentUser,
    entitySlug: string,
    queryTenantId?: string,
    options?: { comparePeriod?: boolean; days?: number } & DashboardFilterOptions,
  ) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const entity = await this.getEntityBySlug(user, entitySlug, effectiveTenantId, roleType);
    if (!entity) return { total: 0, active: 0, archived: 0 };

    const hasDashFilters = !!(options?.filters || options?.dateStart);

    if (hasDashFilters) {
      // With dashboard filters: use WHERE-based counting
      const where = await this.buildEntityDataWhere(user, entity.id, effectiveTenantId, roleType, entitySlug, entity.settings);
      this.applyDashboardFilters(where, options);

      const archivedWhere: Prisma.ArchivedEntityDataWhereInput = {};
      if (where.entityId) archivedWhere.entityId = where.entityId as string;
      if (where.tenantId) archivedWhere.tenantId = where.tenantId as string;
      if (where.createdById) archivedWhere.createdById = where.createdById as string;
      if (where.AND) archivedWhere.AND = where.AND as Prisma.ArchivedEntityDataWhereInput[];

      const [active, archived] = await Promise.all([
        this.prisma.entityData.count({ where }),
        this.prisma.archivedEntityData.count({ where: archivedWhere }),
      ]);

      const result: Record<string, unknown> = {
        total: active + archived,
        active,
        archived,
      };

      if (options?.comparePeriod) {
        const days = options.days || 30;
        const now = new Date();
        const periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - days);
        const previousStart = new Date(periodStart);
        previousStart.setDate(previousStart.getDate() - days);

        const [currentCount, previousCount] = await Promise.all([
          this.prisma.entityData.count({
            where: { ...where, createdAt: { gte: periodStart, lte: now } },
          }),
          this.prisma.entityData.count({
            where: { ...where, createdAt: { gte: previousStart, lt: periodStart } },
          }),
        ]);

        result.periodComparison = {
          current: currentCount,
          previous: previousCount,
          changePercent: previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : currentCount > 0 ? 100 : 0,
          changeAbsolute: currentCount - previousCount,
        };
      }

      return result;
    }

    // No dashboard filters: use original efficient counting
    const counts = await this.countFilteredRecords(entity, user, effectiveTenantId, roleType);
    const result: Record<string, unknown> = {
      total: counts.active + counts.archived,
      active: counts.active,
      archived: counts.archived,
    };

    if (options?.comparePeriod) {
      const days = options.days || 30;
      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - days);
      const previousStart = new Date(periodStart);
      previousStart.setDate(previousStart.getDate() - days);

      const where = await this.buildEntityDataWhere(user, entity.id, effectiveTenantId, roleType, entitySlug, entity.settings);

      const [currentCount, previousCount] = await Promise.all([
        this.prisma.entityData.count({
          where: { ...where, createdAt: { gte: periodStart, lte: now } },
        }),
        this.prisma.entityData.count({
          where: { ...where, createdAt: { gte: previousStart, lt: periodStart } },
        }),
      ]);

      result.periodComparison = {
        current: currentCount,
        previous: previousCount,
        changePercent: previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : currentCount > 0 ? 100 : 0,
        changeAbsolute: currentCount - previousCount,
      };
    }

    return result;
  }

  async getEntityRecordsOverTime(
    user: CurrentUser,
    entitySlug: string,
    queryTenantId?: string,
    days: number = 30,
    dashFilters?: DashboardFilterOptions,
  ) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const entity = await this.getEntityBySlug(user, entitySlug, effectiveTenantId, roleType);
    if (!entity) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where = await this.buildEntityDataWhere(user, entity.id, effectiveTenantId, roleType, entitySlug, entity.settings);
    this.applyDashboardFilters(where, dashFilters);
    where.createdAt = { gte: startDate };

    const records = await this.prisma.entityData.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = records.reduce(
      (acc: Record<string, number>, record: { createdAt: Date }) => {
        const date = record.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {},
    );

    return this.fillDates(startDate, grouped);
  }

  async getFieldDistribution(
    user: CurrentUser,
    entitySlug: string,
    fieldSlug: string,
    queryTenantId?: string,
    limit: number = 20,
    dashFilters?: DashboardFilterOptions,
  ) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const entity = await this.getEntityBySlug(user, entitySlug, effectiveTenantId, roleType);
    if (!entity) return [];

    const where = await this.buildEntityDataWhere(user, entity.id, effectiveTenantId, roleType, entitySlug, entity.settings);
    this.applyDashboardFilters(where, dashFilters);

    // Buscar registros e agrupar no JS (compativel com qualquer tipo de valor JSON)
    const records = await this.prisma.entityData.findMany({
      where,
      select: { data: true },
    });

    const distribution = new Map<string, number>();
    for (const record of records) {
      const data = record.data as Record<string, unknown>;
      let value = data?.[fieldSlug];

      if (value === null || value === undefined) {
        value = '(vazio)';
      } else if (typeof value === 'object') {
        // Objetos {value, label} → usar label
        const obj = value as Record<string, unknown>;
        value = (obj.label || obj.value || JSON.stringify(value)) as string;
      } else {
        value = String(value);
      }

      const key = value as string;
      distribution.set(key, (distribution.get(key) || 0) + 1);
    }

    // Ordenar por contagem desc e limitar
    return Array.from(distribution.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({ value, label: value, count }));
  }

  async getFieldAggregation(
    user: CurrentUser,
    entitySlug: string,
    fieldSlug: string,
    queryTenantId?: string,
    options?: { aggregation?: string; comparePeriod?: boolean; days?: number } & DashboardFilterOptions,
  ) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const entity = await this.getEntityBySlug(user, entitySlug, effectiveTenantId, roleType);
    if (!entity) return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };

    const where = await this.buildEntityDataWhere(user, entity.id, effectiveTenantId, roleType, entitySlug, entity.settings);
    this.applyDashboardFilters(where, options);

    const records = await this.prisma.entityData.findMany({
      where,
      select: { data: true, createdAt: true },
    });

    const values = records
      .map((r) => {
        const data = r.data as Record<string, unknown>;
        const raw = data?.[fieldSlug];
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
        return isNaN(num) ? null : num;
      })
      .filter((v): v is number => v !== null);

    const result: Record<string, unknown> = {
      count: values.length,
      sum: values.reduce((s, v) => s + v, 0),
      avg: values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0,
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
    };

    if (options?.comparePeriod) {
      const days = options.days || 30;
      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - days);
      const previousStart = new Date(periodStart);
      previousStart.setDate(previousStart.getDate() - days);

      const agg = options.aggregation || 'sum';

      const currentValues = records
        .filter((r) => r.createdAt >= periodStart && r.createdAt <= now)
        .map((r) => {
          const data = r.data as Record<string, unknown>;
          const num = typeof data?.[fieldSlug] === 'number' ? data[fieldSlug] as number : parseFloat(String(data?.[fieldSlug]));
          return isNaN(num) ? null : num;
        })
        .filter((v): v is number => v !== null);

      const prevRecords = await this.prisma.entityData.findMany({
        where: { ...where, createdAt: { gte: previousStart, lt: periodStart } },
        select: { data: true },
      });

      const prevValues = prevRecords
        .map((r) => {
          const data = r.data as Record<string, unknown>;
          const num = typeof data?.[fieldSlug] === 'number' ? data[fieldSlug] as number : parseFloat(String(data?.[fieldSlug]));
          return isNaN(num) ? null : num;
        })
        .filter((v): v is number => v !== null);

      const aggregate = (vals: number[], type: string): number => {
        if (vals.length === 0) return 0;
        switch (type) {
          case 'count': return vals.length;
          case 'sum': return vals.reduce((s, v) => s + v, 0);
          case 'avg': return vals.reduce((s, v) => s + v, 0) / vals.length;
          case 'min': return Math.min(...vals);
          case 'max': return Math.max(...vals);
          default: return vals.reduce((s, v) => s + v, 0);
        }
      };

      const current = aggregate(currentValues, agg);
      const previous = aggregate(prevValues, agg);

      result.periodComparison = {
        current,
        previous,
        changePercent: previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0,
        changeAbsolute: current - previous,
      };
    }

    return result;
  }

  async getFieldTrend(
    user: CurrentUser,
    entitySlug: string,
    fieldSlug: string,
    queryTenantId?: string,
    options?: { aggregation?: string; days?: number } & DashboardFilterOptions,
  ) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const entity = await this.getEntityBySlug(user, entitySlug, effectiveTenantId, roleType);
    if (!entity) return [];

    const days = options?.days || 30;
    const agg = options?.aggregation || 'sum';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where = await this.buildEntityDataWhere(user, entity.id, effectiveTenantId, roleType, entitySlug, entity.settings);
    this.applyDashboardFilters(where, options);
    where.createdAt = { gte: startDate };

    const records = await this.prisma.entityData.findMany({
      where,
      select: { data: true, createdAt: true },
    });

    // Agrupar por dia
    const grouped = new Map<string, number[]>();
    for (const record of records) {
      const date = record.createdAt.toISOString().split('T')[0];
      const data = record.data as Record<string, unknown>;
      const raw = data?.[fieldSlug];
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (!isNaN(num)) {
        if (!grouped.has(date)) grouped.set(date, []);
        grouped.get(date)!.push(num);
      }
    }

    // Preencher todos os dias e aplicar agregacao
    const result: Array<{ date: string; value: number }> = [];
    const currentDate = new Date(startDate);
    const today = new Date();

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const vals = grouped.get(dateStr) || [];
      let value = 0;

      if (vals.length > 0) {
        switch (agg) {
          case 'count': value = vals.length; break;
          case 'sum': value = vals.reduce((s, v) => s + v, 0); break;
          case 'avg': value = vals.reduce((s, v) => s + v, 0) / vals.length; break;
          case 'min': value = Math.min(...vals); break;
          case 'max': value = Math.max(...vals); break;
          default: value = vals.reduce((s, v) => s + v, 0);
        }
      }

      result.push({ date: dateStr, value });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  async getEntityRecentActivity(
    user: CurrentUser,
    entitySlug: string,
    queryTenantId?: string,
    limit: number = 10,
    dashFilters?: DashboardFilterOptions,
  ) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const entity = await this.getEntityBySlug(user, entitySlug, effectiveTenantId, roleType);
    if (!entity) return [];

    const where = await this.buildEntityDataWhere(user, entity.id, effectiveTenantId, roleType, entitySlug, entity.settings);
    this.applyDashboardFilters(where, dashFilters);

    const records = await this.prisma.entityData.findMany({
      where,
      select: {
        id: true,
        data: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      action: r.createdAt.getTime() === r.updatedAt.getTime() ? 'created' : 'updated',
      timestamp: r.updatedAt.toISOString(),
      userName: r.createdBy?.name || 'Sistema',
      data: r.data,
    }));
  }

  async getEntityTopRecords(
    user: CurrentUser,
    entitySlug: string,
    queryTenantId?: string,
    options?: { limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc'; fields?: string[] } & DashboardFilterOptions,
  ) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const entity = await this.getEntityBySlug(user, entitySlug, effectiveTenantId, roleType);
    if (!entity) return [];

    const where = await this.buildEntityDataWhere(user, entity.id, effectiveTenantId, roleType, entitySlug, entity.settings);
    this.applyDashboardFilters(where, options);
    const limit = options?.limit || 5;
    const sortBy = options?.sortBy || 'createdAt';
    const sortOrder = options?.sortOrder || 'desc';

    // Se sortBy e um campo do data JSON, buscar todos e ordenar no JS
    if (sortBy !== 'createdAt' && sortBy !== 'updatedAt') {
      const records = await this.prisma.entityData.findMany({
        where,
        select: { id: true, data: true, createdAt: true, updatedAt: true },
      });

      records.sort((a, b) => {
        const dataA = (a.data as Record<string, unknown>)?.[sortBy];
        const dataB = (b.data as Record<string, unknown>)?.[sortBy];
        const numA = typeof dataA === 'number' ? dataA : parseFloat(String(dataA)) || 0;
        const numB = typeof dataB === 'number' ? dataB : parseFloat(String(dataB)) || 0;
        return sortOrder === 'desc' ? numB - numA : numA - numB;
      });

      return records.slice(0, limit).map((r) => ({
        id: r.id,
        data: options?.fields
          ? Object.fromEntries(options.fields.map((f) => [f, (r.data as Record<string, unknown>)?.[f]]))
          : r.data,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    }

    const records = await this.prisma.entityData.findMany({
      where,
      select: { id: true, data: true, createdAt: true, updatedAt: true },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      data: options?.fields
        ? Object.fromEntries(options.fields.map((f) => [f, (r.data as Record<string, unknown>)?.[f]]))
        : r.data,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getEntityFunnel(
    user: CurrentUser,
    entitySlug: string,
    fieldSlug: string,
    queryTenantId?: string,
    stages?: string[],
    dashFilters?: DashboardFilterOptions,
  ) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const entity = await this.getEntityBySlug(user, entitySlug, effectiveTenantId, roleType);
    if (!entity) return [];

    // Se stages nao fornecidos, buscar do field options
    let orderedStages = stages;
    const fields = (entity.fields as unknown as Array<{ slug: string; type: string; options?: unknown[]; workflowConfig?: { statuses?: Array<{ value: string; label: string }> } }>) || [];
    const field = fields.find((f) => f.slug === fieldSlug);

    if (!orderedStages) {
      if (!field) return [];

      if (field.type === 'workflow-status' && field.workflowConfig?.statuses) {
        orderedStages = field.workflowConfig.statuses.map((s) => s.value || s.label);
      } else if (field.options && Array.isArray(field.options)) {
        orderedStages = field.options.map((o) => typeof o === 'string' ? o : (o as Record<string, string>).value || (o as Record<string, string>).label);
      }
    }

    if (!orderedStages || orderedStages.length === 0) return [];

    // Build label map from field options
    const labelMap = new Map<string, string>();
    if (field?.type === 'workflow-status' && field.workflowConfig?.statuses) {
      for (const s of field.workflowConfig.statuses) {
        labelMap.set(s.value || s.label, s.label);
      }
    } else if (field?.options && Array.isArray(field.options)) {
      for (const o of field.options) {
        if (typeof o === 'string') {
          labelMap.set(o, o);
        } else {
          const obj = o as Record<string, string>;
          labelMap.set(obj.value || obj.label, obj.label || obj.value);
        }
      }
    }

    // Buscar distribuicao with dashboard filters
    const distribution = await this.getFieldDistribution(user, entitySlug, fieldSlug, queryTenantId, 100, dashFilters);
    const distMap = new Map(distribution.map((d) => [d.value, d.count]));
    const total = distribution.reduce((s, d) => s + d.count, 0);

    return orderedStages.map((stage) => ({
      stage,
      label: labelMap.get(stage) || stage,
      count: distMap.get(stage) || 0,
      percentage: total > 0 ? ((distMap.get(stage) || 0) / total) * 100 : 0,
    }));
  }

  async getRecentActivity(user: CurrentUser, queryTenantId?: string, limit: number = 10) {
    const { effectiveTenantId, roleType, effectiveRole } = this.resolveContext(user, queryTenantId);
    const where = this.getWhere(effectiveTenantId, effectiveRole);

    // Para entidades, filtrar pelas acessiveis
    const entities = await this.getAccessibleEntities(user, effectiveTenantId, roleType);
    const entityIds = entities.map((e) => e.id);

    const recordsWhere: Prisma.EntityDataWhereInput = {
      ...where,
      ...(entityIds.length > 0 ? { entityId: { in: entityIds } } : { entityId: '__none__' }),
    };

    // Aplicar scope para USER/CUSTOM
    if (roleType === 'USER') {
      recordsWhere.createdById = user.id;
    } else if (roleType === 'CUSTOM') {
      const hasOwnScope = await this.hasAnyOwnScope(user, entities);
      if (hasOwnScope) {
        recordsWhere.createdById = user.id;
      }
    }

    const [records, entitiesList] = await Promise.all([
      this.prisma.entityData.findMany({
        where: recordsWhere,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          entity: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.entity.findMany({
        where: {
          ...where,
          ...(entityIds.length > 0 ? { id: { in: entityIds } } : { id: '__none__' }),
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
    ]);

    const activities = [
      ...records.map((r) => ({
        id: r.id,
        type: 'record' as const,
        action:
          r.createdAt.getTime() === r.updatedAt.getTime()
            ? ('created' as const)
            : ('updated' as const),
        name: `Registro`,
        entityName: r.entity.name,
        timestamp: r.updatedAt.toISOString(),
      })),
      ...entitiesList.map((e) => ({
        id: e.id,
        type: 'entity' as const,
        action:
          e.createdAt.getTime() === e.updatedAt.getTime()
            ? ('created' as const)
            : ('updated' as const),
        name: e.name,
        timestamp: e.updatedAt.toISOString(),
      })),
    ];

    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  }
}
