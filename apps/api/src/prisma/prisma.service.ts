import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
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
      return next(params);
    });

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      // @ts-expect-error - Prisma event typing
      this.$on('query', (e: Prisma.QueryEvent) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
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
