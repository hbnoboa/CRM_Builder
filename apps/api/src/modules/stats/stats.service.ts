import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomRoleService } from '../custom-role/custom-role.service';
import { EntityDataQueryService, type DashboardFilterOptions } from '../../common/services/entity-data-query.service';
import { CurrentUser } from '../../common/types';
import { RoleType } from '../../common/decorators/roles.decorator';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { Prisma, type PrismaClient } from '@prisma/client';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customRoleService: CustomRoleService,
    private readonly queryService: EntityDataQueryService,
  ) {}

  // Helper: resolve tenantId e roleType a partir do user
  private resolveContext(user: CurrentUser, queryTenantId?: string) {
    const roleType = (user.customRole?.roleType || 'USER') as RoleType;
    const effectiveTenantId = getEffectiveTenantId(user, queryTenantId);
    const effectiveRole = (roleType === 'PLATFORM_ADMIN' && queryTenantId) ? 'filtered' : roleType;
    return { effectiveTenantId, roleType, effectiveRole };
  }

  // Helper: base where para tenant
  private getWhere(tenantId: string, effectiveRole: string) {
    if (effectiveRole === 'PLATFORM_ADMIN') return {};
    return { tenantId };
  }

  /**
   * Helper: constroi WHERE para entity stats via servico centralizado.
   * Retorna null se a entidade nao for encontrada (graceful).
   */
  private async buildEntityWhere(
    user: CurrentUser,
    entitySlug: string,
    queryTenantId?: string,
    dashboardFilters?: DashboardFilterOptions,
  ) {
    try {
      return await this.queryService.buildWhere({
        entitySlug,
        user,
        tenantId: queryTenantId,
        dashboardFilters,
        includeChildren: true, // Stats nao filtram por parentRecordId (sub-entidades tem parentRecordId set)
      });
    } catch (e) {
      if (e instanceof NotFoundException) return null;
      throw e;
    }
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
    _roleType: RoleType | string,
  ): Promise<{ active: number; archived: number }> {
    const result = await this.buildEntityWhere(user, entity.slug, effectiveTenantId);
    if (!result) return { active: 0, archived: 0 };

    const { where } = result;
    const archivedWhere = this.queryService.buildArchivedWhere(where);

    const [active, archived] = await Promise.all([
      this.prisma.entityData.count({ where }),
      this.prisma.archivedEntityData.count({ where: archivedWhere }),
    ]);

    return { active, archived };
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

    const archivedWhere = {
      entityId: where.entityId as unknown,
      tenantId: where.tenantId as string,
      createdAt: where.createdAt as unknown,
      ...(where.createdById ? { createdById: where.createdById as string } : {}),
    } as Prisma.ArchivedEntityDataWhereInput;

    const [records, archivedRecords] = await Promise.all([
      this.prisma.entityData.findMany({
        where,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.archivedEntityData.findMany({
        where: archivedWhere,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const allRecords = [...records, ...archivedRecords];

    const grouped = allRecords.reduce(
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
   * Inclui sub-entidades (que sao excluidas do getAccessibleEntities).
   */

  // ═══════════════════════════════════════════════════════════════════════
  // Stats por Entidade (Dashboard Widgets)
  // ═══════════════════════════════════════════════════════════════════════

  async getEntityRecordCount(
    user: CurrentUser,
    entitySlug: string,
    queryTenantId?: string,
    options?: { comparePeriod?: boolean; days?: number } & DashboardFilterOptions,
  ) {
    const dashFilters = (options?.filters || options?.dateStart) ? options : undefined;
    const result_ = await this.buildEntityWhere(user, entitySlug, queryTenantId, dashFilters);
    if (!result_) return { total: 0, active: 0, archived: 0 };

    const { where } = result_;
    const archivedWhere = this.queryService.buildArchivedWhere(where);

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
        this.countBoth({ ...where, createdAt: { gte: periodStart, lte: now } }),
        this.countBoth({ ...where, createdAt: { gte: previousStart, lt: periodStart } }),
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
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, dashFilters);
    if (!result) return [];

    const { where } = result;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    where.createdAt = { gte: startDate };
    const archivedWhere = this.queryService.buildArchivedWhere(where);

    const [records, archivedRecords] = await Promise.all([
      this.prisma.entityData.findMany({
        where,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.archivedEntityData.findMany({
        where: archivedWhere,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const allRecords = [...records, ...archivedRecords];

    const grouped = allRecords.reduce(
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
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, dashFilters);
    if (!result) return [];

    const { where } = result;
    const isParentField = fieldSlug.startsWith('parent.');
    const needsParent = isParentField;

    // Buscar registros de ambas as tabelas e agrupar no JS
    const archivedWhere = this.queryService.buildArchivedWhere(where);
    type DistRec = { id: string; data: unknown; parentRecordId?: string | null };
    const selectFields = needsParent
      ? { id: true, data: true, parentRecordId: true }
      : { id: true, data: true };
    const [activeRecords, archivedRecords] = await Promise.all([
      this.prisma.entityData.findMany({ where, select: selectFields }),
      this.prisma.archivedEntityData.findMany({ where: archivedWhere, select: selectFields }),
    ]);
    const records = [...activeRecords, ...archivedRecords] as DistRec[];

    // Resolve parent fields if needed
    let parentDataMap = new Map<string, Record<string, unknown>>();
    if (isParentField) {
      const parentSlug = fieldSlug.slice(7);
      parentDataMap = await this.resolveParentFields(records, [parentSlug]);
    }

    // Track value→label mapping and count by value key
    const distribution = new Map<string, number>();
    const labelMap = new Map<string, string>();
    for (const record of records) {
      const data = record.data as Record<string, unknown>;
      let rawValue: unknown;

      if (isParentField) {
        const pData = parentDataMap.get(record.id);
        rawValue = pData?.[fieldSlug];
      } else {
        rawValue = data?.[fieldSlug];
      }

      let valueKey: string;
      let displayLabel: string;

      if (rawValue === null || rawValue === undefined) {
        valueKey = '(vazio)';
        displayLabel = '(vazio)';
      } else if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        // Objetos {value, label} → value for filtering, label for display
        const obj = rawValue as Record<string, unknown>;
        valueKey = String(obj.value ?? obj.label ?? JSON.stringify(rawValue));
        displayLabel = String(obj.label ?? obj.value ?? JSON.stringify(rawValue));
      } else {
        valueKey = String(rawValue);
        displayLabel = valueKey;
      }

      distribution.set(valueKey, (distribution.get(valueKey) || 0) + 1);
      if (!labelMap.has(valueKey)) labelMap.set(valueKey, displayLabel);
    }

    // Ordenar por contagem desc e limitar
    return Array.from(distribution.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({ value, label: labelMap.get(value) || value, count }));
  }

  async getCrossFieldDistribution(
    user: CurrentUser,
    entitySlug: string,
    rowFieldSlug: string,
    columnFieldSlug: string,
    queryTenantId?: string,
    options?: { limit?: number } & DashboardFilterOptions,
  ) {
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, options);
    if (!result) return { rows: [], columns: [], matrix: {}, maxValue: 0 };

    const { where } = result;
    const needsParent = rowFieldSlug.startsWith('parent.') || columnFieldSlug.startsWith('parent.');

    const archivedWhere = this.queryService.buildArchivedWhere(where);
    type CrossRec = { id: string; data: unknown; parentRecordId?: string | null };
    const selectFields = needsParent
      ? { id: true, data: true, parentRecordId: true }
      : { id: true, data: true };
    const [activeRecords, archivedRecords] = await Promise.all([
      this.prisma.entityData.findMany({ where, select: selectFields }),
      this.prisma.archivedEntityData.findMany({ where: archivedWhere, select: selectFields }),
    ]);
    const records = [...activeRecords, ...archivedRecords] as CrossRec[];

    // Resolve parent fields if needed
    let parentDataMap = new Map<string, Record<string, unknown>>();
    if (needsParent) {
      const parentSlugs: string[] = [];
      if (rowFieldSlug.startsWith('parent.')) parentSlugs.push(rowFieldSlug.slice(7));
      if (columnFieldSlug.startsWith('parent.')) parentSlugs.push(columnFieldSlug.slice(7));
      parentDataMap = await this.resolveParentFields(records, parentSlugs);
    }

    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    const matrix: Record<string, Record<string, number>> = {};
    const labelMap = new Map<string, string>(); // value → label

    for (const record of records) {
      const data = record.data as Record<string, unknown>;
      const pData = needsParent ? parentDataMap.get(record.id) : undefined;
      const rowRaw = this.getFieldValue(data, rowFieldSlug, pData);
      const colRaw = this.getFieldValue(data, columnFieldSlug, pData);
      const rowVal = this.normalizeFieldValue(rowRaw);
      const colVal = this.normalizeFieldValue(colRaw);

      if (!labelMap.has(rowVal)) labelMap.set(rowVal, this.normalizeFieldLabel(rowRaw));
      if (!labelMap.has(colVal)) labelMap.set(colVal, this.normalizeFieldLabel(colRaw));

      rowSet.add(rowVal);
      colSet.add(colVal);

      if (!matrix[rowVal]) matrix[rowVal] = {};
      matrix[rowVal][colVal] = (matrix[rowVal][colVal] || 0) + 1;
    }

    // Limitar rows por top-N (ordenado por total desc)
    const limit = options?.limit || 20;
    const rowTotals = Array.from(rowSet)
      .map((row) => ({
        value: row,
        total: Object.values(matrix[row] || {}).reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    const topRows = rowTotals.map((r) => r.value);
    const filteredMatrix: Record<string, Record<string, number>> = {};
    let maxValue = 0;

    for (const row of topRows) {
      filteredMatrix[row] = matrix[row];
      for (const val of Object.values(matrix[row])) {
        if (val > maxValue) maxValue = val;
      }
    }

    return {
      rows: topRows.map((v) => ({ value: v, label: labelMap.get(v) || v })),
      columns: Array.from(colSet).map((v) => ({ value: v, label: labelMap.get(v) || v })),
      matrix: filteredMatrix,
      maxValue,
    };
  }

  /** Helper: extrai slugs own vs parent (prefixo "parent.") */
  private extractParentSlugs(fieldSlugs: string[]): { own: string[]; parent: string[] } {
    const own: string[] = [];
    const parent: string[] = [];
    for (const f of fieldSlugs) {
      if (f.startsWith('parent.')) parent.push(f.slice(7));
      else own.push(f);
    }
    return { own, parent };
  }

  /** Helper: busca parent records em batch e retorna Map<childId, { "parent.field": value }> */
  private async resolveParentFields(
    records: Array<{ id: string; parentRecordId?: string | null }>,
    parentFieldSlugs: string[],
  ): Promise<Map<string, Record<string, unknown>>> {
    if (parentFieldSlugs.length === 0) return new Map();

    const parentIds = [...new Set(
      records.map((r) => r.parentRecordId).filter(Boolean),
    )] as string[];
    if (parentIds.length === 0) return new Map();

    const [activeParents, archivedParents] = await Promise.all([
      this.prisma.entityData.findMany({
        where: { id: { in: parentIds } },
        select: { id: true, data: true },
      }),
      this.prisma.archivedEntityData.findMany({
        where: { id: { in: parentIds } },
        select: { id: true, data: true },
      }),
    ]);
    const parentDataMap = new Map(
      [...activeParents, ...archivedParents].map((p) => [p.id, p.data as Record<string, unknown>]),
    );

    const result = new Map<string, Record<string, unknown>>();
    for (const r of records) {
      if (!r.parentRecordId) continue;
      const pd = parentDataMap.get(r.parentRecordId);
      if (!pd) continue;
      const enriched: Record<string, unknown> = {};
      for (const slug of parentFieldSlugs) {
        enriched[`parent.${slug}`] = pd[slug];
      }
      result.set(r.id, enriched);
    }
    return result;
  }

  /** Helper: resolve o valor de um campo, suportando parent fields pre-resolvidos */
  private getFieldValue(data: Record<string, unknown>, fieldSlug: string, parentData?: Record<string, unknown>): unknown {
    if (fieldSlug.startsWith('parent.') && parentData) {
      return parentData[fieldSlug];
    }
    return data?.[fieldSlug];
  }

  /** Helper: conta registros de ambas as tabelas (entityData + archivedEntityData) */
  private async countBoth(where: Prisma.EntityDataWhereInput): Promise<number> {
    const archivedWhere = this.queryService.buildArchivedWhere(where);
    const [a, b] = await Promise.all([
      this.prisma.entityData.count({ where }),
      this.prisma.archivedEntityData.count({ where: archivedWhere }),
    ]);
    return a + b;
  }

  /** Helper: busca { data, createdAt } de ambas as tabelas */
  private async fetchDataFromBoth(where: Prisma.EntityDataWhereInput): Promise<{ data: unknown; createdAt: Date }[]> {
    const archivedWhere = this.queryService.buildArchivedWhere(where);
    const [active, archived] = await Promise.all([
      this.prisma.entityData.findMany({ where, select: { data: true, createdAt: true } }),
      this.prisma.archivedEntityData.findMany({ where: archivedWhere, select: { data: true, createdAt: true } }),
    ]);
    return [...active, ...archived];
  }

  /** Returns the internal value (for filtering/grouping keys). Prefers obj.value for {value,label} objects. */
  private normalizeFieldValue(value: unknown): string {
    if (value === null || value === undefined) return '(vazio)';
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      return String(obj.value ?? obj.label ?? JSON.stringify(value));
    }
    return String(value);
  }

  /** Returns the display label. Prefers obj.label for {value,label} objects. */
  private normalizeFieldLabel(value: unknown): string {
    if (value === null || value === undefined) return '(vazio)';
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      return String(obj.label ?? obj.value ?? JSON.stringify(value));
    }
    return String(value);
  }

  async getFieldAggregation(
    user: CurrentUser,
    entitySlug: string,
    fieldSlug: string,
    queryTenantId?: string,
    options?: { aggregation?: string; comparePeriod?: boolean; days?: number } & DashboardFilterOptions,
  ) {
    const qr = await this.buildEntityWhere(user, entitySlug, queryTenantId, options);
    if (!qr) return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };

    const { where } = qr;

    const records = await this.fetchDataFromBoth(where);

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

      const prevRecords = await this.fetchDataFromBoth({ ...where, createdAt: { gte: previousStart, lt: periodStart } });

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

  async getFieldRatio(
    user: CurrentUser,
    entitySlug: string,
    numeratorField: string,
    denominatorField: string,
    queryTenantId?: string,
    options?: { aggregation?: string; comparePeriod?: boolean; days?: number; denominatorEntitySlug?: string } & DashboardFilterOptions,
  ) {
    const qr = await this.buildEntityWhere(user, entitySlug, queryTenantId, options);
    if (!qr) return { numerator: 0, denominator: 0, ratio: 0, percentage: 0 };

    const { where } = qr;
    const agg = options?.aggregation || 'sum';
    const isNumeratorCount = numeratorField === 'count';
    const isDenominatorCount = denominatorField === 'count';
    const denominatorEntitySlug = options?.denominatorEntitySlug;

    // Build denominator WHERE if cross-entity
    let denWhere = where;
    if (denominatorEntitySlug && denominatorEntitySlug !== entitySlug) {
      const denQr = await this.buildEntityWhere(user, denominatorEntitySlug, queryTenantId, options);
      if (!denQr) return { numerator: 0, denominator: 0, ratio: 0, percentage: 0 };
      denWhere = denQr.where;
    }

    // For 'count' fields, just count records; for real fields, extract values
    let numerator: number;
    let denominator: number;

    if (isNumeratorCount) {
      numerator = await this.countBoth(where);
    } else {
      const records = await this.fetchDataFromBoth(where);
      const vals = this.extractNumericValues(records as { data: unknown }[], numeratorField);
      numerator = this.aggregateValues(vals, agg);
    }

    if (isDenominatorCount) {
      denominator = await this.countBoth(denWhere);
    } else {
      const records = await this.fetchDataFromBoth(denWhere);
      const vals = this.extractNumericValues(records as { data: unknown }[], denominatorField);
      denominator = this.aggregateValues(vals, agg);
    }

    const ratio = denominator !== 0 ? numerator / denominator : 0;
    const percentage = ratio * 100;

    const result: Record<string, unknown> = { numerator, denominator, ratio, percentage };

    if (options?.comparePeriod) {
      const days = options.days || 30;
      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - days);
      const previousStart = new Date(periodStart);
      previousStart.setDate(previousStart.getDate() - days);

      const curNum = isNumeratorCount
        ? await this.countBoth({ ...where, createdAt: { gte: periodStart, lte: now } })
        : this.aggregateValues(this.extractNumericValues(
            await this.fetchDataFromBoth({ ...where, createdAt: { gte: periodStart, lte: now } }) as { data: unknown }[],
            numeratorField,
          ), agg);

      const curDen = isDenominatorCount
        ? await this.countBoth({ ...denWhere, createdAt: { gte: periodStart, lte: now } })
        : this.aggregateValues(this.extractNumericValues(
            await this.fetchDataFromBoth({ ...denWhere, createdAt: { gte: periodStart, lte: now } }) as { data: unknown }[],
            denominatorField,
          ), agg);

      const curPct = curDen !== 0 ? (curNum / curDen) * 100 : 0;

      const prevNum = isNumeratorCount
        ? await this.countBoth({ ...where, createdAt: { gte: previousStart, lt: periodStart } })
        : this.aggregateValues(this.extractNumericValues(
            await this.fetchDataFromBoth({ ...where, createdAt: { gte: previousStart, lt: periodStart } }) as { data: unknown }[],
            numeratorField,
          ), agg);

      const prevDen = isDenominatorCount
        ? await this.countBoth({ ...denWhere, createdAt: { gte: previousStart, lt: periodStart } })
        : this.aggregateValues(this.extractNumericValues(
            await this.fetchDataFromBoth({ ...denWhere, createdAt: { gte: previousStart, lt: periodStart } }) as { data: unknown }[],
            denominatorField,
          ), agg);

      const prevPct = prevDen !== 0 ? (prevNum / prevDen) * 100 : 0;

      result.periodComparison = {
        current: curPct,
        previous: prevPct,
        changePercent: prevPct > 0 ? ((curPct - prevPct) / prevPct) * 100 : curPct > 0 ? 100 : 0,
        changeAbsolute: curPct - prevPct,
      };
    }

    return result;
  }

  private extractNumericValues(records: { data: unknown }[], field: string): number[] {
    return records
      .map((r) => {
        const data = r.data as Record<string, unknown>;
        const num = typeof data?.[field] === 'number' ? data[field] as number : parseFloat(String(data?.[field]));
        return isNaN(num) ? null : num;
      })
      .filter((v): v is number => v !== null);
  }

  private aggregateValues(vals: number[], type: string): number {
    if (vals.length === 0) return 0;
    switch (type) {
      case 'count': return vals.length;
      case 'sum': return vals.reduce((s, v) => s + v, 0);
      case 'avg': return vals.reduce((s, v) => s + v, 0) / vals.length;
      case 'min': return Math.min(...vals);
      case 'max': return Math.max(...vals);
      default: return vals.reduce((s, v) => s + v, 0);
    }
  }

  async getFieldTrend(
    user: CurrentUser,
    entitySlug: string,
    fieldSlug: string,
    queryTenantId?: string,
    options?: { aggregation?: string; days?: number } & DashboardFilterOptions,
  ) {
    const qr = await this.buildEntityWhere(user, entitySlug, queryTenantId, options);
    if (!qr) return [];

    const { where } = qr;
    const days = options?.days || 30;
    const agg = options?.aggregation || 'sum';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    where.createdAt = { gte: startDate };

    const records = await this.fetchDataFromBoth(where);

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
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, dashFilters);
    if (!result) return [];

    const { where } = result;

    const archivedWhere = this.queryService.buildArchivedWhere(where);

    const [activeRecords, archivedRecords] = await Promise.all([
      this.prisma.entityData.findMany({
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
      }),
      this.prisma.archivedEntityData.findMany({
        where: archivedWhere,
        select: {
          id: true,
          data: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
    ]);

    // Merge, sort, and take limit
    const merged = [
      ...activeRecords.map((r) => ({
        id: r.id,
        action: r.createdAt.getTime() === r.updatedAt.getTime() ? 'created' as const : 'updated' as const,
        timestamp: r.updatedAt.toISOString(),
        userName: r.createdBy?.name || 'Sistema',
        data: r.data,
      })),
      ...archivedRecords.map((r) => ({
        id: r.id,
        action: 'archived' as const,
        timestamp: r.updatedAt.toISOString(),
        userName: 'Sistema',
        data: r.data,
      })),
    ];

    return merged
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getEntityTopRecords(
    user: CurrentUser,
    entitySlug: string,
    queryTenantId?: string,
    options?: { limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc'; fields?: string[] } & DashboardFilterOptions,
  ) {
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, options);
    if (!result) return [];

    const { where } = result;
    const limit = options?.limit || 5;
    const sortBy = options?.sortBy || 'createdAt';
    const sortOrder = options?.sortOrder || 'desc';

    const archivedWhere = this.queryService.buildArchivedWhere(where);
    const selectFields = { id: true, data: true, createdAt: true, updatedAt: true, parentRecordId: true };
    type TopRecord = { id: string; data: unknown; createdAt: Date; updatedAt: Date; parentRecordId: string | null };

    // Fetch from both tables
    const [activeRecords, archivedRecords] = await Promise.all([
      this.prisma.entityData.findMany({ where, select: selectFields }),
      this.prisma.archivedEntityData.findMany({ where: archivedWhere, select: selectFields }),
    ]);
    const allRecords = [...activeRecords, ...archivedRecords] as TopRecord[];

    // Sort (either by JSON field or by DB column)
    if (sortBy !== 'createdAt' && sortBy !== 'updatedAt') {
      allRecords.sort((a, b) => {
        const dataA = (a.data as Record<string, unknown>)?.[sortBy];
        const dataB = (b.data as Record<string, unknown>)?.[sortBy];
        const numA = typeof dataA === 'number' ? dataA : parseFloat(String(dataA)) || 0;
        const numB = typeof dataB === 'number' ? dataB : parseFloat(String(dataB)) || 0;
        return sortOrder === 'desc' ? numB - numA : numA - numB;
      });
    } else {
      allRecords.sort((a, b) => {
        const tA = a[sortBy].getTime();
        const tB = b[sortBy].getTime();
        return sortOrder === 'desc' ? tB - tA : tA - tB;
      });
    }

    const sliced = allRecords.slice(0, limit);

    // Resolve parent fields if any requested
    const { parent: parentFieldSlugs } = this.extractParentSlugs(options?.fields || []);
    const parentDataMap = await this.resolveParentFields(sliced, parentFieldSlugs);

    return sliced.map((r) => {
      const ownData = options?.fields
        ? Object.fromEntries(options.fields.filter((f) => !f.startsWith('parent.')).map((f) => [f, (r.data as Record<string, unknown>)?.[f]]))
        : { ...(r.data as Record<string, unknown>) };

      // Merge parent fields into data
      const pData = parentDataMap.get(r.id);
      if (pData) Object.assign(ownData, pData);

      return {
        id: r.id,
        data: ownData,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });
  }

  async getEntityFunnel(
    user: CurrentUser,
    entitySlug: string,
    fieldSlug: string,
    queryTenantId?: string,
    stages?: string[],
    dashFilters?: DashboardFilterOptions,
  ) {
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, dashFilters);
    if (!result) return [];

    const { entity } = result;

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

  async getDistinctCount(
    user: CurrentUser,
    entitySlug: string,
    fieldSlugs: string[],
    queryTenantId?: string,
    options?: { comparePeriod?: boolean; days?: number; filterField?: string; filterValue?: string } & DashboardFilterOptions,
  ) {
    const qr = await this.buildEntityWhere(user, entitySlug, queryTenantId, options);
    if (!qr) return { total: 0 };

    const { where } = qr;
    const archivedWhere = this.queryService.buildArchivedWhere(where);

    const makeKey = (data: Record<string, unknown>) =>
      fieldSlugs.map((f) => this.normalizeFieldValue(data?.[f])).join('||');

    // Buscar de ambos: entityData + archivedEntityData
    const [records, archivedRecords] = await Promise.all([
      this.prisma.entityData.findMany({ where, select: { data: true, createdAt: true } }),
      this.prisma.archivedEntityData.findMany({ where: archivedWhere, select: { data: true, createdAt: true } }),
    ]);

    const allRecords = [...records, ...archivedRecords];

    // Filter check for filtered distinct count
    const shouldInclude = (data: Record<string, unknown>): boolean => {
      if (!options?.filterField) return true;
      const val = this.normalizeFieldValue(data?.[options.filterField]);
      const target = options.filterValue ?? '';
      if (target === 'true') return val === 'true' || val === 'Sim' || val === 'sim';
      if (target === 'false') return val === 'false' || val === 'Nao' || val === 'nao' || val === 'Não';
      return val === target;
    };

    const distinctKeys = new Set<string>();
    const filteredDistinctKeys = new Set<string>();
    for (const record of allRecords) {
      const data = record.data as Record<string, unknown>;
      const key = makeKey(data);
      distinctKeys.add(key);
      if (shouldInclude(data)) {
        filteredDistinctKeys.add(key);
      }
    }

    // If filterField is set, total = filtered count; otherwise total = all distinct
    const total = options?.filterField ? filteredDistinctKeys.size : distinctKeys.size;
    const result: Record<string, unknown> = {
      total,
      ...(options?.filterField ? { totalDistinct: distinctKeys.size, filteredDistinct: filteredDistinctKeys.size } : {}),
    };

    if (options?.comparePeriod) {
      const days = options.days || 30;
      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - days);
      const previousStart = new Date(periodStart);
      previousStart.setDate(previousStart.getDate() - days);

      const currentKeys = new Set<string>();
      for (const record of allRecords) {
        if (record.createdAt >= periodStart && record.createdAt <= now) {
          const data = record.data as Record<string, unknown>;
          if (shouldInclude(data)) {
            currentKeys.add(makeKey(data));
          }
        }
      }

      const [prevRecords, prevArchived] = await Promise.all([
        this.prisma.entityData.findMany({
          where: { ...where, createdAt: { gte: previousStart, lt: periodStart } },
          select: { data: true },
        }),
        this.prisma.archivedEntityData.findMany({
          where: { ...archivedWhere, createdAt: { gte: previousStart, lt: periodStart } },
          select: { data: true },
        }),
      ]);

      const prevKeys = new Set<string>();
      for (const record of [...prevRecords, ...prevArchived]) {
        const data = record.data as Record<string, unknown>;
        if (shouldInclude(data)) {
          prevKeys.add(makeKey(data));
        }
      }

      const current = currentKeys.size;
      const previous = prevKeys.size;
      result.periodComparison = {
        current,
        previous,
        changePercent: previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0,
        changeAbsolute: current - previous,
      };
    }

    return result;
  }

  async getGroupedData(
    user: CurrentUser,
    entitySlug: string,
    groupByFields: string[],
    queryTenantId?: string,
    options?: {
      aggregations?: Array<{
        type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinctCount' | 'mode' | 'first';
        fieldSlug?: string;
        alias: string;
        distinctFields?: string[];
      }>;
      crossEntityCount?: {
        entitySlug: string;
        matchFields?: Array<{ source: string; target: string }>;
        matchBy?: 'fields' | 'children'; // 'children' = count sub-entity records by parentRecordId
        alias: string;
      };
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } & DashboardFilterOptions,
  ): Promise<Array<Record<string, unknown>>> {
    const qr = await this.buildEntityWhere(user, entitySlug, queryTenantId, options);
    if (!qr) return [];

    const { where } = qr;

    // Fetch records with IDs for cross-entity child matching
    const archivedWhere = this.queryService.buildArchivedWhere(where);
    const [activeRecords, archivedRecords] = await Promise.all([
      this.prisma.entityData.findMany({ where, select: { id: true, data: true, createdAt: true } }),
      this.prisma.archivedEntityData.findMany({ where: archivedWhere, select: { id: true, data: true, createdAt: true } }),
    ]);
    const allRecords = [...activeRecords, ...archivedRecords];

    // 1. Group records by composite key (also track record IDs per group)
    const groups = new Map<string, { records: Array<Record<string, unknown>>; recordIds: string[] }>();
    for (const record of allRecords) {
      const data = record.data as Record<string, unknown>;
      const key = groupByFields.map((f) => this.normalizeFieldValue(data?.[f])).join('||');
      if (!groups.has(key)) groups.set(key, { records: [], recordIds: [] });
      const g = groups.get(key)!;
      g.records.push(data);
      g.recordIds.push(record.id);
    }

    // 2. Pre-fetch cross-entity records if needed (avoids N+1)
    let crossCounts: Map<string, number> | undefined;
    if (options?.crossEntityCount) {
      const { entitySlug: crossSlug, matchFields, matchBy, alias } = options.crossEntityCount;

      if (matchBy === 'children') {
        // Count sub-entity records that are children (parentRecordId) of records in each group.
        // NOTE: Do NOT pass main entity filters to cross-entity query — children are matched
        // by parentRecordId, not by the parent's field values. Only date range is forwarded.
        const crossQr = await this.buildEntityWhere(user, crossSlug, queryTenantId, {
          dateStart: options.dateStart,
          dateEnd: options.dateEnd,
        });
        if (crossQr) {
          // Fetch children with parentRecordId
          const crossArchivedWhere = this.queryService.buildArchivedWhere(crossQr.where);
          const [crossActive, crossArchived] = await Promise.all([
            this.prisma.entityData.findMany({
              where: { ...crossQr.where, parentRecordId: { not: null } },
              select: { parentRecordId: true },
            }),
            this.prisma.archivedEntityData.findMany({
              where: { ...crossArchivedWhere, parentRecordId: { not: null } } as Prisma.ArchivedEntityDataWhereInput,
              select: { parentRecordId: true },
            }),
          ]);
          // Count children per parentRecordId
          const childCounts = new Map<string, number>();
          for (const r of [...crossActive, ...crossArchived]) {
            if (r.parentRecordId) {
              childCounts.set(r.parentRecordId, (childCounts.get(r.parentRecordId) || 0) + 1);
            }
          }
          // Build crossCounts per group key (sum of children of all records in group)
          crossCounts = new Map<string, number>();
          for (const [key, group] of groups) {
            let count = 0;
            for (const rid of group.recordIds) {
              count += childCounts.get(rid) || 0;
            }
            crossCounts.set(key, count);
          }
        }
      } else if (matchFields && matchFields.length > 0) {
        // Field-based matching
        const crossQr = await this.buildEntityWhere(user, crossSlug, queryTenantId, options);
        if (crossQr) {
          const crossRecords = await this.fetchDataFromBoth(crossQr.where);
          crossCounts = new Map<string, number>();
          for (const r of crossRecords) {
            const d = r.data as Record<string, unknown>;
            const k = matchFields.map((m) => this.normalizeFieldValue(d?.[m.target])).join('||');
            crossCounts.set(k, (crossCounts.get(k) || 0) + 1);
          }
        }
      }
    }

    // 3. Compute aggregations for each group
    const aggregations = options?.aggregations || [{ type: 'count' as const, alias: 'total' }];
    const rows: Array<Record<string, unknown>> = [];

    for (const [key, group] of groups) {
      const groupRecords = group.records;
      const firstData = groupRecords[0];
      const row: Record<string, unknown> = {};

      // Set groupBy field values
      for (const field of groupByFields) {
        row[field] = this.normalizeFieldValue(firstData?.[field]);
      }

      // Compute each aggregation
      for (const agg of aggregations) {
        if (agg.type === 'count') {
          row[agg.alias] = groupRecords.length;
        } else if (agg.type === 'first') {
          row[agg.alias] = agg.fieldSlug ? this.normalizeFieldValue(groupRecords[0]?.[agg.fieldSlug]) : null;
        } else if (agg.type === 'mode') {
          if (agg.fieldSlug) {
            const freq = new Map<string, number>();
            for (const d of groupRecords) {
              const v = this.normalizeFieldValue(d[agg.fieldSlug!]);
              freq.set(v, (freq.get(v) || 0) + 1);
            }
            let maxV = '', maxC = 0;
            for (const [v, c] of freq) { if (c > maxC) { maxC = c; maxV = v; } }
            row[agg.alias] = maxV;
          }
        } else if (agg.type === 'distinctCount') {
          const dFields = agg.distinctFields || (agg.fieldSlug ? [agg.fieldSlug] : []);
          const dSet = new Set<string>();
          for (const d of groupRecords) {
            dSet.add(dFields.map((f) => this.normalizeFieldValue(d[f])).join('||'));
          }
          row[agg.alias] = dSet.size;
        } else {
          // sum, avg, min, max
          const values: number[] = [];
          for (const d of groupRecords) {
            const raw = d[agg.fieldSlug!];
            const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
            if (!isNaN(num)) values.push(num);
          }
          if (agg.type === 'sum') row[agg.alias] = values.reduce((s, v) => s + v, 0);
          else if (agg.type === 'avg') row[agg.alias] = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
          else if (agg.type === 'min') row[agg.alias] = values.length > 0 ? Math.min(...values) : 0;
          else if (agg.type === 'max') row[agg.alias] = values.length > 0 ? Math.max(...values) : 0;
        }
      }

      // Cross-entity count lookup
      if (crossCounts && options?.crossEntityCount) {
        const { matchFields, matchBy, alias } = options.crossEntityCount;
        if (matchBy === 'children') {
          // Use pre-computed group-level counts
          row[alias] = crossCounts.get(key) || 0;
        } else if (matchFields && matchFields.length > 0) {
          const crossKey = matchFields.map((m) => this.normalizeFieldValue(firstData?.[m.source])).join('||');
          row[alias] = crossCounts.get(crossKey) || 0;
        }
      }

      rows.push(row);
    }

    // 4. Sort
    const sortBy = options?.sortBy;
    const sortOrder = options?.sortOrder || 'desc';
    if (sortBy) {
      rows.sort((a, b) => {
        const va = typeof a[sortBy] === 'number' ? a[sortBy] as number : String(a[sortBy] || '');
        const vb = typeof b[sortBy] === 'number' ? b[sortBy] as number : String(b[sortBy] || '');
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortOrder === 'asc' ? va - vb : vb - va;
        }
        return sortOrder === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
    }

    // 5. Limit
    const limit = options?.limit || 50;
    return rows.slice(0, limit);
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

    const archivedWhere = {
      ...(recordsWhere.tenantId ? { tenantId: recordsWhere.tenantId as string } : {}),
      ...(recordsWhere.entityId ? { entityId: recordsWhere.entityId as unknown } : {}),
      ...(recordsWhere.createdById ? { createdById: recordsWhere.createdById as string } : {}),
    } as Prisma.ArchivedEntityDataWhereInput;

    const [records, archivedRecords, entitiesList] = await Promise.all([
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
      this.prisma.archivedEntityData.findMany({
        where: archivedWhere,
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
      ...archivedRecords.map((r) => ({
        id: r.id,
        type: 'record' as const,
        action: 'archived' as const,
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
