import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { monitorEventLoopDelay } from 'perf_hooks';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { OpsMonitorService } from '../../common/services/ops-monitor.service';
import { currentServiceScope } from '../../common/service-scope/service-scope.constants';
import { UploadService } from '../upload/upload.service';

export type HealthStatus = 'ok' | 'warning' | 'down' | 'off';
const DAY = 86_400_000;

// Atraso da fila de eventos do Node (amostrado continuamente).
const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();

const worst = (list: HealthStatus[]): HealthStatus =>
  list.includes('down') ? 'down' : list.includes('warning') ? 'warning' : 'ok';

/** Limite por verificacao: com o Redis fora, o cliente enfileira comandos e nunca responde. */
const CHECK_TIMEOUT_MS = 3000;
function withTimeout<T>(p: Promise<T>, ms = CHECK_TIMEOUT_MS): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`sem resposta em ${ms / 1000}s`)), ms))]);
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: string }> {
  const start = performance.now();
  try {
    const value = await withTimeout(fn());
    return { ms: Math.round(performance.now() - start), value };
  } catch (e) {
    return { ms: Math.round(performance.now() - start), error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * "Saude do sistema" do console: banco, Redis, filas, PowerSync, e-mail, push,
 * armazenamento, a propria API e os problemas recentes (erros 500, consultas
 * lentas, falhas de automacao/webhook). So leitura; cada verificacao tem limite
 * de tempo e falha isolada (um componente fora nao derruba a tela).
 */
@Injectable()
export class SystemHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ops: OpsMonitorService,
    private readonly config: ConfigService,
    private readonly upload: UploadService,
    @InjectQueue('data-import') private readonly importQueue: Queue,
    @InjectQueue('automation-execution') private readonly automationQueue: Queue,
  ) {}

  async snapshot() {
    const [database, redis, queues, powersync, problems] = await Promise.all([
      this.database(), this.redisCheck(), this.queues(), this.powersync(), this.problems(),
    ]);
    const email = this.email();
    const push = this.push();
    const storage = this.storage();
    const app = this.app();
    const components = { database, redis, queues, powersync, email, push, storage };
    return {
      checkedAt: new Date(),
      status: worst([...Object.values(components).map((c) => c.status), app.status, problems.status]),
      app,
      components,
      problems,
    };
  }

  private async database() {
    const ping = await timed(() => this.prisma.$queryRaw`SELECT 1`);
    if (ping.error) return { status: 'down' as HealthStatus, latencyMs: ping.ms, error: ping.error };
    const [info] = await this.prisma.$queryRaw<Array<{ size: bigint; connections: bigint; longest: number | null }>>`
      SELECT pg_database_size(current_database()) AS size,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS connections,
        (SELECT EXTRACT(EPOCH FROM max(now() - query_start)) FROM pg_stat_activity
          WHERE datname = current_database() AND state = 'active' AND pid <> pg_backend_pid()) AS longest`;
    const [mig] = await this.prisma.$queryRaw<Array<{ applied: bigint; failed: bigint; last: string | null; lastAt: Date | null }>>`
      SELECT count(*) FILTER (WHERE finished_at IS NOT NULL) AS applied,
        count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS failed,
        (SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1) AS last,
        max(finished_at) AS "lastAt"
      FROM _prisma_migrations`;
    const backlog = await this.prisma.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM "visibility_recompute"`;
    const longest = info.longest == null ? null : Math.round(Number(info.longest));
    const failedMigrations = Number(mig.failed);
    const status: HealthStatus = failedMigrations > 0 ? 'down'
      : ping.ms > 500 || (longest ?? 0) > 60 ? 'warning' : 'ok';
    return {
      status,
      latencyMs: ping.ms,
      sizeMb: Math.round(Number(info.size) / 1024 / 1024),
      connections: Number(info.connections),
      longestQuerySec: longest,
      migrations: { applied: Number(mig.applied), failed: failedMigrations, last: mig.last, lastAt: mig.lastAt },
      visibilityBacklog: Number(backlog[0]?.n ?? 0),
    };
  }

  private async redisCheck() {
    const ping = await timed(() => this.redis.client.ping());
    if (ping.error) return { status: 'down' as HealthStatus, latencyMs: ping.ms, error: ping.error };
    const info = await withTimeout(this.redis.client.info('memory')).catch(() => '');
    const used = /used_memory_human:(\S+)/.exec(info)?.[1] ?? null;
    return { status: (ping.ms > 200 ? 'warning' : 'ok') as HealthStatus, latencyMs: ping.ms, memory: used };
  }

  private async queues() {
    const read = async (name: string, q: Queue) => {
      const r = await timed(() => q.getJobCounts());
      if (r.error || !r.value) return { name, status: 'down' as HealthStatus, error: r.error ?? 'sem resposta' };
      const c = r.value;
      const status: HealthStatus = c.failed > 0 || c.waiting > 500 ? 'warning' : 'ok';
      return { name, status, waiting: c.waiting, active: c.active, delayed: c.delayed, failed: c.failed };
    };
    const list = await Promise.all([read('data-import', this.importQueue), read('automation-execution', this.automationQueue)]);
    return { status: worst(list.map((q) => q.status)), list };
  }

  private async powersync() {
    const url = this.config.get<string>('POWERSYNC_URL');
    if (!url) return { status: 'off' as HealthStatus, url: null };
    const r = await timed(async () => {
      const res = await fetch(`${url.replace(/\/$/, '')}/probes/liveness`, { signal: AbortSignal.timeout(3000) });
      return res.status;
    });
    const up = !r.error && r.value !== undefined && r.value < 500;
    return { status: (up ? 'ok' : 'down') as HealthStatus, url, latencyMs: r.ms, httpStatus: r.value ?? null, error: r.error };
  }

  private email() {
    const provider = (this.config.get<string>('EMAIL_PROVIDER') || 'console').toLowerCase();
    const configured = provider !== 'console' && !!this.config.get<string>('SMTP_HOST');
    // Sem provedor real, convites e "esqueci a senha" nao chegam: atencao.
    return { status: (configured ? 'ok' : 'warning') as HealthStatus, provider, from: this.config.get<string>('EMAIL_FROM') ?? null };
  }

  private push() {
    const configured = !!this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_KEY');
    return { status: (configured ? 'ok' : 'off') as HealthStatus, configured };
  }

  private storage() {
    const s = this.upload.storageMode;
    // Arquivo local em producao some ao recriar o container.
    const status: HealthStatus = s.mode === 'gcs' || process.env.NODE_ENV !== 'production' ? 'ok' : 'warning';
    return { status, ...s };
  }

  private app() {
    const mem = process.memoryUsage();
    const lagP99 = Math.round(loopDelay.percentile(99) / 1e6);
    loopDelay.reset();
    return {
      status: (lagP99 > 500 ? 'warning' : 'ok') as HealthStatus,
      version: process.env.APP_VERSION || process.env.GIT_COMMIT || null,
      environment: process.env.NODE_ENV ?? 'development',
      scope: currentServiceScope(),
      node: process.version,
      uptimeSec: Math.round(process.uptime()),
      memoryMb: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
      eventLoopLagP99Ms: lagP99,
    };
  }

  private async problems() {
    const since = new Date(Date.now() - DAY);
    const [errors, errorsByHour, slowQueries, automationFailed, webhookFailed] = await Promise.all([
      withTimeout(this.ops.recentErrors(30)).catch(() => []),
      withTimeout(this.ops.errorsLast24h()).catch(() => []),
      withTimeout(this.ops.recentSlowQueries(20)).catch(() => []),
      this.prisma.automationExecution.count({ where: { status: 'failed', startedAt: { gte: since } } }),
      this.prisma.webhookExecution.count({ where: { status: { in: ['error', 'timeout'] }, createdAt: { gte: since } } }),
    ]);
    const errors24h = errorsByHour.reduce((a, b) => a + b.count, 0);
    const status: HealthStatus = errors24h > 50 ? 'down' : errors24h > 0 || automationFailed > 0 || webhookFailed > 0 ? 'warning' : 'ok';
    return { status, errors24h, errorsByHour, errors, slowQueries, automationFailed24h: automationFailed, webhookFailed24h: webhookFailed };
  }
}
