import type {
  DataRecord,
  EntityField,
  EntityMeta,
  FieldFilter,
  CrossFilter,
  RelativeDatePreset,
  UnifiedFilterState,
} from './unified-filter-types';
import { getFilterCategory } from './unified-filter-types';

// ─── Resolve datas relativas ──────────────────────────────────────────

export function resolveRelativeDate(preset: RelativeDatePreset): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(today.getTime() + 86400000 - 1);

  const fmt = (d: Date) => d.toISOString();

  switch (preset) {
    case 'today':
      return { start: fmt(today), end: fmt(endOfDay) };

    case 'yesterday': {
      const yesterday = new Date(today.getTime() - 86400000);
      const yesterdayEnd = new Date(today.getTime() - 1);
      return { start: fmt(yesterday), end: fmt(yesterdayEnd) };
    }

    case 'last7days': {
      const start = new Date(today.getTime() - 7 * 86400000);
      return { start: fmt(start), end: fmt(endOfDay) };
    }

    case 'last30days': {
      const start = new Date(today.getTime() - 30 * 86400000);
      return { start: fmt(start), end: fmt(endOfDay) };
    }

    case 'thisWeek': {
      const dayOfWeek = today.getDay();
      const monday = new Date(today.getTime() - ((dayOfWeek === 0 ? 6 : dayOfWeek - 1)) * 86400000);
      return { start: fmt(monday), end: fmt(endOfDay) };
    }

    case 'lastWeek': {
      const dayOfWeek = today.getDay();
      const thisMonday = new Date(today.getTime() - ((dayOfWeek === 0 ? 6 : dayOfWeek - 1)) * 86400000);
      const lastMonday = new Date(thisMonday.getTime() - 7 * 86400000);
      const lastSunday = new Date(thisMonday.getTime() - 1);
      return { start: fmt(lastMonday), end: fmt(lastSunday) };
    }

    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: fmt(start), end: fmt(endOfDay) };
    }

    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: fmt(start), end: fmt(end) };
    }

    case 'thisQuarter': {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterMonth, 1);
      return { start: fmt(start), end: fmt(endOfDay) };
    }

    case 'thisYear': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: fmt(start), end: fmt(endOfDay) };
    }

    default:
      return { start: fmt(today), end: fmt(endOfDay) };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getFieldValue(record: DataRecord, fieldSlug: string): unknown {
  if (fieldSlug === 'createdAt' || fieldSlug === '__createdAt') return record.createdAt;
  if (fieldSlug === 'updatedAt' || fieldSlug === '__updatedAt') return record.updatedAt;
  if (fieldSlug === 'id') return record.id;
  return record.data?.[fieldSlug];
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

function toNum(val: unknown): number {
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val));
  return isNaN(n) ? NaN : n;
}

function toBool(val: unknown): boolean {
  return val === true || val === 'true' || val === 1 || val === '1';
}

function isEmptyValue(val: unknown): boolean {
  return val === null || val === undefined || val === '' ||
    (Array.isArray(val) && val.length === 0);
}

function toDateStr(val: unknown): string {
  if (!val) return '';
  const s = String(val);
  // Já é ISO string ou date string
  return s;
}

// ─── Avaliar um FieldFilter contra um valor ───────────────────────────

export function evaluateFieldFilter(value: unknown, filter: FieldFilter): boolean {
  const { operator, value: filterValue, value2, subField } = filter;
  const category = getFilterCategory(filter.fieldType);

  // Map: extrair sub-campo e re-avaliar
  if (category === 'map' && subField && operator !== 'isEmpty') {
    const mapData = (value && typeof value === 'object' && !Array.isArray(value))
      ? value as Record<string, unknown>
      : {};
    const subValue = mapData[subField] ?? null;

    if (operator === 'subFieldEquals') {
      return toStr(subValue).toLowerCase() === toStr(filterValue).toLowerCase();
    }
    if (operator === 'subFieldContains') {
      return toStr(subValue).toLowerCase().includes(toStr(filterValue).toLowerCase());
    }
    return true;
  }

  // Sub-entity: avaliar child counts
  if (category === 'sub-entity') {
    return evaluateSubEntityFilter(value, filter);
  }

  // Operadores sem valor
  if (operator === 'isEmpty') return isEmptyValue(value);
  if (operator === 'isNotEmpty') return !isEmptyValue(value);

  // Boolean
  if (operator === 'equals' && category === 'boolean') {
    return toBool(value) === toBool(filterValue);
  }

  // Select: in / notIn
  if (operator === 'in') {
    const allowed = Array.isArray(filterValue) ? filterValue : [filterValue];
    const strValue = toStr(value).toLowerCase();
    return allowed.some(v => toStr(v).toLowerCase() === strValue);
  }
  if (operator === 'notIn') {
    const blocked = Array.isArray(filterValue) ? filterValue : [filterValue];
    const strValue = toStr(value).toLowerCase();
    return !blocked.some(v => toStr(v).toLowerCase() === strValue);
  }

  // Multiselect: containsAny / containsAll / notContainsAny
  if (operator === 'containsAny') {
    const arr = Array.isArray(value) ? value.map(v => toStr(v).toLowerCase()) : [toStr(value).toLowerCase()];
    const targets = Array.isArray(filterValue) ? filterValue.map(v => toStr(v).toLowerCase()) : [toStr(filterValue).toLowerCase()];
    return targets.some(t => arr.includes(t));
  }
  if (operator === 'containsAll') {
    const arr = Array.isArray(value) ? value.map(v => toStr(v).toLowerCase()) : [toStr(value).toLowerCase()];
    const targets = Array.isArray(filterValue) ? filterValue.map(v => toStr(v).toLowerCase()) : [toStr(filterValue).toLowerCase()];
    return targets.every(t => arr.includes(t));
  }
  if (operator === 'notContainsAny') {
    const arr = Array.isArray(value) ? value.map(v => toStr(v).toLowerCase()) : [toStr(value).toLowerCase()];
    const targets = Array.isArray(filterValue) ? filterValue.map(v => toStr(v).toLowerCase()) : [toStr(filterValue).toLowerCase()];
    return !targets.some(t => arr.includes(t));
  }

  // Date: relative
  if (operator === 'relative' && filter.relativePreset) {
    const range = resolveRelativeDate(filter.relativePreset);
    const dateStr = toDateStr(value);
    if (!dateStr) return false;
    return dateStr >= range.start && dateStr <= range.end;
  }

  // Date: before / after
  if (operator === 'before') {
    const dateStr = toDateStr(value);
    return dateStr !== '' && dateStr < toDateStr(filterValue);
  }
  if (operator === 'after') {
    const dateStr = toDateStr(value);
    return dateStr !== '' && dateStr > toDateStr(filterValue);
  }

  // Text / general string operators
  const strValue = toStr(value).toLowerCase();
  const strFilter = toStr(filterValue).toLowerCase();

  switch (operator) {
    case 'equals':
      if (category === 'date') {
        // Comparar apenas a parte da data
        return toDateStr(value).substring(0, 10) === toDateStr(filterValue).substring(0, 10);
      }
      return strValue === strFilter;

    case 'notEquals':
      if (category === 'date') {
        return toDateStr(value).substring(0, 10) !== toDateStr(filterValue).substring(0, 10);
      }
      return strValue !== strFilter;

    case 'contains':
      return strValue.includes(strFilter);

    case 'notContains':
      return !strValue.includes(strFilter);

    case 'startsWith':
      return strValue.startsWith(strFilter);

    case 'endsWith':
      return strValue.endsWith(strFilter);

    case 'gt': {
      if (category === 'date') return toDateStr(value) > toDateStr(filterValue);
      const nv = toNum(value), nf = toNum(filterValue);
      return !isNaN(nv) && !isNaN(nf) && nv > nf;
    }

    case 'gte': {
      if (category === 'date') return toDateStr(value) >= toDateStr(filterValue);
      const nv = toNum(value), nf = toNum(filterValue);
      return !isNaN(nv) && !isNaN(nf) && nv >= nf;
    }

    case 'lt': {
      if (category === 'date') return toDateStr(value) < toDateStr(filterValue);
      const nv = toNum(value), nf = toNum(filterValue);
      return !isNaN(nv) && !isNaN(nf) && nv < nf;
    }

    case 'lte': {
      if (category === 'date') return toDateStr(value) <= toDateStr(filterValue);
      const nv = toNum(value), nf = toNum(filterValue);
      return !isNaN(nv) && !isNaN(nf) && nv <= nf;
    }

    case 'between': {
      if (category === 'date') {
        const d = toDateStr(value);
        return d >= toDateStr(filterValue) && d <= toDateStr(value2);
      }
      const nv = toNum(value), nMin = toNum(filterValue), nMax = toNum(value2);
      return !isNaN(nv) && !isNaN(nMin) && !isNaN(nMax) && nv >= nMin && nv <= nMax;
    }

    default:
      return true;
  }
}

// ─── Sub-entity filter evaluation ─────────────────────────────────────

function evaluateSubEntityFilter(value: unknown, filter: FieldFilter): boolean {
  const { operator, value: filterValue } = filter;

  // value for sub-entity is typically the child count or the _childCounts object
  // The fieldSlug points to a sub-entity field, and _childCounts has counts keyed by entity slug
  const count = typeof value === 'number' ? value : 0;

  switch (operator) {
    case 'hasChildren':
      return count > 0;
    case 'hasNoChildren':
      return count === 0;
    case 'childCountGte': {
      const threshold = toNum(filterValue);
      return !isNaN(threshold) && count >= threshold;
    }
    case 'childFieldEquals':
      // This requires sub-entity data which we don't have in memory
      // For now, return true (filter server-side as fallback)
      return true;
    default:
      return true;
  }
}

// ─── Converter cross-filters em field filters ─────────────────────────

export function crossFiltersToFieldFilters(crossFilters: CrossFilter[]): FieldFilter[] {
  return crossFilters.map((cf, idx) => ({
    id: `cross-${idx}-${cf.fieldSlug}`,
    fieldSlug: cf.fieldSlug,
    fieldType: 'select',
    operator: cf.values.length > 1 ? 'in' as const : 'equals' as const,
    value: cf.values.length > 1 ? cf.values : cf.values[0],
  }));
}

// ─── Busca textual ────────────────────────────────────────────────────

function matchesSearch(record: DataRecord, searchTerm: string, entity: EntityMeta | null): boolean {
  if (!searchTerm) return true;

  const term = searchTerm.toLowerCase();

  // Buscar em campos searchable, ou em todos os text fields se nenhum marcado
  const searchFields = entity?.fields?.filter(f => f.searchable) || [];
  const fieldsToSearch = searchFields.length > 0
    ? searchFields
    : entity?.fields?.filter(f => {
        const cat = getFilterCategory(f.type);
        return cat === 'text' || cat === 'select';
      }) || [];

  if (fieldsToSearch.length === 0) {
    // Fallback: buscar em todos os valores do data
    return Object.values(record.data || {}).some(val =>
      toStr(val).toLowerCase().includes(term)
    );
  }

  return fieldsToSearch.some(f => {
    const val = getFieldValue(record, f.slug);
    return toStr(val).toLowerCase().includes(term);
  });
}

// ─── Pipeline principal ───────────────────────────────────────────────

export function applyAllFilters(
  records: DataRecord[],
  filters: UnifiedFilterState,
  entity: EntityMeta | null,
): DataRecord[] {
  let result = records;

  // 1. Busca textual
  if (filters.searchTerm) {
    result = result.filter(r => matchesSearch(r, filters.searchTerm, entity));
  }

  // 2. Field filters
  if (filters.fieldFilters.length > 0) {
    result = result.filter(record =>
      filters.fieldFilters.every(filter => {
        const value = getFieldValue(record, filter.fieldSlug);
        return evaluateFieldFilter(value, filter);
      })
    );
  }

  // 3. Cross-filters (convertidos em field filters)
  if (filters.crossFilters.length > 0) {
    const crossAsField = crossFiltersToFieldFilters(filters.crossFilters);
    result = result.filter(record =>
      crossAsField.every(filter => {
        const value = getFieldValue(record, filter.fieldSlug);
        return evaluateFieldFilter(value, filter);
      })
    );
  }

  // 4. Date range global (aplica em createdAt)
  if (filters.dateRange) {
    const { start, end } = filters.dateRange;
    result = result.filter(record => {
      const created = record.createdAt || '';
      return created >= start && created <= end;
    });
  }

  return result;
}

// ─── Sort client-side ─────────────────────────────────────────────────

export function sortRecords(
  records: DataRecord[],
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  fields?: EntityField[],
): DataRecord[] {
  if (!sortBy) return records;

  const sorted = [...records];
  const field = fields?.find(f => f.slug === sortBy);
  const category = field ? getFilterCategory(field.type) : null;
  const multiplier = sortOrder === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    const aVal = getFieldValue(a, sortBy);
    const bVal = getFieldValue(b, sortBy);

    // Nulls last
    if (isEmptyValue(aVal) && isEmptyValue(bVal)) return 0;
    if (isEmptyValue(aVal)) return 1;
    if (isEmptyValue(bVal)) return -1;

    // Numérico
    if (category === 'number') {
      return (toNum(aVal) - toNum(bVal)) * multiplier;
    }

    // Data
    if (category === 'date' || sortBy === 'createdAt' || sortBy === 'updatedAt') {
      return (toDateStr(aVal) < toDateStr(bVal) ? -1 : toDateStr(aVal) > toDateStr(bVal) ? 1 : 0) * multiplier;
    }

    // Boolean
    if (category === 'boolean') {
      return (toBool(aVal) === toBool(bVal) ? 0 : toBool(aVal) ? -1 : 1) * multiplier;
    }

    // String (default)
    return toStr(aVal).localeCompare(toStr(bVal), 'pt-BR', { sensitivity: 'base' }) * multiplier;
  });

  return sorted;
}
