'use client';

/**
 * Adapter hooks: detectam automaticamente se estão dentro de EntityDataProvider.
 * - Dentro do provider → computa client-side via useMemo
 * - Fora do provider (ou entitySlugOverride) → fallback para server-side (API)
 *
 * Padrão: ambos os hooks sempre são chamados (hooks rules), mas o server-side
 * usa enabled: false quando o client-side está disponível.
 */

import { useMemo } from 'react';
import { useEntityDataOptional } from './entity-data-context';
import {
  countRecords,
  aggregateField,
  groupByField,
  groupByDate,
  fieldTrend,
  crossGroup,
  funnelStages,
  topRecords,
  recentActivity,
  fieldRatio,
  distinctCount,
  multiGroupBy,
} from './aggregation-engine';
import type { AggregationDef } from './aggregation-engine';
import {
  useEntityRecordCount,
  useEntityRecordsOverTime,
  useFieldDistribution,
  useFieldAggregation,
  useFieldTrend,
  useEntityRecentActivity,
  useEntityTopRecords,
  useEntityFunnel,
  useCrossFieldDistribution,
  useFieldRatio,
  useDistinctCount,
  useGroupedData,
  type DashboardFilterParams,
} from '@/hooks/use-dashboard-templates';

// ─── Helper ─────────────────────────────────────────────────────────

interface AdapterResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
}

// ─── Record Count ───────────────────────────────────────────────────

export function useAdaptedRecordCount(
  entitySlug: string | undefined,
  options?: { comparePeriod?: boolean; days?: number } & DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx) return undefined;
    return countRecords(ctx.filteredRecords, options);
  }, [useClient, ctx?.filteredRecords, options?.comparePeriod, options?.days]);

  const server = useEntityRecordCount(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : options,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Records Over Time ──────────────────────────────────────────────

export function useAdaptedRecordsOverTime(
  entitySlug: string | undefined,
  days?: number,
  dashFilters?: DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx) return undefined;
    return groupByDate(ctx.filteredRecords, days);
  }, [useClient, ctx?.filteredRecords, days]);

  const server = useEntityRecordsOverTime(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : days,
    useClient ? undefined : dashFilters,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Field Distribution ─────────────────────────────────────────────

export function useAdaptedFieldDistribution(
  entitySlug: string | undefined,
  fieldSlug: string | undefined,
  limit?: number,
  dashFilters?: DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx || !fieldSlug) return undefined;
    const field = ctx.entity?.fields.find(f => f.slug === fieldSlug);
    return groupByField(ctx.filteredRecords, fieldSlug, field, limit);
  }, [useClient, ctx?.filteredRecords, ctx?.entity, fieldSlug, limit]);

  const server = useFieldDistribution(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : fieldSlug,
    useClient ? undefined : limit,
    useClient ? undefined : dashFilters,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Field Aggregation ──────────────────────────────────────────────

export function useAdaptedFieldAggregation(
  entitySlug: string | undefined,
  fieldSlug: string | undefined,
  aggregation?: string,
  options?: { comparePeriod?: boolean; days?: number } & DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx || !fieldSlug) return undefined;
    return aggregateField(ctx.filteredRecords, fieldSlug, options);
  }, [useClient, ctx?.filteredRecords, fieldSlug, options?.comparePeriod, options?.days]);

  const server = useFieldAggregation(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : fieldSlug,
    useClient ? undefined : aggregation,
    useClient ? undefined : options,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Field Trend ────────────────────────────────────────────────────

export function useAdaptedFieldTrend(
  entitySlug: string | undefined,
  fieldSlug: string | undefined,
  aggregation?: string,
  days?: number,
  dashFilters?: DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx || !fieldSlug) return undefined;
    return fieldTrend(ctx.filteredRecords, fieldSlug, (aggregation as 'sum' | 'avg' | 'min' | 'max') || 'sum', days);
  }, [useClient, ctx?.filteredRecords, fieldSlug, aggregation, days]);

  const server = useFieldTrend(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : fieldSlug,
    useClient ? undefined : aggregation,
    useClient ? undefined : days,
    useClient ? undefined : dashFilters,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Recent Activity ────────────────────────────────────────────────

export function useAdaptedRecentActivity(
  entitySlug: string | undefined,
  limit?: number,
  dashFilters?: DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx) return undefined;
    return recentActivity(ctx.allRecords, limit);
  }, [useClient, ctx?.allRecords, limit]);

  const server = useEntityRecentActivity(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : limit,
    useClient ? undefined : dashFilters,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Top Records ────────────────────────────────────────────────────

export function useAdaptedTopRecords(
  entitySlug: string | undefined,
  options?: { limit?: number; sortBy?: string; sortOrder?: string; fields?: string[] } & DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx) return undefined;
    return topRecords(ctx.sortedRecords, {
      limit: options?.limit,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder as 'asc' | 'desc',
      fields: options?.fields,
    });
  }, [useClient, ctx?.sortedRecords, options?.limit, options?.sortBy, options?.sortOrder]);

  const server = useEntityTopRecords(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : options,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Funnel ─────────────────────────────────────────────────────────

export function useAdaptedFunnel(
  entitySlug: string | undefined,
  fieldSlug: string | undefined,
  stages?: string[],
  dashFilters?: DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx || !fieldSlug || !stages?.length) return undefined;
    const field = ctx.entity?.fields.find(f => f.slug === fieldSlug);
    return funnelStages(ctx.filteredRecords, fieldSlug, stages, field);
  }, [useClient, ctx?.filteredRecords, ctx?.entity, fieldSlug, stages]);

  const server = useEntityFunnel(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : fieldSlug,
    useClient ? undefined : stages,
    useClient ? undefined : dashFilters,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Cross-Field Distribution ───────────────────────────────────────

export function useAdaptedCrossFieldDistribution(
  entitySlug: string | undefined,
  rowField: string | undefined,
  columnField: string | undefined,
  options?: { limit?: number } & DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx || !rowField || !columnField) return undefined;
    const rowMeta = ctx.entity?.fields.find(f => f.slug === rowField);
    const colMeta = ctx.entity?.fields.find(f => f.slug === columnField);
    return crossGroup(ctx.filteredRecords, rowField, columnField, rowMeta, colMeta, options?.limit);
  }, [useClient, ctx?.filteredRecords, ctx?.entity, rowField, columnField, options?.limit]);

  const server = useCrossFieldDistribution(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : rowField,
    useClient ? undefined : columnField,
    useClient ? undefined : options,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Field Ratio ────────────────────────────────────────────────────

export function useAdaptedFieldRatio(
  entitySlug: string | undefined,
  numeratorField: string | undefined,
  denominatorField: string | undefined,
  options?: { aggregation?: string; comparePeriod?: boolean; days?: number; denominatorEntitySlug?: string } & DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  // Cross-entity ratio sempre server-side
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug && !options?.denominatorEntitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx || !numeratorField || !denominatorField) return undefined;
    return fieldRatio(
      ctx.filteredRecords,
      numeratorField,
      denominatorField,
      (options?.aggregation as 'sum' | 'avg') || 'sum',
      options,
    );
  }, [useClient, ctx?.filteredRecords, numeratorField, denominatorField, options?.aggregation, options?.comparePeriod, options?.days]);

  const server = useFieldRatio(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : numeratorField,
    useClient ? undefined : denominatorField,
    useClient ? undefined : options,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Distinct Count ─────────────────────────────────────────────────

export function useAdaptedDistinctCount(
  entitySlug: string | undefined,
  fields: string[] | undefined,
  options?: { comparePeriod?: boolean; days?: number; filterField?: string; filterValue?: string } & DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx || !fields?.length) return undefined;
    return distinctCount(ctx.filteredRecords, fields, options);
  }, [useClient, ctx?.filteredRecords, fields, options?.comparePeriod, options?.days, options?.filterField, options?.filterValue]);

  const server = useDistinctCount(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : fields,
    useClient ? undefined : options,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}

// ─── Grouped Data ───────────────────────────────────────────────────

export function useAdaptedGroupedData(
  entitySlug: string | undefined,
  groupBy: string[] | undefined,
  options?: {
    aggregations?: Array<{ type: string; fieldSlug?: string; alias: string; distinctFields?: string[] }>;
    crossEntityCount?: { entitySlug: string; matchFields?: Array<{ source: string; target: string }>; matchBy?: 'fields' | 'children'; alias: string };
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  } & DashboardFilterParams,
  entitySlugOverride?: string,
) {
  const ctx = useEntityDataOptional();
  // Cross-entity count sempre server-side
  const useClient = !!ctx && !entitySlugOverride && ctx.isFullDataset && ctx.entity?.slug === entitySlug && !options?.crossEntityCount;
  const effectiveSlug = entitySlugOverride || entitySlug;

  const clientData = useMemo(() => {
    if (!useClient || !ctx || !groupBy?.length) return undefined;
    const aggregations: AggregationDef[] = (options?.aggregations || []).map(a => ({
      ...a,
      type: a.type as AggregationDef['type'],
    }));
    return multiGroupBy(ctx.filteredRecords, groupBy, aggregations, {
      limit: options?.limit,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder as 'asc' | 'desc',
    });
  }, [useClient, ctx?.filteredRecords, groupBy, options?.aggregations, options?.limit, options?.sortBy, options?.sortOrder]);

  const server = useGroupedData(
    useClient ? undefined : effectiveSlug,
    useClient ? undefined : groupBy,
    useClient ? undefined : options,
  );

  if (useClient) {
    return { data: clientData, isLoading: false, error: null } as AdapterResult<typeof clientData>;
  }
  return server;
}
