import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Estatisticas calculadas no banco (fase 1 do plano de desempenho dos paineis).
 *
 * Quem entra na conta continua sendo decidido pelo EntityDataQueryService.buildWhere
 * (empresa, escopo, cargo, filtros do painel). Este modulo so transforma esse recorte
 * numa consulta SQL que devolve o resultado pronto (contagem, agrupamento, soma) em vez
 * de carregar todos os registros na memoria da API.
 *
 * STATS_SQL: on (padrao) | shadow (calcula dos dois jeitos, registra diferencas e
 * devolve o antigo) | off (so o antigo, em JavaScript).
 */
export type StatsMode = 'off' | 'shadow' | 'on';

export function statsMode(): StatsMode {
  const v = (process.env.STATS_SQL || 'on').toLowerCase();
  return v === 'off' || v === 'shadow' ? v : 'on';
}

/** Tempo maximo de cada consulta de estatistica (ms). */
export const STATS_TIMEOUT_MS = Number(process.env.STATS_TIMEOUT_MS) || 10_000;

type DateBound = Date | string;
const SIMPLE_KEYS = new Set(['entityId', 'tenantId', 'deletedAt', 'createdAt', 'AND']);
const DATE_OPS: Record<string, Prisma.Sql> = { gte: Prisma.sql`>=`, gt: Prisma.sql`>`, lte: Prisma.sql`<=`, lt: Prisma.sql`<` };

/**
 * Recorte so por empresa + tabela + nao excluido (+ periodo de criacao)? E o caso de
 * quem tem acesso total sem filtro: da para consultar o banco direto, sem listar ids.
 */
function simpleScope(where: Prisma.EntityDataWhereInput): boolean {
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (!SIMPLE_KEYS.has(key)) return false;
    if (key === 'AND' && !(Array.isArray(value) && value.length === 0)) return false;
    if (key === 'deletedAt' && value !== null) return false;
    if (key === 'createdAt') {
      if (!value || typeof value !== 'object' || value instanceof Date) return false;
      if (Object.keys(value).some((op) => !(op in DATE_OPS))) return false;
    }
  }
  return typeof where.tenantId === 'string' && typeof where.entityId === 'string' && where.deletedAt === null;
}

function createdAtSql(where: Prisma.EntityDataWhereInput, column: Prisma.Sql): Prisma.Sql {
  const range = where.createdAt as Record<string, DateBound> | undefined;
  if (!range) return Prisma.empty;
  const parts = Object.entries(range)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([op, v]) => Prisma.sql`AND ${column} ${DATE_OPS[op]} ${new Date(v)}`);
  return parts.length ? Prisma.join(parts, ' ') : Prisma.empty;
}

const COLUMNS = Prisma.sql`id, data, "createdAt", "updatedAt", "parentRecordId"`;

/**
 * Corpo SQL (para um CTE) com os registros do recorte, ativos + arquivados, com as
 * colunas id, data, createdAt, updatedAt, parentRecordId. Empresa e tabela sempre
 * repetidas na consulta como defesa extra.
 */
export async function scopeSql(
  prisma: PrismaService,
  where: Prisma.EntityDataWhereInput,
  archivedWhere: Prisma.ArchivedEntityDataWhereInput,
): Promise<Prisma.Sql> {
  const tenantId = where.tenantId as string;
  const entityId = where.entityId as string;
  if (typeof tenantId !== 'string' || typeof entityId !== 'string') {
    throw new Error('stats-sql: recorte sem empresa ou tabela');
  }
  if (simpleScope(where)) {
    return Prisma.sql`
      SELECT ${COLUMNS} FROM "EntityData"
       WHERE "tenantId" = ${tenantId} AND "entityId" = ${entityId} AND "deletedAt" IS NULL ${createdAtSql(where, Prisma.sql`"createdAt"`)}
      UNION ALL
      SELECT ${COLUMNS} FROM "ArchivedEntityData"
       WHERE "tenantId" = ${tenantId} AND "entityId" = ${entityId} ${createdAtSql(where, Prisma.sql`"createdAt"`)}`;
  }
  // Recorte com escopo, cargo ou filtros: o Prisma (buildWhere) escolhe os ids e o banco
  // faz a conta so sobre eles.
  const [active, archived] = await Promise.all([
    prisma.entityData.findMany({ where, select: { id: true } }),
    prisma.archivedEntityData.findMany({ where: archivedWhere, select: { id: true } }),
  ]);
  const activeIds = active.map((r) => r.id);
  const archivedIds = archived.map((r) => r.id);
  return Prisma.sql`
    SELECT ${COLUMNS} FROM "EntityData"
     WHERE "tenantId" = ${tenantId} AND "entityId" = ${entityId} AND id = ANY(${activeIds}::text[])
    UNION ALL
    SELECT ${COLUMNS} FROM "ArchivedEntityData"
     WHERE "tenantId" = ${tenantId} AND "entityId" = ${entityId} AND id = ANY(${archivedIds}::text[])`;
}

/** Registros-pai (ativos + arquivados) da mesma empresa, para campos "parent.x". */
export function parentsSql(tenantId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT id, data FROM "EntityData" WHERE "tenantId" = ${tenantId}
    UNION ALL
    SELECT id, data FROM "ArchivedEntityData" WHERE "tenantId" = ${tenantId}`;
}

/**
 * Valor JSON de um campo. `parent.x` le do registro-pai (alias p) quando `resolveParent`;
 * sem isso, "parent.x" e so uma chave que nao existe no registro (como no codigo antigo).
 */
export function fieldSql(fieldSlug: string, resolveParent = false): Prisma.Sql {
  if (resolveParent && fieldSlug.startsWith('parent.')) return Prisma.sql`(p.data -> ${fieldSlug.slice(7)}::text)`;
  return Prisma.sql`(r.data -> ${fieldSlug}::text)`;
}

/** Chave composta "a||b" de varios campos (normalizeFieldValue de cada um). */
export function compositeKeySql(fieldSlugs: string[]): Prisma.Sql {
  if (fieldSlugs.length === 0) return Prisma.sql`''`;
  return Prisma.sql`concat_ws('||', ${Prisma.join(fieldSlugs.map((f) => Prisma.sql`stats_key(${fieldSql(f)})`), ', ')})`;
}

/** Executa a consulta com tempo maximo (statement_timeout so desta transacao). */
export async function runStats<T>(prisma: PrismaService, query: Prisma.Sql): Promise<T[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(STATS_TIMEOUT_MS)}, true)`;
    return tx.$queryRaw<T[]>(query);
  }, { timeout: STATS_TIMEOUT_MS + 5_000, maxWait: 15_000 });
}

/** Forma canonica para comparar o resultado antigo e o novo (modo sombra). */
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical).map((v) => JSON.stringify(v)).sort();
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort()
      .map((k) => [k, canonical((value as Record<string, unknown>)[k])]));
  }
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : value;
  return value;
}

export function sameStats(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
