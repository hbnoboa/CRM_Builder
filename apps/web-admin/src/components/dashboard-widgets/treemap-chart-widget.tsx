'use client';

import { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { useAdaptedFieldDistribution as useFieldDistribution } from '@/components/entity-data/adapter-hooks';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE } from './chart-styles';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface TreemapChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomContent(props: any) {
  const { x, y, width, height, name, value, fill } = props;
  if (width <= 0 || height <= 0) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        className="cursor-pointer hover:brightness-110 transition-all"
      />
      {width > 50 && height > 30 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="#fff"
            fontSize={11}
            fontWeight={500}
          >
            {String(name).length > 14 ? String(name).slice(0, 14) + '…' : name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="rgba(255,255,255,0.8)"
            fontSize={10}
          >
            {Number(value).toLocaleString('pt-BR')}
          </text>
        </>
      )}
    </g>
  );
}

export function TreemapChartWidget({ entitySlug, config, title, isEditMode }: TreemapChartWidgetProps) {
  const fieldSlug = config.groupByField || config.fieldSlug || '';
  const dashFilters = useWidgetFilters();
  const { data, isLoading, error } = useFieldDistribution(entitySlug, fieldSlug || undefined, config.limit, dashFilters);
  const { crossFilters, toggleCrossFilter } = useDashboardFilters();

  const colors = config.chartColors || DEFAULT_COLORS;

  const treemapData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, idx) => ({
      name: item.label,
      value: item.count,
      fill: colors[idx % colors.length],
      originalValue: item.value,
    }));
  }, [data, colors]);

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
        <Treemap
          data={treemapData}
          dataKey="value"
          aspectRatio={4 / 3}
          stroke="hsl(var(--background))"
          onClick={(node: { originalValue?: string }) => {
            if (fieldSlug && node?.originalValue) {
              toggleCrossFilter(fieldSlug, node.originalValue);
            }
          }}
          content={<CustomContent />}
          isAnimationActive={false}
        >
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(v: number) => [(v ?? 0).toLocaleString('pt-BR'), title || '']}
          />
        </Treemap>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
