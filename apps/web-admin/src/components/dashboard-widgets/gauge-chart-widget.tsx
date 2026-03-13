'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useAdaptedFieldAggregation as useFieldAggregation } from '@/components/entity-data/adapter-hooks';
import { useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';

interface GaugeChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function GaugeChartWidget({ entitySlug, config, title, isEditMode }: GaugeChartWidgetProps) {
  const dashFilters = useWidgetFilters();
  const { data, isLoading, error } = useFieldAggregation(
    entitySlug,
    config.fieldSlug,
    config.aggregation,
    dashFilters,
  );

  const min = config.gaugeMin ?? 0;
  const max = config.gaugeMax ?? 100;
  const target = config.gaugeTarget;
  const agg = config.aggregation || 'sum';
  const rawValue = data ? (data[agg as keyof typeof data] as number || 0) : 0;
  const value = Math.min(Math.max(rawValue, min), max);
  const percentage = ((value - min) / (max - min)) * 100;

  const gaugeData = [
    { value: percentage },
    { value: 100 - percentage },
  ];

  const getColor = () => {
    if (config.thresholds) {
      if (rawValue >= config.thresholds.danger) return '#EF4444';
      if (rawValue >= config.thresholds.warn) return '#F59E0B';
    }
    return '#3B82F6';
  };

  if (!config.fieldSlug) {
    return (
      <WidgetWrapper title={title} isEditMode={isEditMode}>
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          Clique em ⚙ e selecione o campo
        </div>
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper
      title={title}
      isEditMode={isEditMode}
      isLoading={isLoading}
      error={error ? 'Erro ao carregar dados' : null}
    >
      <div className="flex flex-col items-center justify-center h-full">
        <ResponsiveContainer width="100%" height="70%">
          <PieChart>
            <Pie
              data={gaugeData}
              startAngle={200}
              endAngle={-20}
              innerRadius="65%"
              outerRadius="90%"
              dataKey="value"
              stroke="none"
            >
              <Cell fill={getColor()} />
              <Cell fill="hsl(var(--muted))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="text-center -mt-4">
          <span className="text-2xl font-bold">{(rawValue ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span>
          {target !== undefined && (
            <span className="text-xs text-muted-foreground ml-1">/ {(target ?? 0).toLocaleString('pt-BR')}</span>
          )}
        </div>
      </div>
    </WidgetWrapper>
  );
}
