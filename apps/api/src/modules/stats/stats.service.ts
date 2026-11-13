import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomRoleService } from '../custom-role/custom-role.service';
import { EntityDataQueryService, type BuildWhereResult, type DashboardFilterOptions } from '../../common/services/entity-data-query.service';
import {
  acceptedFilterValues, comparison, compareGroupValues, compareTopValues, compositeKeySql, dayKeys, fieldSql, optionMeta,
  cachedStats, parentsSql, periodBounds, runStats, sameStats, scopeSql, serverTimeZone, statsMode, toStr,
} from './stats-sql';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { Prisma, type PrismaClient } from '@prisma/client';
import { creatorFilter, teammateIds } from '../../common/utils/team-scope';
import { hiddenFieldSlugs, omitFields } from '../../common/utils/field-permissions';

/** Numeros como numeros, datas ISO como datas, o resto como texto (pt-BR). */
function compareSortValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = typeof a === 'object' && a && 'label' in a ? String((a as { label: unknown }).label) : String(a);
  const sb = typeof b === 'object' && b && 'label' in b ? String((b as { label: unknown }).label) : String(b);
  const iso = /^\d{4}-\d{2}-\d{2}/;
  if (iso.test(sa) && iso.test(sb)) return Date.parse(sa) - Date.parse(sb);
  const na = Number(sa);
  const nb = Number(sb);
  if (sa.trim() !== '' && sb.trim() !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return sa.localeCompare(sb, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

/** Ajustes da tabela usados na tela inicial (titulo, situacao, prazo, responsavel). */
type HomeSettings = { titleField?: string; statusField?: string; doneValues?: string[]; deadlineField?: string; assigneeField?: string };

type GroupedDataOptions = {
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
} & DashboardFilterOptions;

/** Recorte de uma estatistica: WHERE do pipeline central + campos ocultos do cargo. */
type StatsScope = BuildWhereResult & { hidden: Set<string> };

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customRoleService: CustomRoleService,
    private readonly queryService: EntityDataQueryService,
  ) {}

  /**
   * Caminho antigo (JavaScript) x novo (SQL), conforme STATS_SQL. Em "shadow" calcula
   * os dois, registra a diferenca e devolve o antigo.
   */
  private async dual<T>(
    name: string,
    js: () => Promise<T>,
    sql: () => Promise<T>,
    cache?: { user: CurrentUser; scope: StatsScope; args: unknown; alsoEntities?: Array<string | undefined> },
  ): Promise<T> {
    const mode = statsMode();
    if (mode === 'off') return js();
    if (mode === 'on') {
      if (!cache) return sql();
      // Cache curto (fase 4): mesma pessoa, mesma estatistica, mesmos parametros e tabelas sem gravacao nova
      return cachedStats({
        tenantId: cache.scope.effectiveTenantId,
        entitySlugs: [cache.scope.entity.slug, ...(cache.alsoEntities ?? []).filter((e): e is string => !!e)],
        userId: cache.user.id,
        name,
        args: cache.args,
      }, sql);
    }
    const [oldResult, newResult] = await Promise.all([
      js(),
      sql().catch((e: Error) => { this.logger.error(`[stats-sql] ${name} falhou: ${e.message}`); return undefined; }),
    ]);
    if (newResult !== undefined) {
      if (sameStats(oldResult, newResult)) this.logger.log(`[stats-sql] ${name} igual`);
      else this.logger.warn(`[stats-sql] ${name} DIFERENTE js=${JSON.stringify(oldResult).slice(0, 600)} sql=${JSON.stringify(newResult).slice(0, 600)}`);
    }
    return oldResult;
  }

  /** CTE "recs" (registros do recorte) e, se pedido, "parents" (registros-pai). */
  private async statsCtes(scope: StatsScope, withParents = false): Promise<Prisma.Sql> {
    const recs = await scopeSql(this.prisma, scope.where, this.queryService.buildArchivedWhere(scope.where));
    return withParents
      ? Prisma.sql`WITH recs AS (${recs}), parents AS (${parentsSql(scope.effectiveTenantId)})`
      : Prisma.sql`WITH recs AS (${recs})`;
  }

  /** count/sum/avg/min/max de um campo numerico (regra do parseFloat), num recorte. */
  private async numAggSql(scope: StatsScope, fieldSlug: string, where?: Prisma.EntityDataWhereInput) {
    const sc = where ? { ...scope, where } : scope;
    const [row] = await runStats<{ count: number; sum: number; avg: number; min: number; max: number }>(this.prisma, Prisma.sql`
      ${await this.statsCtes(sc)}
      SELECT count(n)::int AS count, coalesce(sum(n), 0)::float8 AS sum, coalesce(avg(n), 0)::float8 AS avg,
             coalesce(min(n), 0)::float8 AS min, coalesce(max(n), 0)::float8 AS max
        FROM (SELECT stats_num(${fieldSql(fieldSlug)}) AS n FROM recs r) x`);
    return row;
  }

  /** Valor da agregacao pedida (count/sum/avg/min/max; outra = soma), como aggregateValues. */
  private pickAgg(row: { count: number; sum: number; avg: number; min: number; max: number }, type: string): number {
    if (!row || row.count === 0) return 0;
    switch (type) {
      case 'count': return row.count;
      case 'avg': return row.avg;
      case 'min': return row.min;
      case 'max': return row.max;
      default: return row.sum;
    }
  }

  /** FROM com o join no registro-pai so quando algum campo e "parent.x". */
  private recsFrom(withParents: boolean): Prisma.Sql {
    return withParents ? Prisma.sql`recs r LEFT JOIN parents p ON p.id = r."parentRecordId"` : Prisma.sql`recs r`;
  }

  // Helper: resolve tenantId e roleType a partir do user
  // Sempre escopado ao tenant ativo do usuario (sem visao global/cross-tenant).
  private resolveContext(user: CurrentUser, queryTenantId?: string) {
    // roleType removido (Fase 3): mantido so como sentinel para os helpers abaixo.
    const roleType = 'tenant';
    const effectiveTenantId = getEffectiveTenantId(user, queryTenantId);
    return { effectiveTenantId, roleType };
  }

  // Helper: base where para tenant
  private getWhere(tenantId: string) {
    return { tenantId };
  }

  /** Identidade global (#10): "usuarios do tenant" = quem tem membership nele. */
  private getUserWhere(tenantId: string): Prisma.UserWhereInput {
    return { tenantAccess: { some: { tenantId, deletedAt: null } } };
  }

  /**
   * Helper: constroi WHERE para entity stats via servico centralizado.
   * Retorna null se a entidade nao for encontrada (graceful).
   */
  /**
   * WHERE das estatisticas de uma tabela + campos ocultos do cargo.
   * `usedFields`: campos que a estatistica agrupa, soma, ordena ou mostra. Se algum deles
   * (ou um campo usado nos filtros do painel) for oculto para o cargo, a estatistica
   * responde vazia, como se o campo nao existisse — senao daria para ver ou deduzir o valor.
   */
  private async buildEntityWhere(
    user: CurrentUser,
    entitySlug: string,
    queryTenantId?: string,
    dashboardFilters?: DashboardFilterOptions,
    usedFields: Array<string | null | undefined> = [],
  ) {
    let result: Awaited<ReturnType<EntityDataQueryService['buildWhere']>>;
    try {
      result = await this.queryService.buildWhere({
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
    const hidden = await this.hiddenFields(user, entitySlug, result.effectiveTenantId);
    const fields = [...usedFields, ...this.filterFieldSlugs(dashboardFilters)].filter((f): f is string => !!f);
    if (await this.touchesHiddenField(user, result.entity, result.effectiveTenantId, hidden, fields)) return null;
    return { ...result, hidden };
  }

  private async hiddenFields(user: CurrentUser, entitySlug: string, tenantId: string): Promise<Set<string>> {
    return hiddenFieldSlugs(await this.customRoleService.getFieldPermissions(user.id, entitySlug, tenantId));
  }

  /** Campos citados nos filtros do painel (JSON de [{ fieldSlug, ... }]). */
  private filterFieldSlugs(dashboardFilters?: DashboardFilterOptions): string[] {
    if (!dashboardFilters?.filters) return [];
    try {
      const parsed = JSON.parse(dashboardFilters.filters) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((f) => (f && typeof f === 'object' ? (f as { fieldSlug?: unknown }).fieldSlug : undefined)).filter((f): f is string => typeof f === 'string')
        : [];
    } catch {
      return [];
    }
  }

  /**
   * Algum campo usado e oculto? Campo proprio, `parent.x` (oculto na tabela-pai) ou
   * `child.x` (oculto em alguma sub-tabela desta).
   */
  private async touchesHiddenField(
    user: CurrentUser,
    entity: { id: string; slug: string; fields?: unknown },
    tenantId: string,
    hidden: Set<string>,
    fields: string[],
  ): Promise<boolean> {
    if (fields.some((f) => hidden.has(f))) return true;
    const parentFields = fields.filter((f) => f.startsWith('parent.')).map((f) => f.slice(7));
    const childFields = fields.filter((f) => f.startsWith('child.')).map((f) => f.slice(6));
    if (parentFields.length > 0) {
      const all = await this.prisma.entity.findMany({ where: { tenantId, deletedAt: null }, select: { slug: true, fields: true } });
      const parent = all.find((e) => ((e.fields as Array<{ type?: string; subEntityId?: string; subEntitySlug?: string }>) || [])
        .some((f) => f.type === 'sub-entity' && (f.subEntityId === entity.id || f.subEntitySlug === entity.slug)));
      if (parent) {
        const parentHidden = await this.hiddenFields(user, parent.slug, tenantId);
        if (parentFields.some((f) => parentHidden.has(f))) return true;
      }
    }
    if (childFields.length > 0) {
      const subSlugs = ((entity.fields as Array<{ type?: string; subEntitySlug?: string }>) || [])
        .filter((f) => f.type === 'sub-entity' && f.subEntitySlug).map((f) => f.subEntitySlug as string);
      for (const slug of subSlugs) {
        const childHidden = await this.hiddenFields(user, slug, tenantId);
        if (childFields.some((f) => childHidden.has(f))) return true;
      }
    }
    return false;
  }

  /**
   * Retorna entidades acessiveis ao usuario.
   * CUSTOM roles: apenas entidades com canRead=true na permissions[].
   * Outros roles: todas as entidades do tenant.
   */
  private async getAccessibleEntities(
    user: CurrentUser,
    effectiveTenantId: string,
    _roleType?: string,
  ) {
    const where: Prisma.EntityWhereInput = { tenantId: effectiveTenantId };

    // Permission-driven: '*' (allAccess/coringa) = todas; senao restringe aos slugs
    // com canRead em permissions[]. Sem roleType.
    const accessible = await this.customRoleService.getUserAccessibleEntities(user.id, effectiveTenantId);
    if (accessible !== '*') {
      if (accessible.length === 0) return [];
      where.slug = { in: accessible };
    }

    const entities = await this.prisma.entity.findMany({
      where,
      select: { id: true, slug: true, name: true, settings: true, fields: true },
    });

    // Inclui as tabelas que ficam dentro de outra (ex.: Ordem de servico dentro de Cliente):
    // para quem usa, elas sao tabelas do dia a dia e os numeros precisam bater com a administracao.
    return entities;
  }

  /**
   * Conta registros de uma entidade aplicando filtros de role (scope + dataFilters + globalFilters).
   */
  private async countFilteredRecords(
    entity: { id: string; slug: string; settings: unknown },
    user: CurrentUser,
    effectiveTenantId: string,
    _roleType?: string,
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
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const where = this.getWhere(effectiveTenantId);

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

    const totalUsers = await this.prisma.user.count({ where: this.getUserWhere(effectiveTenantId) });

    return {
      totalEntities: entities.length,
      totalRecords,
      totalUsers,
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
      deletedAt: null, // serie temporal nao conta soft-deletados
    };

    // Escopo own permission-driven (sem roleType): aplica só se alguma entidade
    // acessível tiver scope 'own'. allAccess/canRead-all => 'all' => sem restricao.
    const creators = creatorFilter(await this.restrictedCreators(user, entities));
    if (creators) where.createdById = creators;

    const archivedWhere = {
      entityId: where.entityId as unknown,
      tenantId: where.tenantId as string,
      createdAt: where.createdAt as unknown,
      ...(where.createdById ? { createdById: where.createdById as string | { in: string[] } } : {}),
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

  /**
   * Restricao por criador para estatisticas: 'own' em alguma tabela => so os
   * proprios; senao 'team' em alguma => os da equipe; senao null (sem restricao).
   */
  private async restrictedCreators(
    user: CurrentUser,
    entities: { slug: string }[],
  ): Promise<string[] | null> {
    const permissions = (user.customRole?.permissions || []) as Array<{
      entitySlug: string;
      scope?: 'all' | 'own' | 'team' | 'client';
    }>;
    const wildcard = permissions.find((p) => p.entitySlug === '*');
    const scopes = entities.map((e) => (permissions.find((p) => p.entitySlug === e.slug) ?? wildcard)?.scope);
    // 'client' (portal do cliente): aqui so se conhece criador, vale o mais restrito
    if (scopes.includes('own') || scopes.includes('client')) return [user.id];
    if (scopes.includes('team')) return teammateIds(this.prisma, user.id, user.tenantId);
    return null;
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
    const { effectiveTenantId } = this.resolveContext(user, queryTenantId);
    const where = this.getUserWhere(effectiveTenantId);

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

    if (options?.comparePeriod && statsMode() !== 'off') {
      // Regra unica: periodos a partir da meia-noite, dentro do recorte
      const { now, currentStart, previousStart } = periodBounds(Number(options.days) || 30);
      const within = (range: Prisma.DateTimeFilter) => ({ ...where, AND: [...((where.AND as Prisma.EntityDataWhereInput[]) ?? []), { createdAt: range }] });
      const [cur, prev] = await Promise.all([
        this.countBoth(within({ gte: currentStart, lte: now })),
        this.countBoth(within({ gte: previousStart, lt: currentStart })),
      ]);
      result.periodComparison = comparison(cur, prev);
    } else if (options?.comparePeriod) {
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
    dateField?: string,
  ) {
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, dashFilters, [dateField]);
    if (!result) return [];
    return this.dual('records-over-time',
      () => this.recordsOverTimeJs({ ...result, where: { ...result.where } }, days, dateField),
      () => this.recordsOverTimeSql({ ...result, where: { ...result.where } }, days, dateField),
      { user, scope: result, args: [days, dateField, dashFilters] });
  }

  /** Regra unica: um ponto por dia local, do inicio do periodo (meia-noite) ate hoje. */
  private async recordsOverTimeSql(result: StatsScope, days: number, dateField?: string) {
    const fields = ((result.entity?.fields ?? []) as unknown as Array<{ slug: string; type: string }>);
    const dateSlug = dateField && fields.some((f) => f.slug === dateField && ['date', 'datetime'].includes(f.type)) ? dateField : null;
    if (dateSlug) {
      // Campo de data do registro: so o valor; o dia sai com a mesma conversao do caminho antigo
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const byField = { ...result.where, data: { path: [dateSlug], gte: startDate.toISOString().split('T')[0] } } as Prisma.EntityDataWhereInput;
      const values = await runStats<{ v: unknown }>(this.prisma, Prisma.sql`
        ${await this.statsCtes({ ...result, where: byField })} SELECT r.data -> ${dateSlug}::text AS v FROM recs r`);
      const grouped: Record<string, number> = {};
      for (const { v } of values) {
        if (typeof v !== 'string' || !v) continue;
        const d = new Date(v);
        if (isNaN(d.getTime())) continue;
        const key = d.toISOString().split('T')[0];
        grouped[key] = (grouped[key] || 0) + 1;
      }
      return this.fillDates(startDate, grouped);
    }
    const { start, keys } = dayKeys(Number(days) || 30);
    const rows = await runStats<{ d: string; n: number }>(this.prisma, Prisma.sql`
      ${await this.statsCtes(result)}
      SELECT to_char((r."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${serverTimeZone()}, 'YYYY-MM-DD') AS d, count(*)::int AS n
        FROM recs r WHERE r."createdAt" >= ${start} GROUP BY 1`);
    const counts = new Map(keys.map((k) => [k, 0]));
    for (const r of rows) counts.set(r.d, (counts.get(r.d) ?? 0) + r.n);
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }

  private async recordsOverTimeJs(result: StatsScope, days: number, dateField?: string) {
    const { where } = result;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Campo de data do registro (ex.: data da vistoria) em vez da data de criacao.
    const fields = ((result.entity?.fields ?? []) as unknown as Array<{ slug: string; type: string }>);
    const dateSlug = dateField && fields.some((f) => f.slug === dateField && ['date', 'datetime'].includes(f.type))
      ? dateField
      : null;
    if (dateSlug) {
      const day = (v: unknown): string | null => {
        if (typeof v !== 'string' || !v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
      };
      const byField = { ...where, data: { path: [dateSlug], gte: startDate.toISOString().split('T')[0] } } as Prisma.EntityDataWhereInput;
      const [active, archived] = await Promise.all([
        this.prisma.entityData.findMany({ where: byField, select: { data: true } }),
        this.prisma.archivedEntityData.findMany({
          where: this.queryService.buildArchivedWhere(byField),
          select: { data: true },
        }),
      ]);
      const grouped: Record<string, number> = {};
      for (const r of [...active, ...archived]) {
        const key = day((r.data as Record<string, unknown> | null)?.[dateSlug]);
        if (key) grouped[key] = (grouped[key] || 0) + 1;
      }
      return this.fillDates(startDate, grouped);
    }

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
    limit?: number,
    dashFilters?: DashboardFilterOptions,
  ) {
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, dashFilters, [fieldSlug]);
    limit = Number(limit) || undefined;
    if (!result) return [];
    return this.dual('field-distribution',
      () => this.fieldDistributionJs(result, fieldSlug, limit ?? 20),
      () => this.fieldDistributionSql(result, fieldSlug, limit),
      { user, scope: result, args: [fieldSlug, limit, dashFilters] });
  }

  /**
   * Regra unica: vazio nao conta, lista conta item a item, texto como no navegador
   * (objeto -> rotulo), rotulo/cor das opcoes e "Outros" acima do limite.
   */
  private async fieldDistributionSql(result: StatsScope, fieldSlug: string, limit?: number) {
    const withParents = fieldSlug.startsWith('parent.');
    const rows = await runStats<{ value: string; count: number }>(this.prisma, Prisma.sql`
      ${await this.statsCtes(result, withParents)}
      SELECT stats_str_item(e) AS value, count(*)::int AS count
        FROM (SELECT ${fieldSql(fieldSlug, true)} AS v FROM ${this.recsFrom(withParents)}) x
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(v) = 'array' THEN v ELSE jsonb_build_array(v) END) AS t(e)
       WHERE v IS NOT NULL AND jsonb_typeof(v) <> 'null' AND v <> '""'::jsonb
       GROUP BY 1
       ORDER BY 2 DESC, 1`);
    const fieldDef = this.fieldDef(result, fieldSlug);
    let items: Array<{ value: string; label: string; count: number; color?: string }> = rows.map((r) => {
      const meta = optionMeta(fieldDef, r.value);
      return { value: r.value, label: meta.label, count: r.count, ...(meta.color ? { color: meta.color } : {}) };
    });
    if (limit && limit > 0 && items.length > limit) {
      const others = items.slice(limit).reduce((n, i) => n + i.count, 0);
      items = items.slice(0, limit);
      if (others > 0) items.push({ value: '__others__', label: 'Outros', count: others });
    }
    return items;
  }

  /** Definicao do campo na tabela da estatistica (rotulos e cores das opcoes). */
  private fieldDef(result: StatsScope, fieldSlug: string) {
    return ((result.entity?.fields ?? []) as unknown as Array<{ slug: string; type?: string; options?: Array<string | { value: unknown; label?: string; color?: string }> }>)
      .find((f) => f.slug === fieldSlug);
  }

  private async fieldDistributionJs(result: StatsScope, fieldSlug: string, limit: number) {
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

    return this.finishDistribution(result, fieldSlug, distribution, labelMap, limit);
  }

  /** Rotulo/cor das opcoes, ordem por contagem e top-N (igual para os dois caminhos). */
  private finishDistribution(
    result: StatsScope,
    fieldSlug: string,
    distribution: Map<string, number>,
    labelMap: Map<string, string>,
    limit: number,
  ) {
    // Rotulo e cor das opcoes do campo (select/radio/booleano): o grafico mostra
    // "Média" em vez de "media" e usa a cor configurada na opcao.
    const fieldDef = ((result.entity?.fields ?? []) as unknown as Array<{
      slug: string; type: string; options?: Array<string | { value: string; label?: string; color?: string }>;
    }>).find((f) => f.slug === fieldSlug);
    const optionMeta = new Map<string, { label: string; color?: string }>();
    for (const o of fieldDef?.options ?? []) {
      if (typeof o === 'string') optionMeta.set(o, { label: o });
      else optionMeta.set(String(o.value), { label: o.label || String(o.value), color: o.color });
    }
    if (fieldDef?.type === 'boolean') {
      optionMeta.set('true', { label: 'Sim', color: '#2563eb' });
      optionMeta.set('false', { label: 'Não', color: '#94a3b8' });
    }

    // Ordenar por contagem desc e limitar
    return Array.from(distribution.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => {
        const meta = optionMeta.get(value);
        const label = meta?.label ?? labelMap.get(value) ?? value;
        return meta?.color ? { value, label, count, color: meta.color } : { value, label, count };
      });
  }

  async getCrossFieldDistribution(
    user: CurrentUser,
    entitySlug: string,
    rowFieldSlug: string,
    columnFieldSlug: string,
    queryTenantId?: string,
    options?: { limit?: number } & DashboardFilterOptions,
  ) {
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, options, [rowFieldSlug, columnFieldSlug]);
    if (!result) return { rows: [], columns: [], matrix: {}, maxValue: 0 };
    const limit = Number(options?.limit) || undefined;
    return this.dual('cross-field-distribution',
      () => this.crossFieldJs(result, rowFieldSlug, columnFieldSlug, limit ?? 20),
      () => this.crossFieldSql(result, rowFieldSlug, columnFieldSlug, limit),
      { user, scope: result, args: [rowFieldSlug, columnFieldSlug, options] });
  }

  /** Regra unica: celula vazia nao conta; top linhas e colunas pela frequencia. */
  private async crossFieldSql(result: StatsScope, rowFieldSlug: string, columnFieldSlug: string, limit?: number) {
    const withParents = rowFieldSlug.startsWith('parent.') || columnFieldSlug.startsWith('parent.');
    const cells = await runStats<{ rk: string; ck: string; n: number }>(this.prisma, Prisma.sql`
      ${await this.statsCtes(result, withParents)}
      SELECT rk, ck, count(*)::int AS n
        FROM (SELECT stats_str(${fieldSql(rowFieldSlug, true)}) AS rk, stats_str(${fieldSql(columnFieldSlug, true)}) AS ck FROM ${this.recsFrom(withParents)}) x
       WHERE rk <> '' AND ck <> ''
       GROUP BY 1, 2`);
    const matrix: Record<string, Record<string, number>> = {};
    const rowCounts = new Map<string, number>();
    const colCounts = new Map<string, number>();
    for (const c of cells) {
      (matrix[c.rk] ??= {})[c.ck] = c.n;
      rowCounts.set(c.rk, (rowCounts.get(c.rk) ?? 0) + c.n);
      colCounts.set(c.ck, (colCounts.get(c.ck) ?? 0) + c.n);
    }
    const byCount = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
    let rowKeys = byCount(rowCounts);
    let colKeys = byCount(colCounts);
    if (limit && limit > 0) { rowKeys = rowKeys.slice(0, limit); colKeys = colKeys.slice(0, limit); }
    let maxValue = 0;
    for (const r of rowKeys) for (const c of colKeys) maxValue = Math.max(maxValue, matrix[r]?.[c] ?? 0);
    const rowField = this.fieldDef(result, rowFieldSlug);
    const colField = this.fieldDef(result, columnFieldSlug);
    return {
      rows: rowKeys.map((v) => ({ value: v, label: optionMeta(rowField, v).label })),
      columns: colKeys.map((v) => ({ value: v, label: optionMeta(colField, v).label })),
      matrix,
      maxValue,
    };
  }

  private async crossFieldJs(result: StatsScope, rowFieldSlug: string, columnFieldSlug: string, limit: number) {
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

    return this.finishCrossField(matrix, colSet, labelMap, limit);
  }

  /** Top-N linhas pelo total, maior celula e rotulos (igual para os dois caminhos). */
  private finishCrossField(
    matrix: Record<string, Record<string, number>>,
    colSet: Set<string>,
    labelMap: Map<string, string>,
    limit: number,
  ) {
    const rowSet = Object.keys(matrix);
    // Limitar rows por top-N (ordenado por total desc)
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
    const qr = await this.buildEntityWhere(user, entitySlug, queryTenantId, options, [fieldSlug]);
    if (!qr) return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
    return this.dual('field-aggregation',
      () => this.fieldAggregationJs(qr, fieldSlug, options),
      () => this.fieldAggregationSql(qr, fieldSlug, options),
      { user, scope: qr, args: [fieldSlug, options] });
  }

  private async fieldAggregationSql(qr: StatsScope, fieldSlug: string, options?: { aggregation?: string; comparePeriod?: boolean; days?: number }) {
    const all = await this.numAggSql(qr, fieldSlug);
    const result: Record<string, unknown> = { count: all.count, sum: all.sum, avg: all.avg, min: all.min, max: all.max };
    if (options?.comparePeriod) {
      // Regra unica: periodos a partir da meia-noite, dentro do recorte, pela agregacao escolhida
      const { now, currentStart, previousStart } = periodBounds(Number(options.days) || 30);
      const agg = options.aggregation || 'sum';
      const within = (gte: Date, end: Prisma.DateTimeFilter) => ({ ...qr.where, AND: [...((qr.where.AND as Prisma.EntityDataWhereInput[]) ?? []), { createdAt: { gte, ...end } }] });
      const cur = await this.numAggSql(qr, fieldSlug, within(currentStart, { lte: now }));
      const prev = await this.numAggSql(qr, fieldSlug, within(previousStart, { lt: currentStart }));
      result.periodComparison = comparison(this.pickAgg(cur, agg), this.pickAgg(prev, agg));
    }
    return result;
  }

  private async fieldAggregationJs(qr: StatsScope, fieldSlug: string, options?: { aggregation?: string; comparePeriod?: boolean; days?: number }) {
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
    const qr = await this.buildEntityWhere(user, entitySlug, queryTenantId, options, [numeratorField, options?.denominatorEntitySlug && options.denominatorEntitySlug !== entitySlug ? null : denominatorField]);
    if (!qr) return { numerator: 0, denominator: 0, ratio: 0, percentage: 0 };
    return this.dual('field-ratio',
      () => this.fieldRatioCore(user, qr, entitySlug, numeratorField, denominatorField, queryTenantId, options, false),
      () => this.fieldRatioCore(user, qr, entitySlug, numeratorField, denominatorField, queryTenantId, options, true),
      { user, scope: qr, args: [numeratorField, denominatorField, options], alsoEntities: [options?.denominatorEntitySlug] });
  }

  private async fieldRatioCore(
    user: CurrentUser,
    qr: StatsScope,
    entitySlug: string,
    numeratorField: string,
    denominatorField: string,
    queryTenantId: string | undefined,
    options: ({ aggregation?: string; comparePeriod?: boolean; days?: number; denominatorEntitySlug?: string } & DashboardFilterOptions) | undefined,
    useSql: boolean,
  ) {
    const { where } = qr;
    // Soma/media de um campo num recorte: no banco (useSql) ou carregando os registros
    const aggOf = async (scopeQr: StatsScope, w: Prisma.EntityDataWhereInput, field: string, type: string) => useSql
      ? this.pickAgg(await this.numAggSql(scopeQr, field, w), type)
      : this.aggregateValues(this.extractNumericValues(await this.fetchDataFromBoth(w) as { data: unknown }[], field), type);
    const agg = options?.aggregation || 'sum';
    const isNumeratorCount = numeratorField === 'count';
    const isDenominatorCount = denominatorField === 'count';
    const denominatorEntitySlug = options?.denominatorEntitySlug;

    // Build denominator WHERE if cross-entity
    let denWhere = where;
    let denScope: StatsScope = qr;
    if (denominatorEntitySlug && denominatorEntitySlug !== entitySlug) {
      const denQr = await this.buildEntityWhere(user, denominatorEntitySlug, queryTenantId, options, [denominatorField]);
      if (!denQr) return { numerator: 0, denominator: 0, ratio: 0, percentage: 0 };
      denWhere = denQr.where;
      denScope = denQr;
    }

    // For 'count' fields, just count records; for real fields, extract values
    let numerator: number;
    let denominator: number;

    if (isNumeratorCount) {
      numerator = await this.countBoth(where);
    } else {
      numerator = await aggOf(qr, where, numeratorField, agg);
    }

    if (isDenominatorCount) {
      denominator = await this.countBoth(denWhere);
    } else {
      denominator = await aggOf(denScope, denWhere, denominatorField, agg);
    }

    const ratio = denominator !== 0 ? numerator / denominator : 0;
    const percentage = ratio * 100;

    const result: Record<string, unknown> = { numerator, denominator, ratio, percentage };

    if (options?.comparePeriod && useSql) {
      // Regra unica: periodos a partir da meia-noite, dentro do recorte de cada lado
      const { now, currentStart, previousStart } = periodBounds(Number(options.days) || 30);
      const within = (w: Prisma.EntityDataWhereInput, range: Prisma.DateTimeFilter) => ({ ...w, AND: [...((w.AND as Prisma.EntityDataWhereInput[]) ?? []), { createdAt: range }] });
      const part = async (scope: StatsScope, w: Prisma.EntityDataWhereInput, field: string, isCount: boolean, range: Prisma.DateTimeFilter) =>
        isCount ? this.countBoth(within(w, range)) : aggOf(scope, within(w, range), field, agg);
      const curNum = await part(qr, where, numeratorField, isNumeratorCount, { gte: currentStart, lte: now });
      const curDen = await part(denScope, denWhere, denominatorField, isDenominatorCount, { gte: currentStart, lte: now });
      const prevNum = await part(qr, where, numeratorField, isNumeratorCount, { gte: previousStart, lt: currentStart });
      const prevDen = await part(denScope, denWhere, denominatorField, isDenominatorCount, { gte: previousStart, lt: currentStart });
      result.periodComparison = comparison(curDen !== 0 ? (curNum / curDen) * 100 : 0, prevDen !== 0 ? (prevNum / prevDen) * 100 : 0);
    } else if (options?.comparePeriod) {
      const days = options.days || 30;
      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - days);
      const previousStart = new Date(periodStart);
      previousStart.setDate(previousStart.getDate() - days);

      const curNum = isNumeratorCount
        ? await this.countBoth({ ...where, createdAt: { gte: periodStart, lte: now } })
        : await aggOf(qr, { ...where, createdAt: { gte: periodStart, lte: now } }, numeratorField, agg);

      const curDen = isDenominatorCount
        ? await this.countBoth({ ...denWhere, createdAt: { gte: periodStart, lte: now } })
        : await aggOf(denScope, { ...denWhere, createdAt: { gte: periodStart, lte: now } }, denominatorField, agg);

      const curPct = curDen !== 0 ? (curNum / curDen) * 100 : 0;

      const prevNum = isNumeratorCount
        ? await this.countBoth({ ...where, createdAt: { gte: previousStart, lt: periodStart } })
        : await aggOf(qr, { ...where, createdAt: { gte: previousStart, lt: periodStart } }, numeratorField, agg);

      const prevDen = isDenominatorCount
        ? await this.countBoth({ ...denWhere, createdAt: { gte: previousStart, lt: periodStart } })
        : await aggOf(denScope, { ...denWhere, createdAt: { gte: previousStart, lt: periodStart } }, denominatorField, agg);

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
    const qr = await this.buildEntityWhere(user, entitySlug, queryTenantId, options, [fieldSlug]);
    if (!qr) return [];
    return this.dual('field-trend',
      () => this.fieldTrendJs({ ...qr, where: { ...qr.where } }, fieldSlug, options),
      () => this.fieldTrendSql({ ...qr, where: { ...qr.where } }, fieldSlug, options),
      { user, scope: qr, args: [fieldSlug, options] });
  }

  /** Regra unica: um ponto por dia local do periodo; dia sem valor = 0. */
  private async fieldTrendSql(qr: StatsScope, fieldSlug: string, options?: { aggregation?: string; days?: number }) {
    const agg = options?.aggregation || 'sum';
    const { start, keys } = dayKeys(Number(options?.days) || 30);
    const rows = await runStats<{ d: string; count: number; sum: number; avg: number; min: number; max: number }>(this.prisma, Prisma.sql`
      ${await this.statsCtes(qr)}
      SELECT d, count(n)::int AS count, coalesce(sum(n), 0)::float8 AS sum, coalesce(avg(n), 0)::float8 AS avg,
             coalesce(min(n), 0)::float8 AS min, coalesce(max(n), 0)::float8 AS max
        FROM (SELECT to_char((r."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${serverTimeZone()}, 'YYYY-MM-DD') AS d,
                     stats_num(${fieldSql(fieldSlug)}) AS n
                FROM recs r WHERE r."createdAt" >= ${start}) x
       WHERE n IS NOT NULL
       GROUP BY d`);
    const byDay = new Map<string, number>(keys.map((k) => [k, 0]));
    for (const r of rows) byDay.set(r.d, this.pickAgg(r, agg));
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  }

  private async fieldTrendJs(qr: StatsScope, fieldSlug: string, options?: { aggregation?: string; days?: number }) {
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

    const { where, hidden } = result;

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
        data: omitFields(r.data as Record<string, unknown>, hidden),
      })),
      ...archivedRecords.map((r) => ({
        id: r.id,
        action: 'archived' as const,
        timestamp: r.updatedAt.toISOString(),
        userName: 'Sistema',
        data: omitFields(r.data as Record<string, unknown>, hidden),
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
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, options, [...(options?.fields ?? []), options?.sortBy]);
    if (!result) return [];
    return this.dual('top-records',
      () => this.topRecordsJs(result, options),
      () => this.topRecordsSql(result, options),
      { user, scope: result, args: [options] });
  }

  /** Regra unica: 10 por padrao; ordem pelo texto (vazios no fim, data, numero, texto pt-BR). */
  private async topRecordsSql(result: StatsScope, options?: { limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc'; fields?: string[] }) {
    // Teto de 1000 linhas (mini-tabela pede "tudo" com limite 99999)
    const limit = Math.min(Number(options?.limit) || 10, 1000);
    const sortBy = options?.sortBy || 'createdAt';
    const desc = (options?.sortOrder || 'desc') === 'desc';
    type TopRecord = { id: string; data: unknown; createdAt: Date; updatedAt: Date; parentRecordId: string | null };
    const ctes = await this.statsCtes(result);
    let sliced: TopRecord[];
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      sliced = await runStats<TopRecord>(this.prisma, Prisma.sql`
        ${ctes} SELECT * FROM recs ORDER BY ${Prisma.raw(`"${sortBy}"`)} ${Prisma.raw(desc ? 'DESC' : 'ASC')}, id LIMIT ${limit}`);
    } else {
      const values = await runStats<{ id: string; v: unknown; c: Date }>(this.prisma, Prisma.sql`
        ${ctes} SELECT id, r.data -> ${sortBy}::text AS v, r."createdAt" AS c FROM recs r ORDER BY r."createdAt" DESC, id`);
      values.sort((a, b) => compareTopValues(a.v, b.v, desc));
      const ids = values.slice(0, limit).map((v) => v.id);
      const full = await runStats<TopRecord>(this.prisma, Prisma.sql`${ctes} SELECT * FROM recs WHERE id = ANY(${ids}::text[])`);
      const byId = new Map(full.map((r) => [r.id, r]));
      sliced = ids.map((id) => byId.get(id)).filter((r): r is TopRecord => !!r);
    }
    return this.finishTopRecords(result, sliced, options);
  }

  private async topRecordsJs(result: StatsScope, options?: { limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc'; fields?: string[] }) {
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
        // Vazios sempre no fim, em qualquer direcao
        const emptyA = dataA === null || dataA === undefined || dataA === '';
        const emptyB = dataB === null || dataB === undefined || dataB === '';
        if (emptyA || emptyB) return Number(emptyA) - Number(emptyB);
        const cmp = compareSortValues(dataA, dataB);
        return sortOrder === 'desc' ? -cmp : cmp;
      });
    } else {
      allRecords.sort((a, b) => {
        const tA = a[sortBy].getTime();
        const tB = b[sortBy].getTime();
        return sortOrder === 'desc' ? tB - tA : tA - tB;
      });
    }

    const sliced = allRecords.slice(0, limit);
    return this.finishTopRecords(result, sliced, options);
  }

  /** Campos pedidos (sem os ocultos) e campos do registro-pai (igual para os dois caminhos). */
  private async finishTopRecords(
    result: StatsScope,
    sliced: Array<{ id: string; data: unknown; createdAt: Date; updatedAt: Date; parentRecordId: string | null }>,
    options?: { fields?: string[] },
  ) {
    const { hidden } = result;
    // Resolve parent fields if any requested
    const { parent: parentFieldSlugs } = this.extractParentSlugs(options?.fields || []);
    const parentDataMap = await this.resolveParentFields(sliced, parentFieldSlugs);

    return sliced.map((r) => {
      const ownData = options?.fields
        ? Object.fromEntries(options.fields.filter((f) => !f.startsWith('parent.')).map((f) => [f, (r.data as Record<string, unknown>)?.[f]]))
        : omitFields({ ...(r.data as Record<string, unknown>) }, hidden);

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
    const result = await this.buildEntityWhere(user, entitySlug, queryTenantId, dashFilters, [fieldSlug]);
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

    if (statsMode() !== 'off') {
      // Regra unica: valor pelo texto do navegador; percentual sobre o total de registros
      const rows = await runStats<{ k: string; n: number }>(this.prisma, Prisma.sql`
        ${await this.statsCtes(result)} SELECT stats_str(${fieldSql(fieldSlug)}) AS k, count(*)::int AS n FROM recs r GROUP BY 1`);
      const counts = new Map(rows.map((r) => [r.k, r.n]));
      const total = rows.reduce((n, r) => n + r.n, 0) || 1;
      return orderedStages.map((stage) => ({
        stage,
        label: labelMap.get(stage) || stage,
        count: counts.get(stage) ?? 0,
        percentage: ((counts.get(stage) ?? 0) / total) * 100,
      }));
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
    const qr = await this.buildEntityWhere(user, entitySlug, queryTenantId, options, [...fieldSlugs, options?.filterField]);
    if (!qr) return { total: 0 };
    return this.dual('distinct-count',
      () => this.distinctCountJs(qr, fieldSlugs, options),
      () => this.distinctCountSql(qr, fieldSlugs, options),
      { user, scope: qr, args: [fieldSlugs, options] });
  }

  /**
   * Regra unica: chave pelo texto do navegador; com filtro, "total" e o numero filtrado
   * (filtro sem diferenciar maiusculas, Sim/Nao = true/false); periodos a partir da meia-noite.
   */
  private async distinctCountSql(
    qr: StatsScope,
    fieldSlugs: string[],
    options?: { comparePeriod?: boolean; days?: number; filterField?: string; filterValue?: string },
  ) {
    const hasFilter = !!options?.filterField && options.filterValue !== undefined;
    const include = hasFilter
      ? Prisma.sql`lower(stats_str(${fieldSql(options!.filterField!)})) = ANY(${acceptedFilterValues(options!.filterValue!)}::text[])`
      : Prisma.sql`true`;
    const key = fieldSlugs.length
      ? Prisma.sql`concat_ws('||', ${Prisma.join(fieldSlugs.map((f) => Prisma.sql`stats_str(${fieldSql(f)})`), ', ')})`
      : Prisma.sql`''`;
    const { now, currentStart, previousStart } = periodBounds(Number(options?.days) || 30);
    const [c] = await runStats<{ all: number; filtered: number; cur: number; prev: number }>(this.prisma, Prisma.sql`
      ${await this.statsCtes(qr)}
      SELECT count(DISTINCT k)::int AS all,
             count(DISTINCT k) FILTER (WHERE inc)::int AS filtered,
             count(DISTINCT k) FILTER (WHERE inc AND created >= ${currentStart} AND created <= ${now})::int AS cur,
             count(DISTINCT k) FILTER (WHERE inc AND created >= ${previousStart} AND created < ${currentStart})::int AS prev
        FROM (SELECT ${key} AS k, ${include} AS inc, r."createdAt" AS created FROM recs r) x`);
    const result: Record<string, unknown> = {
      total: hasFilter ? c.filtered : c.all,
      ...(hasFilter ? { totalDistinct: c.all, filteredDistinct: c.filtered } : {}),
    };
    if (options?.comparePeriod) result.periodComparison = comparison(c.cur, c.prev);
    return result;
  }

  private async distinctCountJs(
    qr: StatsScope,
    fieldSlugs: string[],
    options?: { comparePeriod?: boolean; days?: number; filterField?: string; filterValue?: string },
  ) {
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
    options?: GroupedDataOptions,
  ): Promise<Array<Record<string, unknown>>> {
    const qr = await this.buildEntityWhere(user, entitySlug, queryTenantId, options, [
      ...groupByFields,
      ...(options?.aggregations ?? []).flatMap((a) => [a.fieldSlug, ...(a.distinctFields ?? [])]),
      ...(options?.crossEntityCount?.matchFields ?? []).map((m) => m.source),
    ]);
    if (!qr) return [];
    return this.dual('grouped-data',
      () => this.groupedDataJs(user, qr, groupByFields, queryTenantId, options),
      () => this.groupedDataSql(user, qr, groupByFields, queryTenantId, options),
      { user, scope: qr, args: [groupByFields, options], alsoEntities: [options?.crossEntityCount?.entitySlug] });
  }

  /**
   * Regra unica: chave pelo texto do navegador; "primeiro" = registro mais recente do grupo;
   * "mais frequente" ignora vazio e desempata pelo que aparece primeiro (mais recente);
   * ordenacao numerica quando os dois valores sao numeros.
   */
  private async groupedDataSql(
    user: CurrentUser,
    qr: StatsScope,
    groupByFields: string[],
    queryTenantId: string | undefined,
    options?: GroupedDataOptions,
  ): Promise<Array<Record<string, unknown>>> {
    const aggregations = options?.aggregations || [{ type: 'count' as const, alias: 'total' }];
    const cross = options?.crossEntityCount;
    const recent = Prisma.sql`ORDER BY r."createdAt" DESC, r.id DESC`;
    const aggCols = aggregations.map((agg, i) => {
      const col = Prisma.raw(`a${i}`);
      const field = agg.fieldSlug ? fieldSql(agg.fieldSlug) : Prisma.sql`NULL::jsonb`;
      switch (agg.type) {
        case 'count': return Prisma.sql`count(*)::int AS ${col}`;
        case 'first': return agg.fieldSlug ? Prisma.sql`(array_agg(stats_str(${field}) ${recent}))[1] AS ${col}` : Prisma.sql`NULL AS ${col}`;
        case 'mode': return Prisma.sql`NULL AS ${col}`; // calculado a parte (desempate)
        case 'distinctCount': {
          const dFields = agg.distinctFields ?? (agg.fieldSlug ? [agg.fieldSlug] : []);
          if (!dFields.length) return Prisma.sql`count(*)::int AS ${col}`;
          return Prisma.sql`count(DISTINCT concat_ws('||', ${Prisma.join(dFields.map((f) => Prisma.sql`stats_str(${fieldSql(f)})`), ', ')}))::int AS ${col}`;
        }
        case 'sum': return Prisma.sql`coalesce(sum(stats_num(${field})), 0)::float8 AS ${col}`;
        case 'avg': return Prisma.sql`coalesce(avg(stats_num(${field})), 0)::float8 AS ${col}`;
        case 'min': return Prisma.sql`coalesce(min(stats_num(${field})), 0)::float8 AS ${col}`;
        case 'max': return Prisma.sql`coalesce(max(stats_num(${field})), 0)::float8 AS ${col}`;
        default: return Prisma.sql`0 AS ${col}`;
      }
    });
    const keyExprs = groupByFields.map((f) => Prisma.sql`stats_str(${fieldSql(f)})`);
    const keyCols = keyExprs.map((e, i) => Prisma.sql`${e} AS ${Prisma.raw(`k${i}`)}`);
    const groupBy = groupByFields.length ? Prisma.sql`GROUP BY ${Prisma.join(groupByFields.map((_, i) => Prisma.raw(String(i + 1))), ', ')}` : Prisma.empty;

    let kidsCte = Prisma.empty;
    let kidsJoin = Prisma.empty;
    let kidsCol = Prisma.empty;
    if (cross?.matchBy === 'children') {
      const crossQr = await this.buildEntityWhere(user, cross.entitySlug, queryTenantId, { dateStart: options?.dateStart, dateEnd: options?.dateEnd });
      if (crossQr) {
        const kids = await scopeSql(this.prisma, crossQr.where, this.queryService.buildArchivedWhere(crossQr.where));
        kidsCte = Prisma.sql`, kids AS (SELECT "parentRecordId" AS pid, count(*)::int AS n FROM (${kids}) k WHERE "parentRecordId" IS NOT NULL GROUP BY 1)`;
        kidsJoin = Prisma.sql`LEFT JOIN kids kc ON kc.pid = r.id`;
        kidsCol = Prisma.sql`, coalesce(sum(kc.n), 0)::int AS kids`;
      }
    }
    const matchFields = cross && cross.matchBy !== 'children' ? cross.matchFields ?? [] : [];
    const srcCol = matchFields.length
      ? Prisma.sql`, (array_agg(${compositeKeySql(matchFields.map((m) => m.source))} ${recent}))[1] AS src`
      : Prisma.empty;

    const ctes = await this.statsCtes(qr);
    const groups = await runStats<Record<string, unknown>>(this.prisma, Prisma.sql`
      ${ctes}${kidsCte}
      SELECT ${Prisma.join([...keyCols, ...aggCols], ', ')} ${kidsCol} ${srcCol}
        FROM recs r ${kidsJoin}
       ${groupBy}`);

    // "Mais frequente" por grupo: maior contagem; empate -> o que aparece primeiro (mais recente)
    const modes = new Map<string, string>();
    for (const [i, agg] of aggregations.entries()) {
      if (agg.type !== 'mode' || !agg.fieldSlug) continue;
      const rows = await runStats<Record<string, unknown>>(this.prisma, Prisma.sql`
        ${ctes}
        SELECT ${Prisma.join([...keyCols, Prisma.sql`stats_str(${fieldSql(agg.fieldSlug)}) AS v`, Prisma.sql`count(*)::int AS n`, Prisma.sql`max(r."createdAt") AS last`], ', ')}
          FROM recs r
         WHERE stats_str(${fieldSql(agg.fieldSlug)}) <> ''
         GROUP BY ${Prisma.join([...groupByFields.map((_, j) => Prisma.raw(String(j + 1))), Prisma.raw(String(groupByFields.length + 1))], ', ')}`);
      const best = new Map<string, { v: string; n: number; last: number }>();
      for (const r of rows) {
        const gk = groupByFields.map((_, j) => String(r[`k${j}`])).join('||');
        const cand = { v: String(r.v), n: Number(r.n), last: new Date(r.last as Date).getTime() };
        const cur = best.get(gk);
        if (!cur || cand.n > cur.n || (cand.n === cur.n && cand.last > cur.last)) best.set(gk, cand);
      }
      for (const [gk, b] of best) modes.set(`${i}|${gk}`, b.v);
    }

    let crossCounts: Map<string, number> | undefined;
    if (matchFields.length && cross) {
      const crossQr = await this.buildEntityWhere(user, cross.entitySlug, queryTenantId, options, matchFields.map((m) => m.target));
      if (crossQr) {
        const counts = await runStats<{ k: string; n: number }>(this.prisma, Prisma.sql`
          ${await this.statsCtes(crossQr)}
          SELECT ${compositeKeySql(matchFields.map((m) => m.target))} AS k, count(*)::int AS n FROM recs r GROUP BY 1`);
        crossCounts = new Map(counts.map((c) => [c.k, c.n]));
      }
    }

    const rows = groups.map((g) => {
      const row: Record<string, unknown> = {};
      groupByFields.forEach((f, i) => { row[f] = g[`k${i}`]; });
      const gk = groupByFields.map((_, i) => String(g[`k${i}`])).join('||');
      aggregations.forEach((agg, i) => {
        const v = g[`a${i}`];
        if (agg.type === 'mode') row[agg.alias] = agg.fieldSlug ? modes.get(`${i}|${gk}`) ?? '' : null;
        else if (agg.type === 'first') row[agg.alias] = v ?? null;
        else row[agg.alias] = Number(v ?? 0);
      });
      if (cross?.matchBy === 'children' && 'kids' in g) row[cross.alias] = Number(g.kids ?? 0);
      else if (crossCounts && cross) row[cross.alias] = crossCounts.get(String(g.src)) || 0;
      return row;
    });
    const sortBy = options?.sortBy;
    if (sortBy) rows.sort((a, b) => compareGroupValues(a[sortBy], b[sortBy], options?.sortOrder === 'asc'));
    const limit = Number(options?.limit) || 0;
    return limit > 0 ? rows.slice(0, limit) : rows.slice(0, 1000);
  }

  private async groupedDataJs(
    user: CurrentUser,
    qr: StatsScope,
    groupByFields: string[],
    queryTenantId: string | undefined,
    options?: GroupedDataOptions,
  ): Promise<Array<Record<string, unknown>>> {
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
        const crossQr = await this.buildEntityWhere(user, crossSlug, queryTenantId, options, matchFields.map((m) => m.target));
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

    return this.finishGrouped(rows, options);
  }

  /** Ordenacao e limite dos grupos (igual para os dois caminhos). */
  private finishGrouped(rows: Array<Record<string, unknown>>, options?: GroupedDataOptions) {
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

  /**
   * Inicio da pessoa: tabelas que ela ve (com contagem no escopo dela) e os
   * registros que ela criou ou alterou por ultimo, com titulo e etiqueta de
   * situacao. Tudo pelo pipeline central (escopo, filtros) e sem campos ocultos.
   */
  async getMyHome(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const accessible = await this.customRoleService.getUserAccessibleEntities(user.id, tenantId);
    if (accessible !== '*' && accessible.length === 0) return { tables: [], recent: [], pending: [] };
    const entities = await this.prisma.entity.findMany({
      where: { tenantId, deletedAt: null, ...(accessible !== '*' ? { slug: { in: accessible } } : {}) },
      select: { id: true, slug: true, name: true, namePlural: true, color: true, icon: true, fields: true, settings: true },
      orderBy: { createdAt: 'asc' },
      take: 40,
    });

    type FieldDef = { slug: string; type: string; subEntitySlug?: string; options?: Array<string | { value: string; label: string; color?: string }> };
    const subSlugs = new Set<string>();
    for (const e of entities) {
      for (const f of ((e.fields as unknown as FieldDef[]) || [])) if (f.type === 'sub-entity' && f.subEntitySlug) subSlugs.add(f.subEntitySlug);
    }

    const perEntity = await Promise.all(entities.map(async (entity) => {
      const fields = (entity.fields as unknown as FieldDef[]) || [];
      const hidden = hiddenFieldSlugs(await this.customRoleService.getFieldPermissions(user.id, entity.slug, tenantId));
      const { where } = await this.queryService.buildWhere({ entitySlug: entity.slug, user, tenantId, includeChildren: true });
      const [count, mine] = await Promise.all([
        this.prisma.entityData.count({ where }),
        this.prisma.entityData.findMany({
          where: { AND: [where, { OR: [{ createdById: user.id }, { updatedById: user.id }] }] },
          select: { id: true, data: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 6,
        }),
      ]);
      // Titulo: campo-titulo da tabela, senao o primeiro campo de texto visivel
      const titleField = (entity.settings as Record<string, unknown> | null)?.titleField as string | undefined;
      const titleSlug = titleField && !hidden.has(titleField)
        ? titleField
        : fields.find((f) => ['text', 'email', 'phone', 'number'].includes(f.type) && !hidden.has(f.slug))?.slug;
      const settings = (entity.settings as HomeSettings | null) || {};
      // Situacao: a escolhida nos Ajustes da tabela; senao uma lista com cores,
      // preferindo a que se chama situacao/status/etapa/resultado
      const colored = fields.filter((f) => (f.type === 'select' || f.type === 'radio-group') && !hidden.has(f.slug)
        && (f.options || []).some((o) => typeof o !== 'string' && !!o.color));
      const configuredStatus = settings.statusField && !hidden.has(settings.statusField)
        ? fields.find((f) => f.slug === settings.statusField)
        : undefined;
      const statusField = configuredStatus
        ?? colored.find((f) => /status|situa|etapa|resultado|estado/i.test(f.slug)) ?? colored[0];
      const statusOf = (data: Record<string, unknown>) => {
        const value = statusField ? data[statusField.slug] : undefined;
        const opt = statusField?.options?.find((o) => (typeof o === 'string' ? o : o.value) === value);
        if (!opt) return null;
        return typeof opt === 'string' ? { label: opt, color: null } : { label: opt.label, color: opt.color ?? null };
      };
      const titleOf = (data: Record<string, unknown>) => {
        const rawTitle = titleSlug ? data[titleSlug] : undefined;
        return rawTitle === undefined || rawTitle === null || rawTitle === '' ? null : String(rawTitle).slice(0, 120);
      };
      const recent = mine.map((r) => {
        const data = (r.data as Record<string, unknown>) || {};
        return {
          id: r.id,
          entitySlug: entity.slug,
          entityName: entity.name,
          color: entity.color,
          title: titleOf(data),
          status: statusOf(data),
          updatedAt: r.updatedAt,
        };
      });
      const pending = await this.homePending(entity, settings, fields, hidden, where, user, titleOf, statusOf);
      return {
        table: {
          slug: entity.slug, name: entity.name, namePlural: entity.namePlural, color: entity.color, icon: entity.icon,
          count, isSub: subSlugs.has(entity.slug),
        },
        recent,
        pending,
      };
    }));

    return {
      pending: perEntity.flatMap((p) => p.pending)
        .sort((a, b) => a.deadline.localeCompare(b.deadline))
        .slice(0, 10),
      tables: perEntity.map((p) => p.table),
      recent: perEntity.flatMap((p) => p.recent)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 8),
    };
  }

  /**
   * Pendencias da tabela (Ajustes > Prazo): registros com prazo que nao estao numa
   * situacao que encerra; com "Responsavel", so os da pessoa (o campo guarda o nome).
   * Le no maximo 300 registros por tabela (os de prazo mais proximo vem do filtro em memoria).
   */
  private async homePending(
    entity: { slug: string; name: string; color: string | null },
    settings: HomeSettings,
    fields: Array<{ slug: string; type: string }>,
    hidden: Set<string>,
    where: Prisma.EntityDataWhereInput,
    user: CurrentUser,
    titleOf: (data: Record<string, unknown>) => string | null,
    statusOf: (data: Record<string, unknown>) => { label: string; color: string | null } | null,
  ) {
    const deadlineSlug = settings.deadlineField;
    if (!deadlineSlug || hidden.has(deadlineSlug) || !fields.some((f) => f.slug === deadlineSlug)) return [];
    const done = new Set(settings.doneValues || []);
    const and: Prisma.EntityDataWhereInput[] = [where];
    if (settings.statusField) {
      for (const value of Array.from(done)) {
        // Campo Sim/Nao (ex.: "Resolvida") guarda booleano; as opcoes chegam como 'true'/'false'
        const stored = value === 'true' ? true : value === 'false' ? false : value;
        and.push({ NOT: { data: { path: [settings.statusField], equals: stored } } });
      }
    }
    if (settings.assigneeField) and.push({ data: { path: [settings.assigneeField], equals: user.name } });
    const rows = await this.prisma.entityData.findMany({
      where: { AND: and },
      select: { id: true, data: true },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    });
    return rows.flatMap((r) => {
      const data = (r.data as Record<string, unknown>) || {};
      const raw = data[deadlineSlug];
      if (typeof raw !== 'string' || !raw) return [];
      if (settings.statusField && done.has(String(data[settings.statusField] ?? ''))) return [];
      return [{
        id: r.id,
        entitySlug: entity.slug,
        entityName: entity.name,
        color: entity.color,
        title: titleOf(data),
        status: statusOf(data),
        deadline: raw,
      }];
    });
  }

  async getRecentActivity(user: CurrentUser, queryTenantId?: string, limit: number = 10) {
    const { effectiveTenantId, roleType } = this.resolveContext(user, queryTenantId);
    const where = this.getWhere(effectiveTenantId);

    // Para entidades, filtrar pelas acessiveis
    const entities = await this.getAccessibleEntities(user, effectiveTenantId, roleType);
    const entityIds = entities.map((e) => e.id);

    const recordsWhere: Prisma.EntityDataWhereInput = {
      ...where,
      deletedAt: null, // atividade recente nao lista soft-deletados
      ...(entityIds.length > 0 ? { entityId: { in: entityIds } } : { entityId: '__none__' }),
    };

    // Escopo own permission-driven (sem roleType).
    const recordCreators = creatorFilter(await this.restrictedCreators(user, entities));
    if (recordCreators) recordsWhere.createdById = recordCreators;

    const archivedWhere = {
      ...(recordsWhere.tenantId ? { tenantId: recordsWhere.tenantId as string } : {}),
      ...(recordsWhere.entityId ? { entityId: recordsWhere.entityId as unknown } : {}),
      ...(recordsWhere.createdById ? { createdById: recordsWhere.createdById as string | { in: string[] } } : {}),
    } as Prisma.ArchivedEntityDataWhereInput;

    const [records, archivedRecords, entitiesList] = await Promise.all([
      this.prisma.entityData.findMany({
        where: recordsWhere,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          data: true,
          entity: { select: { name: true, slug: true, settings: true, fields: true } },
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

    // Nome do registro (campo-titulo ou primeiro texto visivel ao cargo) no lugar de "Registro"
    const hiddenBySlug = new Map<string, Set<string>>();
    for (const slug of Array.from(new Set(records.map((r) => r.entity.slug)))) {
      hiddenBySlug.set(slug, hiddenFieldSlugs(await this.customRoleService.getFieldPermissions(user.id, slug, effectiveTenantId)));
    }
    const recordTitle = (r: (typeof records)[number]): string => {
      const hidden = hiddenBySlug.get(r.entity.slug) ?? new Set<string>();
      const fields = (r.entity.fields as unknown as Array<{ slug: string; type: string }>) || [];
      const titleField = (r.entity.settings as Record<string, unknown> | null)?.titleField as string | undefined;
      const slug = titleField && !hidden.has(titleField)
        ? titleField
        : fields.find((f) => ['text', 'email', 'phone', 'number'].includes(f.type) && !hidden.has(f.slug))?.slug;
      const value = slug ? (r.data as Record<string, unknown> | null)?.[slug] : undefined;
      return value === undefined || value === null || value === '' ? 'Registro' : String(value).slice(0, 80);
    };

    const activities = [
      ...records.map((r) => ({
        id: r.id,
        type: 'record' as const,
        action:
          r.createdAt.getTime() === r.updatedAt.getTime()
            ? ('created' as const)
            : ('updated' as const),
        name: recordTitle(r),
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
