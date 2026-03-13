// ─── Operadores por tipo de campo ──────────────────────────────────────

export type TextOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty';

export type NumberOperator =
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'isEmpty';

export type DateOperator =
  | 'equals'
  | 'before'
  | 'after'
  | 'between'
  | 'relative'
  | 'isEmpty';

export type SelectOperator =
  | 'in'
  | 'notIn'
  | 'equals'
  | 'notEquals'
  | 'isEmpty';

export type MultiselectOperator =
  | 'containsAny'
  | 'containsAll'
  | 'notContainsAny'
  | 'isEmpty';

export type BooleanOperator = 'equals';

export type MapOperator =
  | 'subFieldEquals'
  | 'subFieldContains'
  | 'isEmpty';

export type SubEntityOperator =
  | 'hasChildren'
  | 'hasNoChildren'
  | 'childCountGte'
  | 'childFieldEquals';

export type FilterOperator =
  | TextOperator
  | NumberOperator
  | DateOperator
  | SelectOperator
  | MultiselectOperator
  | BooleanOperator
  | MapOperator
  | SubEntityOperator;

// ─── Datas relativas ──────────────────────────────────────────────────

export type RelativeDatePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'thisYear';

// ─── Categorias de filtro ─────────────────────────────────────────────

export type FilterCategory =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'map'
  | 'sub-entity'
  | 'color'
  | 'file';

// ─── Field Filter ─────────────────────────────────────────────────────

export interface FieldFilter {
  id: string;
  fieldSlug: string;
  fieldType: string;
  operator: FilterOperator;
  value?: unknown;
  value2?: unknown;
  subField?: string;
  relativePreset?: RelativeDatePreset;
}

// ─── Cross Filter ─────────────────────────────────────────────────────

export interface CrossFilter {
  fieldSlug: string;
  values: string[];
  entitySlug?: string;
  sourceWidgetId?: string;
}

// ─── Comparison Filter ────────────────────────────────────────────────

export interface ComparisonFilter {
  label: string;
  filters: FieldFilter[];
}

// ─── Filter Preset ────────────────────────────────────────────────────

export interface FilterPreset {
  id: string;
  name: string;
  fieldFilters: FieldFilter[];
  crossFilters: CrossFilter[];
  dateRange?: { start: string; end: string };
  searchTerm: string;
  comparison?: ComparisonFilter;
  isDefault: boolean;
  createdBy: string;
  scope: 'personal' | 'shared';
  createdAt: string;
}

// ─── Unified Filter State ─────────────────────────────────────────────

export interface UnifiedFilterState {
  fieldFilters: FieldFilter[];
  crossFilters: CrossFilter[];
  searchTerm: string;
  dateRange?: { start: string; end: string };
  comparison?: ComparisonFilter;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ─── Drill-through ────────────────────────────────────────────────────

export interface DrillRecord {
  entitySlug: string;
  recordId: string;
}

// ─── Data Record ──────────────────────────────────────────────────────

export interface DataRecord {
  id: string;
  tenantId?: string;
  parentRecordId?: string | null;
  data: Record<string, unknown>;
  _childCounts?: Record<string, number>;
  _parentDisplay?: string | null;
  _parentEntityName?: string | null;
  _parentEntitySlug?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Entity Meta ──────────────────────────────────────────────────────

export interface EntityField {
  slug: string;
  name: string;
  label?: string;
  type: string;
  options?: Array<{ label: string; value: string; color?: string }>;
  required?: boolean;
  searchable?: boolean;
  settings?: Record<string, unknown>;
  subEntitySlug?: string;
  subEntityId?: string;
  diagramZones?: Array<{ options?: string[] }>;
}

export interface EntityMeta {
  id: string;
  name: string;
  namePlural?: string;
  slug: string;
  fields: EntityField[];
  displayField?: string;
  parentEntityId?: string | null;
  parentEntitySlug?: string | null;
  settings?: Record<string, unknown>;
}

// ─── Operador config por tipo ─────────────────────────────────────────

export interface OperatorOption {
  value: FilterOperator;
  labelKey: string;
}

export const OPERATORS_BY_CATEGORY: Record<FilterCategory, OperatorOption[]> = {
  text: [
    { value: 'contains', labelKey: 'filter.contains' },
    { value: 'notContains', labelKey: 'filter.notContains' },
    { value: 'equals', labelKey: 'filter.equals' },
    { value: 'notEquals', labelKey: 'filter.notEquals' },
    { value: 'startsWith', labelKey: 'filter.startsWith' },
    { value: 'endsWith', labelKey: 'filter.endsWith' },
    { value: 'isEmpty', labelKey: 'filter.isEmpty' },
    { value: 'isNotEmpty', labelKey: 'filter.isNotEmpty' },
  ],
  number: [
    { value: 'equals', labelKey: 'filter.equals' },
    { value: 'notEquals', labelKey: 'filter.notEquals' },
    { value: 'gt', labelKey: 'filter.gt' },
    { value: 'gte', labelKey: 'filter.gte' },
    { value: 'lt', labelKey: 'filter.lt' },
    { value: 'lte', labelKey: 'filter.lte' },
    { value: 'between', labelKey: 'filter.between' },
    { value: 'isEmpty', labelKey: 'filter.isEmpty' },
  ],
  date: [
    { value: 'equals', labelKey: 'filter.equals' },
    { value: 'before', labelKey: 'filter.before' },
    { value: 'after', labelKey: 'filter.after' },
    { value: 'between', labelKey: 'filter.between' },
    { value: 'relative', labelKey: 'filter.relative' },
    { value: 'isEmpty', labelKey: 'filter.isEmpty' },
  ],
  boolean: [
    { value: 'equals', labelKey: 'filter.equals' },
  ],
  select: [
    { value: 'in', labelKey: 'filter.in' },
    { value: 'notIn', labelKey: 'filter.notIn' },
    { value: 'equals', labelKey: 'filter.equals' },
    { value: 'notEquals', labelKey: 'filter.notEquals' },
    { value: 'isEmpty', labelKey: 'filter.isEmpty' },
  ],
  multiselect: [
    { value: 'containsAny', labelKey: 'filter.containsAny' },
    { value: 'containsAll', labelKey: 'filter.containsAll' },
    { value: 'notContainsAny', labelKey: 'filter.notContainsAny' },
    { value: 'isEmpty', labelKey: 'filter.isEmpty' },
  ],
  map: [
    { value: 'subFieldEquals', labelKey: 'filter.subFieldEquals' },
    { value: 'subFieldContains', labelKey: 'filter.subFieldContains' },
    { value: 'isEmpty', labelKey: 'filter.isEmpty' },
  ],
  'sub-entity': [
    { value: 'hasChildren', labelKey: 'filter.hasChildren' },
    { value: 'hasNoChildren', labelKey: 'filter.hasNoChildren' },
    { value: 'childCountGte', labelKey: 'filter.childCountGte' },
    { value: 'childFieldEquals', labelKey: 'filter.childFieldEquals' },
  ],
  color: [
    { value: 'equals', labelKey: 'filter.equals' },
    { value: 'notEquals', labelKey: 'filter.notEquals' },
    { value: 'isEmpty', labelKey: 'filter.isEmpty' },
  ],
  file: [
    { value: 'isEmpty', labelKey: 'filter.isEmpty' },
    { value: 'isNotEmpty', labelKey: 'filter.isNotEmpty' },
  ],
};

// ─── Presets de datas relativas ───────────────────────────────────────

export interface RelativeDateOption {
  value: RelativeDatePreset;
  labelKey: string;
}

export const RELATIVE_DATE_OPTIONS: RelativeDateOption[] = [
  { value: 'today', labelKey: 'filter.today' },
  { value: 'yesterday', labelKey: 'filter.yesterday' },
  { value: 'last7days', labelKey: 'filter.last7days' },
  { value: 'last30days', labelKey: 'filter.last30days' },
  { value: 'thisWeek', labelKey: 'filter.thisWeek' },
  { value: 'lastWeek', labelKey: 'filter.lastWeek' },
  { value: 'thisMonth', labelKey: 'filter.thisMonth' },
  { value: 'lastMonth', labelKey: 'filter.lastMonth' },
  { value: 'thisQuarter', labelKey: 'filter.thisQuarter' },
  { value: 'thisYear', labelKey: 'filter.thisYear' },
];

// ─── Helper: mapear tipo concreto para categoria ──────────────────────

const TEXT_TYPES = new Set([
  'text', 'textarea', 'richtext', 'email', 'phone', 'url',
  'cpf', 'cnpj', 'cep', 'password', 'tags',
]);

const NUMBER_TYPES = new Set([
  'number', 'currency', 'percentage', 'rating', 'slider',
]);

const DATE_TYPES = new Set([
  'date', 'datetime', 'time',
]);

const SELECT_TYPES = new Set([
  'select', 'api-select', 'relation', 'zone-diagram',
  'user-select', 'workflow-status', 'radio-group',
]);

const MULTISELECT_TYPES = new Set([
  'multiselect', 'checkbox-group',
]);

const FILE_TYPES = new Set([
  'file', 'image', 'signature',
]);

const NON_FILTERABLE_TYPES = new Set([
  'hidden', 'json', 'array', 'section-title', 'action-button',
  'formula', 'lookup', 'rollup', 'timer', 'sla-status',
]);

export function getFilterCategory(fieldType: string): FilterCategory | null {
  if (NON_FILTERABLE_TYPES.has(fieldType)) return null;
  if (TEXT_TYPES.has(fieldType)) return 'text';
  if (NUMBER_TYPES.has(fieldType)) return 'number';
  if (DATE_TYPES.has(fieldType)) return 'date';
  if (fieldType === 'boolean') return 'boolean';
  if (SELECT_TYPES.has(fieldType)) return 'select';
  if (MULTISELECT_TYPES.has(fieldType)) return 'multiselect';
  if (fieldType === 'map') return 'map';
  if (fieldType === 'sub-entity') return 'sub-entity';
  if (fieldType === 'color') return 'color';
  if (FILE_TYPES.has(fieldType)) return 'file';
  return 'text';
}

export function getOperatorsForField(fieldType: string): OperatorOption[] {
  const category = getFilterCategory(fieldType);
  if (!category) return [];
  return OPERATORS_BY_CATEGORY[category] || [];
}

export function isFilterableField(fieldType: string): boolean {
  return getFilterCategory(fieldType) !== null;
}

// ─── Estado inicial ───────────────────────────────────────────────────

export const INITIAL_FILTER_STATE: UnifiedFilterState = {
  fieldFilters: [],
  crossFilters: [],
  searchTerm: '',
  dateRange: undefined,
  comparison: undefined,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};
