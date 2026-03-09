'use client';

import { useEntityRecordCount, useFieldAggregation } from '@/hooks/use-dashboard-templates';
import { useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';

interface NumberCardWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function NumberCardWidget({ entitySlug, config, title, isEditMode }: NumberCardWidgetProps) {
  const dashFilters = useWidgetFilters();
  const isFieldAgg = !!config.fieldSlug && config.aggregation !== 'count';

  const recordCount = useEntityRecordCount(!isFieldAgg ? entitySlug : undefined, dashFilters);
  const fieldAgg = useFieldAggregation(
    isFieldAgg ? entitySlug : undefined,
    config.fieldSlug,
    config.aggregation,
    dashFilters,
  );

  const isLoading = isFieldAgg ? fieldAgg.isLoading : recordCount.isLoading;
  const error = isFieldAgg ? fieldAgg.error : recordCount.error;

  let value = 0;
  if (!isFieldAgg && recordCount.data) {
    value = recordCount.data.total;
  } else if (isFieldAgg && fieldAgg.data) {
    const agg = config.aggregation || 'sum';
    value = fieldAgg.data[agg as keyof typeof fieldAgg.data] as number || 0;
  }

  const formatValue = (v: number) => {
    if (config.aggregation === 'avg') {
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
      <div className="flex items-center justify-center h-full">
        <span className="text-4xl font-bold">{formatValue(value)}</span>
      </div>
    </WidgetWrapper>
  );
}
