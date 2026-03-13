'use client';

import { useMemo } from 'react';
import { useEntityData } from './entity-data-context';
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
import type {
  EntityRecordCount,
  FieldDistributionItem,
  FieldAggregation,
  PeriodComparison,
  TimeSeriesPoint,
  FieldTrendPoint,
  CrossFieldDistribution,
  FunnelStage,
  FieldRatioResult,
  RecentActivityItem,
  AggregationDef,
  DateGranularity,
} from './aggregation-engine';
import type { DataRecord } from './unified-filter-types';

// ─── Tipo de retorno com comparison ─────────────────────────────────

interface WithComparison<T> {
  data: T;
  comparisonData: T | null;
}

// ─── Record Count ───────────────────────────────────────────────────

export function useClientRecordCount(
  options?: { comparePeriod?: boolean; days?: number },
): WithComparison<EntityRecordCount> {
  const { filteredRecords, comparisonRecords } = useEntityData();

  return useMemo(() => ({
    data: countRecords(filteredRecords, options),
    comparisonData: comparisonRecords
      ? countRecords(comparisonRecords, options)
      : null,
  }), [filteredRecords, comparisonRecords, options?.comparePeriod, options?.days]);
}

// ─── Field Distribution ─────────────────────────────────────────────

export function useClientFieldDistribution(
  fieldSlug: string | undefined,
  limit?: number,
): WithComparison<FieldDistributionItem[]> {
  const { filteredRecords, comparisonRecords, entity } = useEntityData();

  return useMemo(() => {
    if (!fieldSlug) return { data: [], comparisonData: null };
    const field = entity?.fields.find(f => f.slug === fieldSlug);
    return {
      data: groupByField(filteredRecords, fieldSlug, field, limit),
      comparisonData: comparisonRecords
        ? groupByField(comparisonRecords, fieldSlug, field, limit)
        : null,
    };
  }, [filteredRecords, comparisonRecords, entity, fieldSlug, limit]);
}

// ─── Field Aggregation ──────────────────────────────────────────────

export function useClientFieldAggregation(
  fieldSlug: string | undefined,
  options?: { comparePeriod?: boolean; days?: number },
): WithComparison<FieldAggregation & { periodComparison?: PeriodComparison }> {
  const { filteredRecords, comparisonRecords } = useEntityData();

  const empty: FieldAggregation = { count: 0, sum: 0, avg: 0, min: 0, max: 0 };

  return useMemo(() => {
    if (!fieldSlug) return { data: empty, comparisonData: null };
    return {
      data: aggregateField(filteredRecords, fieldSlug, options),
      comparisonData: comparisonRecords
        ? aggregateField(comparisonRecords, fieldSlug, options)
        : null,
    };
  }, [filteredRecords, comparisonRecords, fieldSlug, options?.comparePeriod, options?.days]);
}

// ─── Field Trend ────────────────────────────────────────────────────

export function useClientFieldTrend(
  fieldSlug: string | undefined,
  aggregation: 'sum' | 'avg' | 'min' | 'max' = 'sum',
  days?: number,
): WithComparison<FieldTrendPoint[]> {
  const { filteredRecords, comparisonRecords } = useEntityData();

  return useMemo(() => {
    if (!fieldSlug) return { data: [], comparisonData: null };
    return {
      data: fieldTrend(filteredRecords, fieldSlug, aggregation, days),
      comparisonData: comparisonRecords
        ? fieldTrend(comparisonRecords, fieldSlug, aggregation, days)
        : null,
    };
  }, [filteredRecords, comparisonRecords, fieldSlug, aggregation, days]);
}

// ─── Records Over Time ──────────────────────────────────────────────

export function useClientRecordsOverTime(
  days?: number,
  granularity?: DateGranularity,
): WithComparison<TimeSeriesPoint[]> {
  const { filteredRecords, comparisonRecords } = useEntityData();

  return useMemo(() => ({
    data: groupByDate(filteredRecords, days, granularity),
    comparisonData: comparisonRecords
      ? groupByDate(comparisonRecords, days, granularity)
      : null,
  }), [filteredRecords, comparisonRecords, days, granularity]);
}

// ─── Top Records ────────────────────────────────────────────────────

export function useClientTopRecords(
  options?: {
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string[];
  },
): DataRecord[] {
  const { sortedRecords } = useEntityData();

  return useMemo(
    () => topRecords(sortedRecords, options),
    [sortedRecords, options?.limit, options?.sortBy, options?.sortOrder, options?.fields],
  );
}

// ─── Recent Activity ────────────────────────────────────────────────

export function useClientRecentActivity(
  limit?: number,
): RecentActivityItem[] {
  const { allRecords } = useEntityData();

  return useMemo(
    () => recentActivity(allRecords, limit),
    [allRecords, limit],
  );
}

// ─── Funnel ─────────────────────────────────────────────────────────

export function useClientFunnel(
  fieldSlug: string | undefined,
  stages: string[],
): WithComparison<FunnelStage[]> {
  const { filteredRecords, comparisonRecords, entity } = useEntityData();

  return useMemo(() => {
    if (!fieldSlug || stages.length === 0) return { data: [], comparisonData: null };
    const field = entity?.fields.find(f => f.slug === fieldSlug);
    return {
      data: funnelStages(filteredRecords, fieldSlug, stages, field),
      comparisonData: comparisonRecords
        ? funnelStages(comparisonRecords, fieldSlug, stages, field)
        : null,
    };
  }, [filteredRecords, comparisonRecords, entity, fieldSlug, stages]);
}

// ─── Cross-Field Distribution ───────────────────────────────────────

export function useClientCrossFieldDistribution(
  rowField: string | undefined,
  colField: string | undefined,
  limit?: number,
): WithComparison<CrossFieldDistribution> {
  const { filteredRecords, comparisonRecords, entity } = useEntityData();

  const empty: CrossFieldDistribution = { rows: [], columns: [], matrix: {}, maxValue: 0 };

  return useMemo(() => {
    if (!rowField || !colField) return { data: empty, comparisonData: null };
    const rowMeta = entity?.fields.find(f => f.slug === rowField);
    const colMeta = entity?.fields.find(f => f.slug === colField);
    return {
      data: crossGroup(filteredRecords, rowField, colField, rowMeta, colMeta, limit),
      comparisonData: comparisonRecords
        ? crossGroup(comparisonRecords, rowField, colField, rowMeta, colMeta, limit)
        : null,
    };
  }, [filteredRecords, comparisonRecords, entity, rowField, colField, limit]);
}

// ─── Field Ratio ────────────────────────────────────────────────────

export function useClientFieldRatio(
  numeratorField: string | undefined,
  denominatorField: string | undefined,
  aggregation: 'sum' | 'avg' = 'sum',
  options?: { comparePeriod?: boolean; days?: number },
): WithComparison<FieldRatioResult & { periodComparison?: PeriodComparison }> {
  const { filteredRecords, comparisonRecords } = useEntityData();

  const empty: FieldRatioResult = { numerator: 0, denominator: 0, ratio: 0, percentage: 0 };

  return useMemo(() => {
    if (!numeratorField || !denominatorField) return { data: empty, comparisonData: null };
    return {
      data: fieldRatio(filteredRecords, numeratorField, denominatorField, aggregation, options),
      comparisonData: comparisonRecords
        ? fieldRatio(comparisonRecords, numeratorField, denominatorField, aggregation, options)
        : null,
    };
  }, [filteredRecords, comparisonRecords, numeratorField, denominatorField, aggregation, options?.comparePeriod, options?.days]);
}

// ─── Distinct Count ─────────────────────────────────────────────────

export function useClientDistinctCount(
  fields: string[],
  options?: {
    comparePeriod?: boolean;
    days?: number;
    filterField?: string;
    filterValue?: string;
  },
): WithComparison<EntityRecordCount & { totalDistinct?: number; filteredDistinct?: number }> {
  const { filteredRecords, comparisonRecords } = useEntityData();

  return useMemo(() => ({
    data: distinctCount(filteredRecords, fields, options),
    comparisonData: comparisonRecords
      ? distinctCount(comparisonRecords, fields, options)
      : null,
  }), [filteredRecords, comparisonRecords, fields, options?.comparePeriod, options?.days, options?.filterField, options?.filterValue]);
}

// ─── Grouped Data ───────────────────────────────────────────────────

export function useClientGroupedData(
  groupByFields: string[],
  aggregations: AggregationDef[],
  options?: {
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
): WithComparison<Array<Record<string, unknown>>> {
  const { filteredRecords, comparisonRecords } = useEntityData();

  return useMemo(() => ({
    data: multiGroupBy(filteredRecords, groupByFields, aggregations, options),
    comparisonData: comparisonRecords
      ? multiGroupBy(comparisonRecords, groupByFields, aggregations, options)
      : null,
  }), [filteredRecords, comparisonRecords, groupByFields, aggregations, options?.limit, options?.sortBy, options?.sortOrder]);
}
