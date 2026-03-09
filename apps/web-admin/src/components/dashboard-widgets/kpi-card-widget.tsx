'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEntityRecordCount, useFieldAggregation } from '@/hooks/use-dashboard-templates';
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
  const isFieldAgg = !!config.fieldSlug && config.aggregation !== 'count';

  const recordCount = useEntityRecordCount(
    !isFieldAgg ? entitySlug : undefined,
    { comparePeriod: config.showComparison, days: config.comparisonPeriod || 30, ...dashFilters },
  );

  const fieldAgg = useFieldAggregation(
    isFieldAgg ? entitySlug : undefined,
    config.fieldSlug,
    config.aggregation,
    { comparePeriod: config.showComparison, days: config.comparisonPeriod || 30, ...dashFilters },
  );

  const isLoading = isFieldAgg ? fieldAgg.isLoading : recordCount.isLoading;
  const error = isFieldAgg ? fieldAgg.error : recordCount.error;

  let value = 0;
  let comparison: { previous: number; changePercent: number; changeAbsolute: number } | undefined;

  if (!isFieldAgg && recordCount.data) {
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
