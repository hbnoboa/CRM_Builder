import Redis from 'ioredis';
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Conectado ao Redis');
    });

    this.client.on('error', (err) => {
      this.logger.error(`❌ Erro no Redis: ${err.message}`);
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('⚠️ Reconectando ao Redis...');
    });
  }

  /**
   * Buscar valor do cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao buscar chave ${key}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Salvar valor no cache com TTL opcional
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao salvar chave ${key}: ${errorMessage}`);
    }
  }

  /**
   * Deletar chave específica
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao deletar chave ${key}: ${errorMessage}`);
    }
  }

  /**
   * Deletar todas as chaves que correspondem ao pattern
   * Ex: delPattern('permissions:tenant-123:*')
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client.del(...keys);
      this.logger.log(`🗑️ Deletadas ${keys.length} chaves com pattern: ${pattern}`);
      return keys.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao deletar pattern ${pattern}: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Verificar se chave existe
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Incrementar valor (útil para rate limiting)
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao incrementar chave ${key}: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Definir TTL em chave existente
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obter TTL restante de uma chave
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      return -1;
    }
  }

  /**
   * Limpar TODAS as chaves do Redis (CUIDADO!)
   * Apenas para testes/desenvolvimento
   */
  async flushAll(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error('❌ flushAll() bloqueado em produção!');
      return;
    }

    try {
      await this.client.flushall();
      this.logger.warn('⚠️ Redis completamente limpo (flushall)');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao limpar Redis: ${errorMessage}`);
    }
  }

  /**
   * Fechar conexão ao destruir módulo
   */
  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('🔌 Desconectado do Redis');
  }
}
