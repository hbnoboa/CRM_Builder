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

// ─── Regra unica dos numeros (fase 2): a mesma do navegador (aggregation-engine) ───

/** Texto de um valor (toStr do navegador): vazio -> '', objeto -> label/name/value, lista -> "a, b". */
export function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.map((v) => toStr(v)).join(', ');
    const obj = val as Record<string, unknown>;
    if ('label' in obj) return String(obj.label);
    if ('name' in obj) return String(obj.name);
    if ('value' in obj) return String(obj.value);
    return JSON.stringify(val);
  }
  return String(val);
}

export function toNum(val: unknown): number {
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val));
  return isNaN(n) ? NaN : n;
}

export function isValidNum(val: unknown): boolean {
  const n = toNum(val);
  return !isNaN(n) && isFinite(n);
}

/** Inicio do periodo atual (meia-noite local de hoje - dias + 1) e do anterior. */
export function periodBounds(days: number) {
  const now = new Date();
  const currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const previousStart = new Date(currentStart.getTime() - days * 86400000);
  return { now, currentStart, previousStart };
}

export function comparison(current: number, previous: number) {
  const changeAbsolute = current - previous;
  const changePercent = previous !== 0 ? (changeAbsolute / Math.abs(previous)) * 100 : current !== 0 ? 100 : 0;
  return { current, previous, changePercent, changeAbsolute };
}

/** Dia local (fuso do servidor) no formato AAAA-MM-DD. */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fuso do servidor, para o banco agrupar pelo mesmo dia local. */
export function serverTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Dias do periodo (do inicio local ate hoje), na ordem. */
export function dayKeys(days: number): { start: Date; keys: string[] } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const keys: string[] = [];
  for (let i = 0; i < days; i++) keys.push(localDayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  return { start, keys };
}

/** Ordem dos "top registros": vazios no fim, data ISO, numero, texto pt-BR. */
export function compareTopValues(aRaw: unknown, bRaw: unknown, desc: boolean): number {
  const mult = desc ? -1 : 1;
  const a = toStr(aRaw);
  const b = toStr(bRaw);
  if (!a || !b) return Number(!a) - Number(!b);
  const iso = /^\d{4}-\d{2}-\d{2}/;
  if (iso.test(a) && iso.test(b)) return (Date.parse(a) - Date.parse(b)) * mult;
  const an = Number(a);
  const bn = Number(b);
  if (!isNaN(an) && !isNaN(bn)) return (an - bn) * mult;
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }) * mult;
}

/** Ordem das linhas agrupadas: numero se os dois forem numeros, senao texto. */
export function compareGroupValues(a: unknown, b: unknown, asc: boolean): number {
  const mult = asc ? 1 : -1;
  if (isValidNum(a) && isValidNum(b)) return (toNum(a) - toNum(b)) * mult;
  return toStr(a).localeCompare(toStr(b)) * mult;
}

type FieldDef = { slug: string; type?: string; options?: Array<string | { value: unknown; label?: string; color?: string }> };

/** Rotulo e cor de um valor pelas opcoes do campo (e Sim/Nao para booleano). */
export function optionMeta(field: FieldDef | undefined, value: string): { label: string; color?: string } {
  if (field?.type === 'boolean') {
    if (value === 'true') return { label: 'Sim', color: '#2563eb' };
    if (value === 'false') return { label: 'Não', color: '#94a3b8' };
  }
  for (const o of field?.options ?? []) {
    if (typeof o === 'string') { if (o === value) return { label: o }; continue; }
    if (String(o.value) === value) return { label: o.label || value, ...(o.color ? { color: o.color } : {}) };
  }
  return { label: value };
}

/** Filtro "campo = valor" das contagens distintas: sem diferenciar maiusculas, Sim/Nao como true/false. */
export function acceptedFilterValues(target: string): string[] {
  const t = target.toLowerCase();
  if (t === 'true' || t === 'sim') return ['true', 'sim'];
  if (t === 'false' || t === 'nao' || t === 'não') return ['false', 'nao', 'não'];
  return [t];
}
