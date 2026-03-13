import type { DataRecord, EntityField } from './unified-filter-types';

// ─── Tipos de retorno ────────────────────────────────────────────────

export interface FieldDistributionItem {
  value: string;
  label: string;
  count: number;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface FieldTrendPoint {
  date: string;
  value: number;
}

export interface FieldAggregation {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export interface PeriodComparison {
  current: number;
  previous: number;
  changePercent: number;
  changeAbsolute: number;
}

export interface EntityRecordCount {
  total: number;
  active: number;
  archived: number;
  periodComparison?: PeriodComparison;
}

export interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  percentage: number;
}

export interface CrossFieldDistribution {
  rows: Array<{ value: string; label: string }>;
  columns: Array<{ value: string; label: string }>;
  matrix: Record<string, Record<string, number>>;
  maxValue: number;
}

export interface FieldRatioResult {
  numerator: number;
  denominator: number;
  ratio: number;
  percentage: number;
}

export interface RecentActivityItem {
  id: string;
  action: 'created' | 'updated';
  timestamp: string;
  userName?: string;
  data: Record<string, unknown>;
}

export interface AggregationDef {
  type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinctCount' | 'mode' | 'first';
  fieldSlug?: string;
  alias: string;
  distinctFields?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getFieldValue(record: DataRecord, fieldSlug: string): unknown {
  if (fieldSlug === 'createdAt') return record.createdAt;
  if (fieldSlug === 'updatedAt') return record.updatedAt;
  if (fieldSlug === 'id') return record.id;
  return record.data?.[fieldSlug];
}

function toNum(val: unknown): number {
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val));
  return isNaN(n) ? NaN : n;
}

function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.map(v => toStr(v)).join(', ');
    const obj = val as Record<string, unknown>;
    if ('label' in obj) return String(obj.label);
    if ('name' in obj) return String(obj.name);
    if ('value' in obj) return String(obj.value);
    return JSON.stringify(val);
  }
  return String(val);
}

function getLabel(value: string, field?: EntityField): string {
  if (!field?.options) return value;
  const opt = field.options.find(o => o.value === value);
  return opt?.label ?? value;
}

function toDateKey(dateStr: string): string {
  return dateStr.substring(0, 10);
}

function isValidNum(val: unknown): val is number {
  const n = toNum(val);
  return !isNaN(n) && isFinite(n);
}

function computeComparison(current: number, previous: number): PeriodComparison {
  const changeAbsolute = current - previous;
  const changePercent = previous !== 0
    ? (changeAbsolute / Math.abs(previous)) * 100
    : current !== 0 ? 100 : 0;
  return { current, previous, changePercent, changeAbsolute };
}

function splitByPeriod(
  records: DataRecord[],
  days: number,
): { current: DataRecord[]; previous: DataRecord[] } {
  const now = new Date();
  const currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const previousStart = new Date(currentStart.getTime() - days * 86400000);

  const currentStartStr = currentStart.toISOString();
  const previousStartStr = previousStart.toISOString();
  const currentEndStr = now.toISOString();

  const current: DataRecord[] = [];
  const previous: DataRecord[] = [];

  for (const r of records) {
    const d = r.createdAt;
    if (d >= currentStartStr && d <= currentEndStr) current.push(r);
    else if (d >= previousStartStr && d < currentStartStr) previous.push(r);
  }

  return { current, previous };
}

// ─── Contagem básica ─────────────────────────────────────────────────

export function countRecords(
  records: DataRecord[],
  options?: { comparePeriod?: boolean; days?: number },
): EntityRecordCount {
  const total = records.length;
  const result: EntityRecordCount = { total, active: total, archived: 0 };

  if (options?.comparePeriod) {
    const days = options.days ?? 30;
    const { current, previous } = splitByPeriod(records, days);
    result.periodComparison = computeComparison(current.length, previous.length);
  }

  return result;
}

// ─── Agregações de campo numérico ────────────────────────────────────

export function aggregateField(
  records: DataRecord[],
  fieldSlug: string,
  options?: { comparePeriod?: boolean; days?: number },
): FieldAggregation & { periodComparison?: PeriodComparison } {
  const values: number[] = [];
  for (const r of records) {
    const v = toNum(getFieldValue(r, fieldSlug));
    if (!isNaN(v) && isFinite(v)) values.push(v);
  }

  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = count > 0 ? sum / count : 0;
  const min = count > 0 ? Math.min(...values) : 0;
  const max = count > 0 ? Math.max(...values) : 0;

  const result: FieldAggregation & { periodComparison?: PeriodComparison } = {
    count, sum, avg, min, max,
  };

  if (options?.comparePeriod) {
    const days = options.days ?? 30;
    const { current, previous } = splitByPeriod(records, days);
    const currentSum = current.reduce((acc, r) => {
      const v = toNum(getFieldValue(r, fieldSlug));
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    const previousSum = previous.reduce((acc, r) => {
      const v = toNum(getFieldValue(r, fieldSlug));
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    result.periodComparison = computeComparison(currentSum, previousSum);
  }

  return result;
}

export function sumField(records: DataRecord[], fieldSlug: string): number {
  return aggregateField(records, fieldSlug).sum;
}

export function avgField(records: DataRecord[], fieldSlug: string): number {
  return aggregateField(records, fieldSlug).avg;
}

export function minField(records: DataRecord[], fieldSlug: string): number {
  return aggregateField(records, fieldSlug).min;
}

export function maxField(records: DataRecord[], fieldSlug: string): number {
  return aggregateField(records, fieldSlug).max;
}

// ─── Contagem distinta ──────────────────────────────────────────────

export function distinctCount(
  records: DataRecord[],
  fields: string[],
  options?: {
    comparePeriod?: boolean;
    days?: number;
    filterField?: string;
    filterValue?: string;
  },
): EntityRecordCount & { totalDistinct?: number; filteredDistinct?: number } {
  const getCompositeKey = (r: DataRecord) =>
    fields.map(f => toStr(getFieldValue(r, f))).join('||');

  const allKeys = new Set(records.map(getCompositeKey));
  const totalDistinct = allKeys.size;

  let filteredDistinct: number | undefined;
  if (options?.filterField && options.filterValue !== undefined) {
    const filtered = records.filter(r =>
      toStr(getFieldValue(r, options.filterField!)).toLowerCase() ===
      options.filterValue!.toLowerCase()
    );
    filteredDistinct = new Set(filtered.map(getCompositeKey)).size;
  }

  const result: EntityRecordCount & { totalDistinct?: number; filteredDistinct?: number } = {
    total: totalDistinct,
    active: totalDistinct,
    archived: 0,
    totalDistinct,
    filteredDistinct,
  };

  if (options?.comparePeriod) {
    const days = options.days ?? 30;
    const { current, previous } = splitByPeriod(records, days);
    const currentDistinct = new Set(current.map(getCompositeKey)).size;
    const previousDistinct = new Set(previous.map(getCompositeKey)).size;
    result.periodComparison = computeComparison(currentDistinct, previousDistinct);
  }

  return result;
}

// ─── Distribuição por campo (pie, bar, donut, stat-list, slicer) ────

export function groupByField(
  records: DataRecord[],
  fieldSlug: string,
  field?: EntityField,
  limit?: number,
): FieldDistributionItem[] {
  const counts = new Map<string, number>();

  for (const r of records) {
    const raw = getFieldValue(r, fieldSlug);
    if (raw === null || raw === undefined || raw === '') continue;

    // Multiselect: cada valor conta separadamente
    if (Array.isArray(raw)) {
      for (const item of raw) {
        const key = toStr(item);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    } else {
      const key = toStr(raw);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  let items: FieldDistributionItem[] = Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      label: getLabel(value, field),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  if (limit && limit > 0 && items.length > limit) {
    const top = items.slice(0, limit);
    const othersCount = items.slice(limit).reduce((acc, i) => acc + i.count, 0);
    if (othersCount > 0) {
      top.push({ value: '__others__', label: 'Outros', count: othersCount });
    }
    items = top;
  }

  return items;
}

// ─── Agrupamento por data (line, area) ──────────────────────────────

export type DateGranularity = 'day' | 'week' | 'month';

export function groupByDate(
  records: DataRecord[],
  days?: number,
  granularity: DateGranularity = 'day',
): TimeSeriesPoint[] {
  const now = new Date();
  const effectiveDays = days ?? 30;
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - effectiveDays + 1);

  const counts = new Map<string, number>();

  // Gerar todas as chaves no período
  for (let i = 0; i < effectiveDays; i++) {
    const d = new Date(startDate.getTime() + i * 86400000);
    const key = getDateGroupKey(d, granularity);
    if (!counts.has(key)) counts.set(key, 0);
  }

  for (const r of records) {
    if (!r.createdAt) continue;
    const d = new Date(r.createdAt);
    if (d < startDate) continue;
    const key = getDateGroupKey(d, granularity);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function getDateGroupKey(d: Date, granularity: DateGranularity): string {
  switch (granularity) {
    case 'day':
      return d.toISOString().substring(0, 10);
    case 'week': {
      // ISO week: segunda-feira da semana
      const day = d.getDay();
      const monday = new Date(d.getTime() - ((day === 0 ? 6 : day - 1)) * 86400000);
      return monday.toISOString().substring(0, 10);
    }
    case 'month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    default:
      return d.toISOString().substring(0, 10);
  }
}

// ─── Trend de campo numérico ao longo do tempo ──────────────────────

export function fieldTrend(
  records: DataRecord[],
  fieldSlug: string,
  aggregation: 'sum' | 'avg' | 'min' | 'max' = 'sum',
  days?: number,
): FieldTrendPoint[] {
  const now = new Date();
  const effectiveDays = days ?? 30;
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - effectiveDays + 1);

  const groups = new Map<string, number[]>();

  for (let i = 0; i < effectiveDays; i++) {
    const d = new Date(startDate.getTime() + i * 86400000);
    groups.set(d.toISOString().substring(0, 10), []);
  }

  for (const r of records) {
    if (!r.createdAt) continue;
    const d = new Date(r.createdAt);
    if (d < startDate) continue;
    const key = toDateKey(r.createdAt);
    const v = toNum(getFieldValue(r, fieldSlug));
    if (!isNaN(v)) {
      const arr = groups.get(key);
      if (arr) arr.push(v);
      else groups.set(key, [v]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      value: aggregateValues(values, aggregation),
    }));
}

function aggregateValues(values: number[], agg: 'sum' | 'avg' | 'min' | 'max' | 'count'): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'count': return values.length;
  }
}

// ─── Cross-field distribution (heatmap, scatter, stacked/grouped bar)─

export function crossGroup(
  records: DataRecord[],
  rowField: string,
  colField: string,
  rowFieldMeta?: EntityField,
  colFieldMeta?: EntityField,
  limit?: number,
): CrossFieldDistribution {
  const matrix: Record<string, Record<string, number>> = {};
  const rowCounts = new Map<string, number>();
  const colCounts = new Map<string, number>();

  for (const r of records) {
    const rowVal = toStr(getFieldValue(r, rowField));
    const colVal = toStr(getFieldValue(r, colField));
    if (!rowVal || !colVal) continue;

    if (!matrix[rowVal]) matrix[rowVal] = {};
    matrix[rowVal][colVal] = (matrix[rowVal][colVal] ?? 0) + 1;
    rowCounts.set(rowVal, (rowCounts.get(rowVal) ?? 0) + 1);
    colCounts.set(colVal, (colCounts.get(colVal) ?? 0) + 1);
  }

  // Top rows/cols por frequência
  let rowKeys = Array.from(rowCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k);
  let colKeys = Array.from(colCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k);

  if (limit && limit > 0) {
    rowKeys = rowKeys.slice(0, limit);
    colKeys = colKeys.slice(0, limit);
  }

  let maxValue = 0;
  for (const row of rowKeys) {
    for (const col of colKeys) {
      const v = matrix[row]?.[col] ?? 0;
      if (v > maxValue) maxValue = v;
    }
  }

  return {
    rows: rowKeys.map(v => ({ value: v, label: getLabel(v, rowFieldMeta) })),
    columns: colKeys.map(v => ({ value: v, label: getLabel(v, colFieldMeta) })),
    matrix,
    maxValue,
  };
}

// ─── Funil ──────────────────────────────────────────────────────────

export function funnelStages(
  records: DataRecord[],
  fieldSlug: string,
  stages: string[],
  field?: EntityField,
): FunnelStage[] {
  const counts = new Map<string, number>();
  for (const s of stages) counts.set(s, 0);

  for (const r of records) {
    const val = toStr(getFieldValue(r, fieldSlug));
    if (counts.has(val)) {
      counts.set(val, counts.get(val)! + 1);
    }
  }

  const total = records.length || 1;

  return stages.map(stage => ({
    stage,
    label: getLabel(stage, field),
    count: counts.get(stage) ?? 0,
    percentage: ((counts.get(stage) ?? 0) / total) * 100,
  }));
}

// ─── Top records (ordenados por campo) ──────────────────────────────

export function topRecords(
  records: DataRecord[],
  options?: {
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string[];
  },
): DataRecord[] {
  const { limit = 10, sortBy, sortOrder = 'desc', fields } = options ?? {};

  let result = [...records];

  if (sortBy) {
    const mult = sortOrder === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      const aVal = getFieldValue(a, sortBy);
      const bVal = getFieldValue(b, sortBy);
      const aNum = toNum(aVal);
      const bNum = toNum(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) return (aNum - bNum) * mult;
      return toStr(aVal).localeCompare(toStr(bVal)) * mult;
    });
  }

  result = result.slice(0, limit);

  // Filtrar campos se especificado
  if (fields && fields.length > 0) {
    return result.map(r => ({
      ...r,
      data: Object.fromEntries(
        fields.map(f => [f, r.data?.[f]]),
      ),
    }));
  }

  return result;
}

// ─── Atividade recente ──────────────────────────────────────────────

export function recentActivity(
  records: DataRecord[],
  limit: number = 10,
): RecentActivityItem[] {
  // Ordenar por updatedAt desc, depois createdAt desc
  const sorted = [...records].sort((a, b) => {
    const aDate = a.updatedAt || a.createdAt;
    const bDate = b.updatedAt || b.createdAt;
    return bDate.localeCompare(aDate);
  });

  return sorted.slice(0, limit).map(r => ({
    id: r.id,
    action: r.createdAt === r.updatedAt ? 'created' : 'updated',
    timestamp: r.updatedAt || r.createdAt,
    data: r.data || {},
  }));
}

// ─── Ratio entre dois campos ────────────────────────────────────────

export function fieldRatio(
  records: DataRecord[],
  numeratorField: string,
  denominatorField: string,
  aggregation: 'sum' | 'avg' = 'sum',
  options?: { comparePeriod?: boolean; days?: number },
): FieldRatioResult & { periodComparison?: PeriodComparison } {
  const numAgg = aggregateField(records, numeratorField);
  const denAgg = aggregateField(records, denominatorField);

  const numVal = aggregation === 'avg' ? numAgg.avg : numAgg.sum;
  const denVal = aggregation === 'avg' ? denAgg.avg : denAgg.sum;
  const ratio = denVal !== 0 ? numVal / denVal : 0;

  const result: FieldRatioResult & { periodComparison?: PeriodComparison } = {
    numerator: numVal,
    denominator: denVal,
    ratio,
    percentage: ratio * 100,
  };

  if (options?.comparePeriod) {
    const days = options.days ?? 30;
    const { current, previous } = splitByPeriod(records, days);

    const curNum = aggregateField(current, numeratorField);
    const curDen = aggregateField(current, denominatorField);
    const prevNum = aggregateField(previous, numeratorField);
    const prevDen = aggregateField(previous, denominatorField);

    const curRatio = (aggregation === 'avg' ? curDen.avg : curDen.sum) !== 0
      ? (aggregation === 'avg' ? curNum.avg : curNum.sum) /
        (aggregation === 'avg' ? curDen.avg : curDen.sum)
      : 0;
    const prevRatio = (aggregation === 'avg' ? prevDen.avg : prevDen.sum) !== 0
      ? (aggregation === 'avg' ? prevNum.avg : prevNum.sum) /
        (aggregation === 'avg' ? prevDen.avg : prevDen.sum)
      : 0;

    result.periodComparison = computeComparison(curRatio * 100, prevRatio * 100);
  }

  return result;
}

// ─── Multi-agrupamento com múltiplas agregações (grouped data) ──────

export function multiGroupBy(
  records: DataRecord[],
  groupByFields: string[],
  aggregations: AggregationDef[],
  options?: {
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
): Array<Record<string, unknown>> {
  if (groupByFields.length === 0) {
    // Sem agrupamento: uma única linha com as agregações
    const row: Record<string, unknown> = {};
    for (const agg of aggregations) {
      row[agg.alias] = computeAggregation(records, agg);
    }
    return [row];
  }

  // Agrupar registros
  const groups = new Map<string, DataRecord[]>();

  for (const r of records) {
    const key = groupByFields.map(f => toStr(getFieldValue(r, f))).join('||');
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  // Computar agregações por grupo
  let result: Array<Record<string, unknown>> = [];

  for (const entry of Array.from(groups.entries())) {
    const parts = entry[0].split('||');
    const groupRecords = entry[1];
    const row: Record<string, unknown> = {};

    // Chaves de agrupamento
    for (let i = 0; i < groupByFields.length; i++) {
      row[groupByFields[i]] = parts[i];
    }

    // Agregações
    for (const agg of aggregations) {
      row[agg.alias] = computeAggregation(groupRecords, agg);
    }

    result.push(row);
  }

  // Ordenar
  if (options?.sortBy) {
    const mult = options.sortOrder === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      const aVal = a[options.sortBy!];
      const bVal = b[options.sortBy!];
      const aNum = toNum(aVal);
      const bNum = toNum(bVal);
      if (isValidNum(aVal) && isValidNum(bVal)) return (aNum - bNum) * mult;
      return toStr(aVal).localeCompare(toStr(bVal)) * mult;
    });
  }

  // Limitar
  if (options?.limit && options.limit > 0) {
    result = result.slice(0, options.limit);
  }

  return result;
}

function computeAggregation(records: DataRecord[], agg: AggregationDef): unknown {
  switch (agg.type) {
    case 'count':
      return records.length;

    case 'sum':
    case 'avg':
    case 'min':
    case 'max': {
      if (!agg.fieldSlug) return 0;
      const values: number[] = [];
      for (const r of records) {
        const v = toNum(getFieldValue(r, agg.fieldSlug));
        if (!isNaN(v) && isFinite(v)) values.push(v);
      }
      if (values.length === 0) return 0;
      return aggregateValues(values, agg.type);
    }

    case 'distinctCount': {
      const fields = agg.distinctFields ?? (agg.fieldSlug ? [agg.fieldSlug] : []);
      if (fields.length === 0) return records.length;
      const keys = new Set(
        records.map(r => fields.map(f => toStr(getFieldValue(r, f))).join('||')),
      );
      return keys.size;
    }

    case 'mode': {
      if (!agg.fieldSlug) return null;
      const freq = new Map<string, number>();
      for (const r of records) {
        const v = toStr(getFieldValue(r, agg.fieldSlug));
        if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
      }
      let modeVal = '';
      let modeCount = 0;
      freq.forEach((count, val) => {
        if (count > modeCount) { modeVal = val; modeCount = count; }
      });
      return modeVal;
    }

    case 'first': {
      if (!agg.fieldSlug || records.length === 0) return null;
      return getFieldValue(records[0], agg.fieldSlug);
    }

    default:
      return 0;
  }
}
