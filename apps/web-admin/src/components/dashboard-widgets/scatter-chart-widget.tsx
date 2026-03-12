'use client';

import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useCrossFieldDistribution } from '@/hooks/use-dashboard-templates';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import { TOOLTIP_STYLE, AXIS_TICK_STYLE } from './chart-styles';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface ScatterChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

interface ScatterPoint {
  x: number;
  y: number;
  z: number;
  xLabel: string;
  yLabel: string;
}

export function ScatterChartWidget({ entitySlug, config, title, isEditMode }: ScatterChartWidgetProps) {
  const rowField = config.rowField || '';
  const colField = config.columnField || '';

  const dashFilters = useWidgetFilters();
  const { data, isLoading, error } = useCrossFieldDistribution(
    entitySlug, rowField || undefined, colField || undefined, { limit: config.limit, ...dashFilters },
  );
  const { toggleCrossFilter } = useDashboardFilters();

  const colors = config.chartColors || DEFAULT_COLORS;

  const { points, rowLabels, colLabels } = useMemo(() => {
    if (!data?.rows || !data?.columns) return { points: [] as ScatterPoint[], rowLabels: [] as string[], colLabels: [] as string[] };

    const rowLabels = data.rows.map((r) => r.label);
    const colLabels = data.columns.map((c) => c.label);
    const points: ScatterPoint[] = [];

    data.rows.forEach((row, ri) => {
      data.columns.forEach((col, ci) => {
        const count = data.matrix[row.value]?.[col.value] || 0;
        if (count > 0) {
          points.push({ x: ri, y: ci, z: count, xLabel: row.label, yLabel: col.label });
        }
      });
    });

    return { points, rowLabels, colLabels };
  }, [data]);

  if (!rowField || !colField) {
    return (
      <WidgetWrapper title={title} isEditMode={isEditMode}>
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          Clique em ⚙ e selecione os campos (eixo X e Y)
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
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            type="number"
            dataKey="x"
            name={rowField}
            tick={AXIS_TICK_STYLE}
            domain={[-0.5, rowLabels.length - 0.5]}
            ticks={rowLabels.map((_, i) => i)}
            tickFormatter={(v: number) => {
              const label = rowLabels[v];
              return label && label.length > 10 ? label.slice(0, 10) + '…' : (label || '');
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={colField}
            tick={AXIS_TICK_STYLE}
            domain={[-0.5, colLabels.length - 0.5]}
            ticks={colLabels.map((_, i) => i)}
            tickFormatter={(v: number) => {
              const label = colLabels[v];
              return label && label.length > 10 ? label.slice(0, 10) + '…' : (label || '');
            }}
            width={80}
          />
          <ZAxis type="number" dataKey="z" range={[40, 400]} name="Quantidade" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => {
              if (name === 'Quantidade') return [value.toLocaleString('pt-BR'), name];
              return [value, name];
            }}
            labelFormatter={() => ''}
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const p = payload[0]?.payload as ScatterPoint | undefined;
              if (!p) return null;
              return (
                <div style={TOOLTIP_STYLE} className="text-xs">
                  <p style={{ color: 'hsl(var(--card-foreground))' }} className="font-medium">{p.xLabel} × {p.yLabel}</p>
                  <p style={{ color: 'hsl(var(--muted-foreground))' }}>{p.z.toLocaleString('pt-BR')} registros</p>
                </div>
              );
            }}
          />
          <Scatter
            data={points}
            fill={colors[0]}
            cursor="pointer"
            onClick={(point: ScatterPoint) => {
              if (rowField && point?.xLabel) {
                toggleCrossFilter(rowField, data?.rows.find((r) => r.label === point.xLabel)?.value || point.xLabel);
              }
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
