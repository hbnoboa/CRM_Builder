// Data Source types

export interface DataSourceDefinition {
  sources: DataSourceSource[];
  filters?: DataSourceFilter[];
  orderBy?: { field: string; order: 'asc' | 'desc' };
  limit?: number;
  aggregations?: DataSourceAggregation[];
}

export interface DataSourceSource {
  entitySlug: string;
  fields: { slug: string; alias?: string }[];
}

export interface DataSourceFilter {
  field: string; // entitySlug.fieldSlug
  fieldType?: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'isEmpty' | 'isNotEmpty';
  value?: unknown;
  value2?: unknown;
}

export interface DataSourceAggregation {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field?: string; // entitySlug.fieldSlug (count doesn't need it)
  alias: string;
}

export interface DataSourceResult {
  columns: { key: string; label: string; type: string; entitySlug: string }[];
  rows: Record<string, unknown>[];
  aggregations?: Record<string, number>;
  meta: { total: number; page: number; limit: number };
}

export interface DataSource {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  definition: DataSourceDefinition;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdById?: string;
}
