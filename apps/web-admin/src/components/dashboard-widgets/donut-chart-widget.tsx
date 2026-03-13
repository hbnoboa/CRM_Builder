'use client';

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAdaptedFieldDistribution as useFieldDistribution, useAdaptedGroupedData as useGroupedData } from '@/components/entity-data/adapter-hooks';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE, LEGEND_STYLE } from './chart-styles';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface DonutChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function DonutChartWidget({ entitySlug, config, title, isEditMode }: DonutChartWidgetProps) {
  const fieldSlug = config.groupByField || config.fieldSlug || '';
  const isGrouped = !!config.groupByFields?.length;
  const dashFilters = useWidgetFilters();
  const fieldDist = useFieldDistribution(!isGrouped ? entitySlug : undefined, fieldSlug || undefined, config.limit, dashFilters);
  const groupedData = useGroupedData(isGrouped ? entitySlug : undefined, config.groupByFields, {
    aggregations: config.aggregations as never,
    crossEntityCount: config.crossEntityCount,
    limit: config.limit || 20,
    sortBy: config.sortBy,
    sortOrder: config.sortOrder,
    ...dashFilters,
  });
  const { crossFilters, toggleCrossFilter } = useDashboardFilters();

  const isLoading = isGrouped ? groupedData.isLoading : fieldDist.isLoading;
  const error = isGrouped ? groupedData.error : fieldDist.error;

  // Build chart data
  let chartData: Array<{ value: string; label: string; count: number }>;
  let groupField: string;

  if (isGrouped && groupedData.data) {
    groupField = (config.groupByFields || [])[0] || '';
    // Determine which field to use as the count value
    const countAlias = config.crossEntityCount?.alias
      || config.aggregations?.find((a) => a.type === 'count')?.alias
      || 'total';
    chartData = groupedData.data
      .filter((row) => (row[countAlias] as number) > 0)
      .map((row) => {
        const label = (config.groupByFields || []).map((f) => String(row[f] || '')).join(' ');
        return { value: label, label, count: (row[countAlias] as number) || 0 };
      });
  } else {
    groupField = fieldSlug;
    chartData = fieldDist.data || [];
  }

  const colors = config.chartColors || DEFAULT_COLORS;
  const activeFilter = crossFilters.find((f) => f.fieldSlug === groupField);
  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  if (!fieldSlug && !isGrouped) {
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
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            onClick={(_, idx) => {
              const entry = chartData[idx];
              if (entry && groupField) {
                toggleCrossFilter(groupField, entry.value);
              }
            }}
            cursor="pointer"
          >
            {chartData.map((entry, idx) => (
              <Cell
                key={entry.value}
                fill={colors[idx % colors.length]}
                opacity={activeFilter && !activeFilter.values.includes(entry.value) ? 0.3 : 1}
              />
            ))}
          </Pie>
          {/* Center total */}
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground text-2xl font-bold"
          >
            {total.toLocaleString('pt-BR')}
          </text>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(v: number) => [(v ?? 0).toLocaleString('pt-BR'), title || '']}
          />
          {config.showLegend !== false && (
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={LEGEND_STYLE}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
