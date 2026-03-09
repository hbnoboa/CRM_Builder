'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useEntityRecordsOverTime, useFieldTrend } from '@/hooks/use-dashboard-templates';
import { useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

interface AreaChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function AreaChartWidget({ entitySlug, config, title, isEditMode }: AreaChartWidgetProps) {
  const dashFilters = useWidgetFilters();
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
            className="text-xs"
            tick={{ fontSize: 10 }}
          />
          <YAxis className="text-xs" tick={{ fontSize: 10 }} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => {
              try { return format(parseISO(v as string), 'dd MMM yyyy', { locale: ptBR }); } catch { return v as string; }
            }}
            formatter={(v: number) => [(v ?? 0).toLocaleString('pt-BR'), isFieldTrend ? 'Valor' : 'Registros']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`url(#gradient-${color})`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
