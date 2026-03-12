'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEntityRecordCount, useFieldAggregation, useFieldRatio, useDistinctCount } from '@/hooks/use-dashboard-templates';
import { useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';
import { cn } from '@/lib/utils';

interface KpiCardWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function KpiCardWidget({ entitySlug, config, title, isEditMode }: KpiCardWidgetProps) {
  const dashFilters = useWidgetFilters();
  const isRatio = !!config.ratioFieldSlug && !!config.fieldSlug;
  const isCountRatio = isRatio && config.fieldSlug === 'count' && config.ratioFieldSlug === 'count';
  const isFieldRatio = isRatio && !isCountRatio;
  const isDistinctRatio = !isRatio && config.aggregation === 'distinct' && !!config.distinctFields?.length && !!config.filterField && !!config.ratioMode;
  const isDistinct = !isRatio && !isDistinctRatio && config.aggregation === 'distinct' && !!config.distinctFields?.length;
  const isFieldAgg = !isRatio && !isDistinct && !isDistinctRatio && !!config.fieldSlug && config.aggregation !== 'count';

  // Simple record count (default KPI)
  const recordCount = useEntityRecordCount(
    !isFieldAgg && !isRatio && !isDistinct && !isDistinctRatio ? entitySlug : (isCountRatio ? entitySlug : undefined),
    { comparePeriod: config.showComparison, days: config.comparisonPeriod || 30, ...dashFilters },
  );

  // Denominator for count-based ratio
  const denominatorCount = useEntityRecordCount(
    isCountRatio && config.ratioEntitySlug ? config.ratioEntitySlug : undefined,
    { comparePeriod: config.showComparison, days: config.comparisonPeriod || 30, ...dashFilters },
  );

  // Distinct count of field combinations
  const distinctCount = useDistinctCount(
    isDistinct ? entitySlug : undefined,
    config.distinctFields,
    { comparePeriod: config.showComparison, days: config.comparisonPeriod || 30, ...dashFilters },
  );

  // Distinct ratio: filtered distinct / total distinct
  const distinctRatioFiltered = useDistinctCount(
    isDistinctRatio ? entitySlug : undefined,
    config.distinctFields,
    { comparePeriod: config.showComparison, days: config.comparisonPeriod || 30, filterField: config.filterField, filterValue: config.filterValue, ...dashFilters },
  );
  const distinctRatioTotal = useDistinctCount(
    isDistinctRatio ? entitySlug : undefined,
    config.distinctFields,
    { comparePeriod: config.showComparison, days: config.comparisonPeriod || 30, ...dashFilters },
  );

  // Field aggregation (sum, avg, min, max)
  const fieldAgg = useFieldAggregation(
    isFieldAgg ? entitySlug : undefined,
    config.fieldSlug,
    config.aggregation,
    { comparePeriod: config.showComparison, days: config.comparisonPeriod || 30, ...dashFilters },
  );

  // Field-based ratio (non-count)
  const fieldRatio = useFieldRatio(
    isFieldRatio ? entitySlug : undefined,
    config.fieldSlug,
    config.ratioFieldSlug,
    { aggregation: config.aggregation || 'sum', comparePeriod: config.showComparison, days: config.comparisonPeriod || 30, denominatorEntitySlug: config.ratioEntitySlug, ...dashFilters },
  );

  const isLoading = isDistinctRatio ? distinctRatioFiltered.isLoading || distinctRatioTotal.isLoading
    : isDistinct ? distinctCount.isLoading
    : isCountRatio ? recordCount.isLoading || denominatorCount.isLoading
    : isFieldRatio ? fieldRatio.isLoading
    : isFieldAgg ? fieldAgg.isLoading
    : recordCount.isLoading;

  const error = isDistinctRatio ? distinctRatioFiltered.error || distinctRatioTotal.error
    : isDistinct ? distinctCount.error
    : isCountRatio ? recordCount.error || denominatorCount.error
    : isFieldRatio ? fieldRatio.error
    : isFieldAgg ? fieldAgg.error
    : recordCount.error;

  let value = 0;
  let comparison: { previous: number; changePercent: number; changeAbsolute: number } | undefined;

  if (isDistinctRatio && distinctRatioFiltered.data && distinctRatioTotal.data) {
    const num = distinctRatioFiltered.data.total;
    const den = distinctRatioTotal.data.total;
    const ratio = den !== 0 ? num / den : 0;
    value = config.ratioMode === 'ratio' ? ratio : ratio * 100;

    if (distinctRatioFiltered.data.periodComparison && distinctRatioTotal.data.periodComparison) {
      const curNum = distinctRatioFiltered.data.periodComparison.current;
      const curDen = distinctRatioTotal.data.periodComparison.current;
      const prevNum = distinctRatioFiltered.data.periodComparison.previous;
      const prevDen = distinctRatioTotal.data.periodComparison.previous;
      const curPct = curDen !== 0 ? (curNum / curDen) * 100 : 0;
      const prevPct = prevDen !== 0 ? (prevNum / prevDen) * 100 : 0;
      comparison = {
        previous: prevPct,
        changePercent: prevPct > 0 ? ((curPct - prevPct) / prevPct) * 100 : curPct > 0 ? 100 : 0,
        changeAbsolute: curPct - prevPct,
      };
    }
  } else if (isDistinct && distinctCount.data) {
    value = distinctCount.data.total;
    comparison = distinctCount.data.periodComparison;
  } else if (isCountRatio && recordCount.data && denominatorCount.data) {
    const num = recordCount.data.total;
    const den = denominatorCount.data.total;
    const ratio = den !== 0 ? num / den : 0;
    value = config.ratioMode === 'ratio' ? ratio : ratio * 100;

    if (recordCount.data.periodComparison && denominatorCount.data.periodComparison) {
      const curNum = recordCount.data.periodComparison.current;
      const curDen = denominatorCount.data.periodComparison.current;
      const prevNum = recordCount.data.periodComparison.previous;
      const prevDen = denominatorCount.data.periodComparison.previous;
      const curPct = curDen !== 0 ? (curNum / curDen) * 100 : 0;
      const prevPct = prevDen !== 0 ? (prevNum / prevDen) * 100 : 0;
      comparison = {
        previous: prevPct,
        changePercent: prevPct > 0 ? ((curPct - prevPct) / prevPct) * 100 : curPct > 0 ? 100 : 0,
        changeAbsolute: curPct - prevPct,
      };
    }
  } else if (isFieldRatio && fieldRatio.data) {
    value = config.ratioMode === 'ratio' ? fieldRatio.data.ratio : fieldRatio.data.percentage;
    comparison = fieldRatio.data.periodComparison;
  } else if (!isRatio && !isFieldAgg && !isDistinct && recordCount.data) {
    value = recordCount.data.total;
    comparison = recordCount.data.periodComparison;
  } else if (isFieldAgg && fieldAgg.data) {
    const agg = config.aggregation || 'sum';
    value = fieldAgg.data[agg as keyof typeof fieldAgg.data] as number || 0;
    comparison = fieldAgg.data.periodComparison;
  }

  const getThresholdColor = () => {
    if (!config.thresholds) return undefined;
    if (value >= config.thresholds.danger) return 'text-destructive';
    if (value >= config.thresholds.warn) return 'text-yellow-500';
    return 'text-emerald-500';
  };

  const formatValue = (v: number) => {
    if (isRatio || isDistinctRatio) {
      const formatted = (v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      return config.ratioMode === 'ratio' ? formatted : `${formatted}%`;
    }
    if (config.aggregation === 'avg' || config.aggregation === 'min' || config.aggregation === 'max') {
      return (v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    }
    return (v ?? 0).toLocaleString('pt-BR');
  };

  return (
    <WidgetWrapper
      title={title}
      isEditMode={isEditMode}
      isLoading={isLoading}
      error={error ? 'Erro ao carregar dados' : null}
    >
      <div className="flex flex-col justify-center h-full gap-1">
        <span className={cn('text-3xl font-bold', getThresholdColor())}>
          {formatValue(value)}
        </span>
        {comparison && config.showComparison && (
          <div className="flex items-center gap-1.5 text-sm">
            {comparison.changePercent > 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : comparison.changePercent < 0 ? (
              <TrendingDown className="h-4 w-4 text-destructive" />
            ) : (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={cn(
                comparison.changePercent > 0 && 'text-emerald-500',
                comparison.changePercent < 0 && 'text-destructive',
                comparison.changePercent === 0 && 'text-muted-foreground',
              )}
            >
              {comparison.changePercent > 0 ? '+' : ''}
              {comparison.changePercent.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs periodo anterior</span>
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}
