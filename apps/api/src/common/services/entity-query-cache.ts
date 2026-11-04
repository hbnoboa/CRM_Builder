import type { Entity } from '@prisma/client';

/**
 * Cache curto (5 s) da tabela usado pelo EntityDataQueryService. Fica num modulo
 * proprio para o EntityService poder invalidar sem import circular.
 */
export const ENTITY_QUERY_CACHE_TTL = 5000;
export const entityQueryCache = new Map<string, { entity: Entity; timestamp: number }>();

/** Esquece a tabela no cache (salvou campos/filtro global: vale ja na proxima lista). */
export function invalidateEntityQueryCache(entitySlug: string): void {
  for (const key of entityQueryCache.keys()) {
    if (key.startsWith(`${entitySlug}:`)) entityQueryCache.delete(key);
  }
}
