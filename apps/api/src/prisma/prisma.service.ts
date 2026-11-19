import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { OpsMonitorService } from '../common/services/ops-monitor.service';
import { bumpStatsTenant } from '../modules/stats/stats-sql';

type WriteArgs = { data?: unknown; where?: unknown; create?: unknown; select?: Record<string, unknown> } | undefined;

/** tenantId (texto) de um objeto, ou de `tenant: { connect: { id } }`. */
function tenantIdOf(o: unknown): string | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as { tenantId?: unknown; tenant?: { connect?: { id?: unknown } } };
  if (typeof r.tenantId === 'string') return r.tenantId;
  return typeof r.tenant?.connect?.id === 'string' ? r.tenant.connect.id : null;
}

/** Empresas citadas no proprio pedido de gravacao (data, where, create). */
function tenantsOfArgs(args: WriteArgs): string[] {
  const datas = Array.isArray(args?.data) ? args.data : [args?.data];
  return [...new Set([...datas.map(tenantIdOf), tenantIdOf(args?.where), tenantIdOf(args?.create)]
    .filter((t): t is string => !!t))];
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // Eventos de consulta tambem em producao: alimentam "consultas lentas" do console.
      log: process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'event', level: 'query' }, { emit: 'stdout', level: 'error' }],
      // Datasource configuration for connection pooling
      datasourceUrl: process.env.DATABASE_URL,
    });

    // ── Soft delete GLOBAL (middleware) ──────────────────────────────────────
    // Para os models do allowlist: delete/deleteMany viram soft (deletedAt) e
    // find*/count ganham deletedAt:null automaticamente. Respeita filtros de
    // deletedAt ja presentes (ex.: restore). findUnique fica intacto (lookups por
    // id/unique internos). EntityData/ArchivedEntityData FORA (archive + cascata proprios).
    // Notification fica FORA: e transiente (sino/avisos); delete fisico e o correto
    // (o cleanup cron deve remover de verdade, nao acumular soft rows).
    const SOFT_DELETE_MODELS = new Set([
      'Tenant', 'User', 'Entity', 'CustomRole', 'UserTenantAccess',
      'PdfTemplate', 'Webhook', 'EmailTemplate', 'ActionChain', 'ScheduledTask',
      'EntityAutomation', 'EntityFieldRule', 'DashboardTemplate', 'PublicLink',
    ]);
    const READ_OPS = new Set(['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
    // Gravacao de registro: o cache das estatisticas da empresa deixa de valer
    const STATS_MODELS = new Set(['EntityData', 'ArchivedEntityData']);
    const WRITE_OPS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

    this.$use(async (params, next) => {
      const model = params.model;
      if (model && SOFT_DELETE_MODELS.has(model)) {
        if (params.action === 'delete') {
          params.action = 'update';
          params.args = { ...(params.args || {}), data: { deletedAt: new Date() } };
        } else if (params.action === 'deleteMany') {
          params.action = 'updateMany';
          params.args = params.args || {};
          params.args.data = { ...(params.args.data || {}), deletedAt: new Date() };
        } else if (READ_OPS.has(params.action)) {
          params.args = params.args || {};
          params.args.where = params.args.where || {};
          if (params.args.where.deletedAt === undefined) {
            params.args.where.deletedAt = null;
          }
        }
      }
      if (model && STATS_MODELS.has(model) && WRITE_OPS.has(params.action)) {
        // So o cache das empresas atingidas: pelo pedido, pelo registro gravado ou, em lote
        // sem empresa no pedido, consultando antes (depois de apagar nao da mais).
        const args = params.args as WriteArgs;
        let tenants = tenantsOfArgs(args);
        const isBatch = params.action === 'updateMany' || params.action === 'deleteMany';
        const selectHidesTenant = !!args?.select && !args.select.tenantId;
        if (tenants.length === 0 && (isBatch || (selectHidesTenant && params.action !== 'create'))) {
          tenants = await this.tenantsOfRecords(model, args?.where);
        }
        const result = await next(params);
        if (tenants.length === 0) {
          const own = tenantIdOf(result);
          if (own) tenants = [own];
        }
        if (tenants.length > 0) tenants.forEach((t) => bumpStatsTenant(t));
        else if (!isBatch) bumpStatsTenant(null); // nao deu para saber: descarta tudo
        return result;
      }
      return next(params);
    });

    // Consultas lentas: log no dev (>100ms) e registro para o console (>= SLOW_QUERY_MS).
    const slowMs = Number(process.env.SLOW_QUERY_MS || 500);
    const isDev = process.env.NODE_ENV === 'development';
    // @ts-expect-error - Prisma event typing
    this.$on('query', (e: Prisma.QueryEvent) => {
      if (isDev && e.duration > 100) this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
      if (e.duration >= slowMs) OpsMonitorService.current?.recordSlowQuery(e.duration, e.query);
    });
  }

  /** Empresas dos registros que um filtro atinge (para descartar so o cache delas). */
  private async tenantsOfRecords(model: string, where: unknown): Promise<string[]> {
    type GroupByTenant = { groupBy: (a: { by: ['tenantId']; where: unknown }) => Promise<Array<{ tenantId: string }>> };
    const delegate = (model === 'EntityData' ? this.entityData : this.archivedEntityData) as unknown as GroupByTenant;
    const rows = await delegate.groupBy({ by: ['tenantId'], where: where ?? {} });
    return rows.map((r) => r.tenantId);
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conectado ao PostgreSQL');
    } catch (error) {
      this.logger.error('Falha ao conectar ao PostgreSQL', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Desconectado do PostgreSQL');
  }

  // Helper para limpar banco em testes
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase só pode ser usado em ambiente de teste');
    }

    const tablenames = await this.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
      }
    }
  }
}
