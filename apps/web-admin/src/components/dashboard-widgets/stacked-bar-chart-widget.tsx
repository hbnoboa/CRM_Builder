'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useAdaptedCrossFieldDistribution as useCrossFieldDistribution, useAdaptedGroupedData as useGroupedData } from '@/components/entity-data/adapter-hooks';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE, AXIS_TICK_STYLE, LEGEND_STYLE } from './chart-styles';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface StackedBarChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function StackedBarChartWidget({ entitySlug, config, title, isEditMode }: StackedBarChartWidgetProps) {
  const isGroupedMode = !!(config.groupByFields && config.groupByFields.length > 0);
  const rowField = config.groupByField || config.rowField || '';
  const colField = config.columnField || '';
  const isHorizontal = config.orientation === 'horizontal';

  const dashFilters = useWidgetFilters();
  const { crossFilters, toggleCrossFilter } = useDashboardFilters();

  // Cross-field mode (original)
  const crossResult = useCrossFieldDistribution(
    isGroupedMode ? undefined : entitySlug,
    rowField || undefined,
    colField || undefined,
    { limit: config.limit, ...dashFilters },
  );

  // Grouped mode
  const groupedResult = useGroupedData(
    isGroupedMode ? entitySlug : undefined,
    isGroupedMode ? config.groupByFields : undefined,
    isGroupedMode ? {
      aggregations: config.aggregations,
      crossEntityCount: config.crossEntityCount,
      limit: config.limit,
      sortBy: config.sortBy,
      sortOrder: config.sortOrder,
      ...dashFilters,
    } : undefined,
  );

  const data = isGroupedMode ? groupedResult.data : crossResult.data;
  const isLoading = isGroupedMode ? groupedResult.isLoading : crossResult.isLoading;
  const error = isGroupedMode ? groupedResult.error : crossResult.error;

  const colors = config.chartColors || DEFAULT_COLORS;

  // Determine stacked bar segments from config
  const stackedFields = useMemo(() => {
    if (!isGroupedMode) return [] as string[];
    const fields: string[] = [];
    if (config.aggregations) {
      for (const agg of config.aggregations) {
        fields.push(agg.alias);
      }
    }
    if (config.crossEntityCount?.alias) {
      fields.push(config.crossEntityCount.alias);
    }
    return fields;
  }, [isGroupedMode, config.aggregations, config.crossEntityCount]);

  // Transform data for Recharts
  const { chartData, segments } = useMemo(() => {
    if (isGroupedMode) {
      if (!data || !Array.isArray(data) || data.length === 0) return { chartData: [], segments: [] };

      const groupByFields: string[] = config.groupByFields || [];
      const chartData = (data as Record<string, unknown>[]).map((row) => {
        const label = groupByFields.map((f) => row[f] ?? '').join(' / ');
        const entry: Record<string, unknown> = { category: label };
        for (const field of stackedFields) {
          entry[field] = typeof row[field] === 'number' ? row[field] : 0;
        }
        return entry;
      });

      return { chartData, segments: stackedFields };
    }

    // Cross-field mode (original)
    const crossData = data as { rows: { value: string; label: string }[]; columns: { value: string; label: string }[]; matrix: Record<string, Record<string, number>> } | undefined;
    if (!crossData?.rows || !crossData?.columns) return { chartData: [], segments: [] };

    const segments = crossData.columns.map((c) => c.value);
    const chartData = crossData.rows.map((row) => {
      const entry: Record<string, unknown> = { category: row.label };
      for (const col of crossData.columns) {
        entry[col.value] = crossData.matrix[row.value]?.[col.value] || 0;
      }
      return entry;
    });

    return { chartData, segments };
  }, [data, isGroupedMode, config.groupByFields, stackedFields]);

  const needsConfig = isGroupedMode
    ? !config.groupByFields?.length || (!config.aggregations?.length && !config.crossEntityCount)
    : !rowField || !colField;

  if (needsConfig) {
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
              stackId="stack"
              fill={colors[idx % colors.length]}
              cursor="pointer"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
