'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAdaptedRecordsOverTime as useEntityRecordsOverTime, useAdaptedFieldTrend as useFieldTrend } from '@/components/entity-data/adapter-hooks';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE, AXIS_TICK_STYLE } from './chart-styles';
import type { WidgetConfig } from '@crm-builder/shared';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AreaChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function AreaChartWidget({ entitySlug, config, title, isEditMode }: AreaChartWidgetProps) {
  const dashFilters = useWidgetFilters();
  const { dateRange, setDateRange } = useDashboardFilters();
  const isFieldTrend = config.dataSource === 'field-trend' && !!config.fieldSlug;
  const days = config.days || 30;

  const recordsOverTime = useEntityRecordsOverTime(
    !isFieldTrend ? entitySlug : undefined,
    days,
    dashFilters,
  );

  const fieldTrend = useFieldTrend(
    isFieldTrend ? entitySlug : undefined,
    config.fieldSlug,
    config.aggregation,
    days,
    dashFilters,
  );

  const isLoading = isFieldTrend ? fieldTrend.isLoading : recordsOverTime.isLoading;
  const error = isFieldTrend ? fieldTrend.error : recordsOverTime.error;

  const data = isFieldTrend
    ? (fieldTrend.data || []).map((d) => ({ date: d.date, value: d.value }))
    : (recordsOverTime.data || []).map((d) => ({ date: d.date, value: d.count }));

  const color = config.chartColor || '#3B82F6';

  return (
    <WidgetWrapper
      title={title}
      isEditMode={isEditMode}
      isLoading={isLoading}
      error={error ? 'Erro ao carregar dados' : null}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => {
              try { return format(parseISO(v), 'dd/MM', { locale: ptBR }); } catch { return v; }
            }}
            tick={AXIS_TICK_STYLE}
          />
          <YAxis tick={AXIS_TICK_STYLE} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelFormatter={(v) => {
              try { return format(parseISO(v as string), 'dd MMM yyyy', { locale: ptBR }); } catch { return v as string; }
            }}
            formatter={(v: number) => [(v ?? 0).toLocaleString('pt-BR'), title || '']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`url(#gradient-${color})`}
            strokeWidth={2}
            activeDot={{
              r: 5,
              cursor: 'pointer',
              onClick: (_: unknown, payload: { payload?: { date?: string } }) => {
                if (isEditMode || !payload?.payload?.date) return;
                const clickedDate = payload.payload.date;
                if (dateRange?.start === clickedDate && dateRange?.end === clickedDate) {
                  setDateRange(undefined);
                } else {
                  setDateRange({ start: clickedDate, end: clickedDate });
                }
              },
            }}
          />
          {config.referenceLines?.map((ref, i) => (
            <ReferenceLine key={i} y={ref.value} label={ref.label}
              stroke={ref.color || '#EF4444'} strokeDasharray={ref.strokeDasharray || '5 5'} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
