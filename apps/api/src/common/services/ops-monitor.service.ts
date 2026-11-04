import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface OpsErrorEntry { at: string; status: number; method: string; path: string; message: string }
export interface OpsSlowQuery { at: string; ms: number; query: string }

const ERRORS_KEY = 'ops:errors';
const SLOW_KEY = 'ops:slow-queries';
const HOUR_KEY = (d: Date) => `ops:errors:h:${d.toISOString().slice(0, 13)}`;

/**
 * Guarda no Redis (compartilhado entre instancias) os ultimos erros 500 e as
 * consultas lentas, para a tela "Saude do sistema" do console. Nunca derruba a
 * requisicao: falha do Redis aqui e ignorada.
 */
@Injectable()
export class OpsMonitorService {
  /** O filtro de erros e o PrismaService nascem fora da injecao: usam isto. */
  static current: OpsMonitorService | undefined;
  private readonly logger = new Logger(OpsMonitorService.name);

  constructor(private readonly redis: RedisService) {
    OpsMonitorService.current = this;
  }

  private safe(fn: () => Promise<unknown>) {
    // Redis fora: nao enfileira (o cliente guardaria tudo na memoria ate voltar).
    if (this.redis.client.status !== 'ready') return;
    fn().catch((e) => this.logger.debug(`ops monitor: ${e instanceof Error ? e.message : e}`));
  }

  recordError(entry: Omit<OpsErrorEntry, 'at'>) {
    const now = new Date();
    const item: OpsErrorEntry = { at: now.toISOString(), ...entry, path: entry.path.split('?')[0].slice(0, 200), message: entry.message.slice(0, 300) };
    this.safe(async () => {
      const multi = this.redis.client.multi();
      multi.lpush(ERRORS_KEY, JSON.stringify(item));
      multi.ltrim(ERRORS_KEY, 0, 99);
      multi.incr(HOUR_KEY(now));
      multi.expire(HOUR_KEY(now), 26 * 3600);
      await multi.exec();
    });
  }

  recordSlowQuery(ms: number, query: string) {
    const item: OpsSlowQuery = { at: new Date().toISOString(), ms: Math.round(ms), query: query.replace(/\s+/g, ' ').slice(0, 400) };
    this.safe(async () => {
      await this.redis.client.multi().lpush(SLOW_KEY, JSON.stringify(item)).ltrim(SLOW_KEY, 0, 49).exec();
    });
  }

  async recentErrors(limit = 30): Promise<OpsErrorEntry[]> {
    const rows = await this.redis.client.lrange(ERRORS_KEY, 0, limit - 1);
    return rows.map((r) => JSON.parse(r) as OpsErrorEntry);
  }

  async recentSlowQueries(limit = 20): Promise<OpsSlowQuery[]> {
    const rows = await this.redis.client.lrange(SLOW_KEY, 0, limit - 1);
    return rows.map((r) => JSON.parse(r) as OpsSlowQuery);
  }

  /** Erros 500 por hora nas ultimas 24h (mais antiga primeiro). */
  async errorsLast24h(): Promise<Array<{ hour: string; count: number }>> {
    const hours = Array.from({ length: 24 }, (_, i) => new Date(Date.now() - (23 - i) * 3600_000));
    const counts = await this.redis.client.mget(hours.map(HOUR_KEY));
    return hours.map((h, i) => ({ hour: h.toISOString().slice(0, 13), count: Number(counts[i] ?? 0) }));
  }
}

@Global()
@Module({ providers: [OpsMonitorService], exports: [OpsMonitorService] })
export class OpsMonitorModule {}
