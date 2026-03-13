'use client';

import { useMemo } from 'react';
import { useAdaptedCrossFieldDistribution as useCrossFieldDistribution } from '@/components/entity-data/adapter-hooks';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_SCALE = ['#F0F4F8', '#C6DBEF', '#6BAED6', '#2171B5', '#08306B'];

interface HeatmapChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

function interpolateColor(colors: string[], ratio: number): string {
  if (colors.length === 0) return '#ccc';
  if (ratio <= 0) return colors[0];
  if (ratio >= 1) return colors[colors.length - 1];

  const segment = ratio * (colors.length - 1);
  const idx = Math.floor(segment);
  const t = segment - idx;

  const c1 = hexToRgb(colors[idx]);
  const c2 = hexToRgb(colors[Math.min(idx + 1, colors.length - 1)]);
  if (!c1 || !c2) return colors[0];

  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function textColorForBg(bgColor: string): string {
  const m = bgColor.match(/\d+/g);
  if (!m || m.length < 3) return '#000';
  const luminance = (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

export function HeatmapChartWidget({ entitySlug, config, title, isEditMode }: HeatmapChartWidgetProps) {
  const rowField = config.rowField || '';
  const colField = config.columnField || '';
  const showValues = config.showValues !== false;

  const dashFilters = useWidgetFilters();
  const { data, isLoading, error } = useCrossFieldDistribution(
    entitySlug, rowField || undefined, colField || undefined, { limit: config.limit, ...dashFilters },
  );
  const { crossFilters, toggleCrossFilter } = useDashboardFilters();

  const colorScale = config.colorScale || DEFAULT_SCALE;
  const activeFilter = crossFilters.find((f) => f.fieldSlug === rowField);

  const cells = useMemo(() => {
    if (!data?.rows || !data?.columns) return { rows: [], columns: [], values: {} as Record<string, Record<string, number>> };
    return { rows: data.rows, columns: data.columns, values: data.matrix };
  }, [data]);

  if (!rowField || !colField) {
    return (
      <WidgetWrapper title={title} isEditMode={isEditMode}>
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          Clique em ⚙ e selecione os campos (linhas e colunas)
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
      <div className="overflow-auto h-full">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1.5 border border-border bg-muted text-left sticky left-0 z-10 min-w-[80px] text-muted-foreground" />
              {cells.columns.map((col) => (
                <th key={col.value} className="p-1.5 border border-border bg-muted font-medium text-center min-w-[60px] text-muted-foreground">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.rows.map((row) => {
              const isActive = activeFilter?.values.includes(row.value) ?? false;
              return (
                <tr
                  key={row.value}
                  className={`cursor-pointer transition-all hover:brightness-110 hover:shadow-sm ${isActive ? 'ring-2 ring-primary ring-inset' : ''}`}
                  onClick={() => rowField && toggleCrossFilter(rowField, row.value)}
                >
                  <td className="p-1.5 border border-border bg-muted font-medium sticky left-0 z-10 text-muted-foreground">
                    {row.label}
                  </td>
                  {cells.columns.map((col) => {
                    const value = cells.values[row.value]?.[col.value] || 0;
                    const ratio = data?.maxValue ? value / data.maxValue : 0;
                    const bg = interpolateColor(colorScale, ratio);
                    const textColor = textColorForBg(bg);

                    return (
                      <td
                        key={col.value}
                        className="p-1.5 border border-border text-center tabular-nums"
                        style={{ backgroundColor: bg, color: textColor }}
                      >
                        {showValues ? (value > 0 ? value.toLocaleString('pt-BR') : '\u2014') : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </WidgetWrapper>
  );
}
