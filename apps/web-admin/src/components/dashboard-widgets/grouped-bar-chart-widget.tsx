'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useCrossFieldDistribution } from '@/hooks/use-dashboard-templates';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE, AXIS_TICK_STYLE, LEGEND_STYLE } from './chart-styles';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface GroupedBarChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function GroupedBarChartWidget({ entitySlug, config, title, isEditMode }: GroupedBarChartWidgetProps) {
  const rowField = config.groupByField || config.rowField || '';
  const colField = config.columnField || '';
  const isHorizontal = config.orientation === 'horizontal';

  const dashFilters = useWidgetFilters();
  const { data, isLoading, error } = useCrossFieldDistribution(
    entitySlug, rowField || undefined, colField || undefined, { limit: config.limit, ...dashFilters },
  );
  const { toggleCrossFilter } = useDashboardFilters();

  const colors = config.chartColors || DEFAULT_COLORS;

  const { chartData, segments } = useMemo(() => {
    if (!data?.rows || !data?.columns) return { chartData: [], segments: [] };

    const segments = data.columns.map((c) => c.value);
    const chartData = data.rows.map((row) => {
      const entry: Record<string, unknown> = { category: row.label };
      for (const col of data.columns) {
        entry[col.value] = data.matrix[row.value]?.[col.value] || 0;
      }
      return entry;
    });

    return { chartData, segments };
  }, [data]);

  if (!rowField || !colField) {
    return (
      <WidgetWrapper title={title} isEditMode={isEditMode}>
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          Clique em ⚙ e selecione os campos
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
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          onClick={(state) => {
            if (state?.activeLabel && rowField) {
              toggleCrossFilter(rowField, state.activeLabel);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          {isHorizontal ? (
            <>
              <XAxis type="number" tick={AXIS_TICK_STYLE} />
              <YAxis dataKey="category" type="category" tick={AXIS_TICK_STYLE} width={80} />
            </>
          ) : (
            <>
              <XAxis dataKey="category" tick={AXIS_TICK_STYLE} />
              <YAxis type="number" tick={AXIS_TICK_STYLE} />
            </>
          )}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(v: number) => [(v ?? 0).toLocaleString('pt-BR')]}
          />
          {config.showLegend !== false && <Legend wrapperStyle={LEGEND_STYLE} />}
          {segments.map((seg, idx) => (
            <Bar
              key={seg}
              dataKey={seg}
              fill={colors[idx % colors.length]}
              cursor="pointer"
              label={config.showValues !== false ? {
                position: 'top' as const,
                fontSize: 9,
                fill: 'hsl(var(--muted-foreground))',
                formatter: (v: number) => (v > 0 ? v.toLocaleString('pt-BR') : ''),
              } : false}
            />
          ))}
          {config.referenceLines?.map((ref, i) => (
            <ReferenceLine key={i} y={isHorizontal ? undefined : ref.value} x={isHorizontal ? ref.value : undefined}
              label={ref.label} stroke={ref.color || '#EF4444'} strokeDasharray={ref.strokeDasharray || '5 5'} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
