'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { useAdaptedFieldDistribution as useFieldDistribution } from '@/components/entity-data/adapter-hooks';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE, AXIS_TICK_STYLE } from './chart-styles';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface BarChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function BarChartWidget({ entitySlug, config, title, isEditMode }: BarChartWidgetProps) {
  const fieldSlug = config.groupByField || config.fieldSlug || '';
  const dashFilters = useWidgetFilters();
  const { data, isLoading, error } = useFieldDistribution(entitySlug, fieldSlug || undefined, config.limit, dashFilters);
  const { crossFilters, toggleCrossFilter } = useDashboardFilters();

  const colors = config.chartColors || DEFAULT_COLORS;
  const activeFilter = crossFilters.find((f) => f.fieldSlug === fieldSlug);
  const total = (data || []).reduce((sum, d) => sum + d.count, 0);

  const handleClick = (entry: { value: string }) => {
    if (fieldSlug) {
      toggleCrossFilter(fieldSlug, entry.value);
    }
  };

  if (!fieldSlug) {
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
        <BarChart data={data || []} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" tick={AXIS_TICK_STYLE} />
          <YAxis
            dataKey="label"
            type="category"
            tick={AXIS_TICK_STYLE}
            width={80}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(v: number) => [(v ?? 0).toLocaleString('pt-BR'), title || '']}
          />
          <Bar
            dataKey="count"
            cursor="pointer"
            onClick={(_: unknown, idx: number) => {
              const entry = (data || [])[idx];
              if (entry) handleClick(entry);
            }}
            label={config.showRatio && total > 0 ? {
              position: 'right' as const,
              fontSize: 9,
              fill: 'hsl(var(--muted-foreground))',
              formatter: (v: number) => {
                const pct = ((v / total) * 100).toFixed(0);
                return `${v}/${total} (${pct}%)`;
              },
            } : false}
          >
            {(data || []).map((entry, idx) => (
              <Cell
                key={entry.value}
                fill={colors[idx % colors.length]}
                opacity={activeFilter && !activeFilter.values.includes(entry.value) ? 0.3 : 1}
              />
            ))}
          </Bar>
          {config.referenceLines?.map((ref, i) => (
            <ReferenceLine key={i} x={ref.value} label={ref.label}
              stroke={ref.color || '#EF4444'} strokeDasharray={ref.strokeDasharray || '5 5'} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
