import { Injectable } from '@nestjs/common';
import { Prisma, TenantLifecycle } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;
const TZ = 'America/Sao_Paulo';
const LIFECYCLES = Object.values(TenantLifecycle);

/**
 * Eventos com a marca de conversao: a PRIMEIRA vez que a empresa fica ativa depois
 * de ter passado pelo teste (inclui quem venceu o teste, foi suspensa e pagou depois).
 */
const EVENTS = Prisma.sql`
  ev AS (
    SELECT e.*,
      (e."to" = 'ACTIVE'
        AND EXISTS (SELECT 1 FROM "TenantLifecycleEvent" p
                    WHERE p."tenantId" = e."tenantId" AND p."to" = 'TRIAL' AND p."createdAt" <= e."createdAt" AND p.id <> e.id)
        AND NOT EXISTS (SELECT 1 FROM "TenantLifecycleEvent" p
                    WHERE p."tenantId" = e."tenantId" AND p."to" = 'ACTIVE'
                      AND (p."createdAt" < e."createdAt" OR (p."createdAt" = e."createdAt" AND p.id < e.id)))
      ) AS "isConversion"
    FROM "TenantLifecycleEvent" e
  )`;

type LifecycleCounts = Record<TenantLifecycle, number>;
const emptyCounts = (): LifecycleCounts =>
  Object.fromEntries(LIFECYCLES.map((l) => [l, 0])) as LifecycleCounts;

export interface MonthRow { month: string; signups: number; conversions: number; cancellations: number; suspensions: number }

/**
 * Metricas do negocio para o console: empresas por situacao, entradas e saidas por
 * mes (do historico TenantLifecycleEvent), conversao do teste, planos e uso.
 * Contas de servico (chaves de API) ficam fora das contagens de pessoas.
 */
@Injectable()
export class PlatformMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics(months = 12) {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * DAY);
    const d60 = new Date(now.getTime() - 60 * DAY);
    const d90 = new Date(now.getTime() - 90 * DAY);

    const [byLifecycleRows, monthly, window, trialOutcomes, byPlan, engagement, atRisk] = await Promise.all([
      this.prisma.tenant.groupBy({ by: ['lifecycle'], where: { deletedAt: null }, _count: { _all: true } }),
      this.monthly(months),
      this.window(d60, d30),
      this.trialCohort(d90),
      this.byPlan(),
      this.engagement(d30),
      this.atRisk(d30),
    ]);

    const byLifecycle = emptyCounts();
    for (const r of byLifecycleRows) byLifecycle[r.lifecycle] = r._count._all;

    const { converted, lost } = trialOutcomes;

    return {
      generatedAt: now,
      tenants: {
        total: Object.values(byLifecycle).reduce((a, b) => a + b, 0),
        paying: byLifecycle.ACTIVE + byLifecycle.PAST_DUE,
        byLifecycle,
      },
      last30: window,
      trialConversion: { days: 90, converted, lost, rate: converted + lost > 0 ? converted / (converted + lost) : null },
      monthly,
      byPlan,
      engagement,
      atRisk,
    };
  }

  /** Ultimos N meses (fuso de Brasilia), meses vazios incluidos. */
  private async monthly(months: number): Promise<MonthRow[]> {
    const rows = await this.prisma.$queryRaw<
      { month: string; signups: bigint; conversions: bigint; cancellations: bigint; suspensions: bigint }[]
    >(Prisma.sql`
      WITH ${EVENTS}, m AS (
        SELECT to_char(gs, 'YYYY-MM') AS month
        FROM generate_series(
          date_trunc('month', (now() AT TIME ZONE ${TZ})) - make_interval(months => ${months - 1}::int),
          date_trunc('month', (now() AT TIME ZONE ${TZ})),
          interval '1 month'
        ) gs
      ),
      e AS (
        SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ}, 'YYYY-MM') AS month, "from", "to", "isConversion"
        FROM ev
        WHERE "createdAt" >= (date_trunc('month', (now() AT TIME ZONE ${TZ})) - make_interval(months => ${months - 1}::int)) AT TIME ZONE ${TZ}
      )
      SELECT m.month,
        count(e.*) FILTER (WHERE e."from" IS NULL) AS signups,
        count(e.*) FILTER (WHERE e."isConversion") AS conversions,
        count(e.*) FILTER (WHERE e."to" = 'CANCELED') AS cancellations,
        count(e.*) FILTER (WHERE e."to" = 'SUSPENDED') AS suspensions
      FROM m LEFT JOIN e ON e.month = m.month
      GROUP BY m.month ORDER BY m.month
    `);
    return rows.map((r) => ({
      month: r.month,
      signups: Number(r.signups),
      conversions: Number(r.conversions),
      cancellations: Number(r.cancellations),
      suspensions: Number(r.suspensions),
    }));
  }

  /** Ultimos 30 dias contra os 30 anteriores. */
  private async window(d60: Date, d30: Date) {
    const rows = await this.prisma.$queryRaw<
      { period: string; signups: bigint; conversions: bigint; cancellations: bigint; suspensions: bigint; selfService: bigint }[]
    >(Prisma.sql`
      WITH ${EVENTS}
      SELECT CASE WHEN "createdAt" >= ${d30} THEN 'current' ELSE 'previous' END AS period,
        count(*) FILTER (WHERE "from" IS NULL) AS signups,
        count(*) FILTER (WHERE "from" IS NULL AND source = 'signup') AS "selfService",
        count(*) FILTER (WHERE "isConversion") AS conversions,
        count(*) FILTER (WHERE "to" = 'CANCELED') AS cancellations,
        count(*) FILTER (WHERE "to" = 'SUSPENDED') AS suspensions
      FROM ev
      WHERE "createdAt" >= ${d60}
      GROUP BY 1
    `);
    const pick = (period: string) => {
      const r = rows.find((x) => x.period === period);
      return {
        signups: Number(r?.signups ?? 0),
        selfService: Number(r?.selfService ?? 0),
        conversions: Number(r?.conversions ?? 0),
        cancellations: Number(r?.cancellations ?? 0),
        suspensions: Number(r?.suspensions ?? 0),
      };
    };
    return { current: pick('current'), previous: pick('previous') };
  }

  /**
   * Coorte: empresas cujo teste terminou (primeira saida de TRIAL) nos ultimos N dias.
   * Convertida = ficou ativa depois disso (mesmo que tenha passado por suspensao).
   */
  private async trialCohort(since: Date) {
    const [row] = await this.prisma.$queryRaw<{ converted: bigint; lost: bigint }[]>(Prisma.sql`
      WITH ended AS (
        SELECT DISTINCT ON ("tenantId") "tenantId", "createdAt"
        FROM "TenantLifecycleEvent"
        WHERE "from" = 'TRIAL'
        ORDER BY "tenantId", "createdAt"
      )
      SELECT
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "TenantLifecycleEvent" a WHERE a."tenantId" = ended."tenantId" AND a."to" = 'ACTIVE' AND a."createdAt" >= ended."createdAt")) AS converted,
        count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "TenantLifecycleEvent" a WHERE a."tenantId" = ended."tenantId" AND a."to" = 'ACTIVE' AND a."createdAt" >= ended."createdAt")) AS lost
      FROM ended
      WHERE ended."createdAt" >= ${since}
    `);
    return { converted: Number(row?.converted ?? 0), lost: Number(row?.lost ?? 0) };
  }

  private async byPlan() {
    const [plans, groups, members] = await Promise.all([
      this.prisma.plan.findMany({ select: { id: true, name: true, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.tenant.groupBy({ by: ['planId', 'lifecycle'], where: { deletedAt: null }, _count: { _all: true } }),
      this.prisma.$queryRaw<{ planId: string | null; members: bigint }[]>(Prisma.sql`
        SELECT t."planId", count(*) AS members
        FROM "UserTenantAccess" a
        JOIN "Tenant" t ON t.id = a."tenantId" AND t."deletedAt" IS NULL
        JOIN "User" u ON u.id = a."userId" AND u."isServiceAccount" = false AND u."deletedAt" IS NULL
        WHERE a.status = 'ACTIVE' AND a."deletedAt" IS NULL
        GROUP BY t."planId"
      `),
    ]);
    const rows = [...plans.map((p) => ({ planId: p.id as string | null, name: p.name, isActive: p.isActive })), { planId: null, name: null, isActive: true }];
    return rows
      .map((p) => {
        const byLifecycle = emptyCounts();
        for (const g of groups.filter((x) => x.planId === p.planId)) byLifecycle[g.lifecycle] = g._count._all;
        return {
          ...p,
          total: Object.values(byLifecycle).reduce((a, b) => a + b, 0),
          paying: byLifecycle.ACTIVE + byLifecycle.PAST_DUE,
          byLifecycle,
          members: Number(members.find((m) => m.planId === p.planId)?.members ?? 0),
        };
      })
      .filter((p) => p.planId !== null || p.total > 0);
  }

  /** Pessoas (sem contas de servico) e quantas entraram nos ultimos 30 dias. */
  private async engagement(d30: Date) {
    const [row] = await this.prisma.$queryRaw<{ members: bigint; active: bigint; records: bigint }[]>(Prisma.sql`
      SELECT
        (SELECT count(DISTINCT a."userId") FROM "UserTenantAccess" a
           JOIN "User" u ON u.id = a."userId" AND u."isServiceAccount" = false AND u."deletedAt" IS NULL
           JOIN "Tenant" t ON t.id = a."tenantId" AND t."deletedAt" IS NULL
           WHERE a.status = 'ACTIVE' AND a."deletedAt" IS NULL) AS members,
        (SELECT count(DISTINCT a."userId") FROM "UserTenantAccess" a
           JOIN "User" u ON u.id = a."userId" AND u."isServiceAccount" = false AND u."deletedAt" IS NULL
           JOIN "Tenant" t ON t.id = a."tenantId" AND t."deletedAt" IS NULL
           WHERE a.status = 'ACTIVE' AND a."deletedAt" IS NULL AND u."lastLoginAt" >= ${d30}) AS active,
        (SELECT count(*) FROM "EntityData" d WHERE d."deletedAt" IS NULL) AS records
    `);
    const members = Number(row.members);
    const active = Number(row.active);
    return { members, activeMembers30d: active, activeRate: members > 0 ? active / members : null, records: Number(row.records) };
  }

  /** Clientes (ativos/em atraso) sem ninguem entrando ha 30 dias: risco de cancelar. */
  private async atRisk(d30: Date) {
    const rows = await this.prisma.$queryRaw<
      { id: string; name: string; slug: string; lifecycle: TenantLifecycle; lastLoginAt: Date | null; members: bigint }[]
    >(Prisma.sql`
      SELECT t.id, t.name, t.slug, t.lifecycle, max(u."lastLoginAt") AS "lastLoginAt", count(u.id) AS members
      FROM "Tenant" t
      LEFT JOIN "UserTenantAccess" a ON a."tenantId" = t.id AND a.status = 'ACTIVE' AND a."deletedAt" IS NULL
      LEFT JOIN "User" u ON u.id = a."userId" AND u."isServiceAccount" = false AND u."deletedAt" IS NULL
      WHERE t."deletedAt" IS NULL AND t.lifecycle IN ('ACTIVE', 'PAST_DUE')
      GROUP BY t.id
      HAVING max(u."lastLoginAt") IS NULL OR max(u."lastLoginAt") < ${d30}
      ORDER BY max(u."lastLoginAt") ASC NULLS FIRST
      LIMIT 20
    `);
    return rows.map((r) => ({ ...r, members: Number(r.members) }));
  }
}
