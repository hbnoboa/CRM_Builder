'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAdaptedRecordsOverTime as useEntityRecordsOverTime, useAdaptedFieldTrend as useFieldTrend, useAdaptedGroupedData as useGroupedData } from '@/components/entity-data/adapter-hooks';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_ITEM_STYLE, AXIS_TICK_STYLE } from './chart-styles';
import type { WidgetConfig } from '@crm-builder/shared';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Custom dot that colors by severity thresholds (green/orange/red)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SeverityDot(props: any) {
  const { cx, cy, payload, thresholds, defaultColor } = props;
  if (cx == null || cy == null) return null;
  const v = payload?.value ?? 0;
  let fill = defaultColor || '#66BB6A';
  if (thresholds) {
    if (v >= thresholds.danger) fill = '#EF5350';
    else if (v >= thresholds.warn) fill = '#FFA726';
    else fill = '#66BB6A';
  }
  return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="hsl(var(--background))" strokeWidth={1.5} />;
}

interface LineChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function LineChartWidget({ entitySlug, config, title, isEditMode }: LineChartWidgetProps) {
  const isFieldTrend = config.dataSource === 'field-trend' && !!config.fieldSlug;
  const isGroupedRatio = config.dataSource === 'grouped-ratio' && !!config.groupByFields?.length;
  const days = config.days || 30;

  const dashFilters = useWidgetFilters();
  const { crossFilters, toggleCrossFilter, dateRange, setDateRange } = useDashboardFilters();

  const recordsOverTime = useEntityRecordsOverTime(
    !isFieldTrend && !isGroupedRatio ? entitySlug : undefined,
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

  const groupedData = useGroupedData(
    isGroupedRatio ? entitySlug : undefined,
    config.groupByFields,
    {
      aggregations: config.aggregations as never,
      crossEntityCount: config.crossEntityCount,
      limit: config.limit || 50,
      sortBy: config.sortBy,
      sortOrder: config.sortOrder,
      ...dashFilters,
    },
  );

  const isLoading = isGroupedRatio ? groupedData.isLoading : isFieldTrend ? fieldTrend.isLoading : recordsOverTime.isLoading;
  const error = isGroupedRatio ? groupedData.error : isFieldTrend ? fieldTrend.error : recordsOverTime.error;

  // Compute chart data based on mode
  let data: Array<{ date: string; value: number; _rowIndex?: number }>;
  let isGroupedMode = false;

  if (isGroupedRatio && groupedData.data) {
    isGroupedMode = true;
    const computedCols = config.computedColumns || [];
    const percentageCol = computedCols.find((c) => c.type === 'percentage');

    data = groupedData.data.map((row, idx) => {
      const label = (config.groupByFields || []).map((f) => String(row[f] || '')).join(' ');
      let value = 0;

      if (percentageCol?.fieldA && percentageCol?.fieldB) {
        const a = typeof row[percentageCol.fieldA] === 'number' ? row[percentageCol.fieldA] as number : parseFloat(String(row[percentageCol.fieldA]));
        const b = typeof row[percentageCol.fieldB] === 'number' ? row[percentageCol.fieldB] as number : parseFloat(String(row[percentageCol.fieldB]));
        if (!isNaN(a) && !isNaN(b) && b > 0) value = (a / b) * 100;
      } else if (config.fieldSlug && row[config.fieldSlug] !== undefined) {
        value = typeof row[config.fieldSlug] === 'number' ? row[config.fieldSlug] as number : parseFloat(String(row[config.fieldSlug]));
      }

      return { date: label, value: Math.round(value * 10) / 10, _rowIndex: idx };
    });
  } else if (isFieldTrend) {
    data = (fieldTrend.data || []).map((d) => ({ date: d.date, value: d.value }));
  } else {
    data = (recordsOverTime.data || []).map((d) => ({ date: d.date, value: d.count }));
  }

  const color = config.chartColor || '#3B82F6';

  return (
    <WidgetWrapper
      title={title}
      isEditMode={isEditMode}
      isLoading={isLoading}
      error={error ? 'Erro ao carregar dados' : null}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => {
              if (isGroupedMode) return v;
              try { return format(parseISO(v), 'dd/MM', { locale: ptBR }); } catch { return v; }
            }}
            tick={AXIS_TICK_STYLE}
            interval={isGroupedMode ? 0 : undefined}
            angle={isGroupedMode ? -30 : 0}
            textAnchor={isGroupedMode ? 'end' : 'middle'}
            height={isGroupedMode ? 60 : 30}
          />
          <YAxis
            tick={AXIS_TICK_STYLE}
            width={40}
            tickFormatter={isGroupedMode ? (v) => `${v}%` : undefined}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelFormatter={(v) => {
              if (isGroupedMode) return v as string;
              try { return format(parseISO(v as string), 'dd MMM yyyy', { locale: ptBR }); } catch { return v as string; }
            }}
            formatter={(v: number) => [
              isGroupedMode ? `${(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : (v ?? 0).toLocaleString('pt-BR'),
              title || '',
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={isGroupedMode
              ? config.thresholds
                ? <SeverityDot thresholds={config.thresholds} defaultColor={color} />
                : { r: 4, fill: color }
              : false
            }
            activeDot={{
              r: 5,
              cursor: 'pointer',
              onClick: (_: unknown, payload: { payload?: { date?: string; _rowIndex?: number } }) => {
                if (isEditMode || !payload?.payload?.date) return;
                const clickedDate = payload.payload.date;
                if (isGroupedMode) {
                  // Grouped mode: emit cross-filter for ALL groupBy fields using original row data
                  const groupFields = config.groupByFields || [];
                  const rowIdx = payload.payload._rowIndex;
                  const row = rowIdx != null ? groupedData.data?.[rowIdx] : undefined;
                  if (row && groupFields.length > 0) {
                    for (const field of groupFields) {
                      const fieldValue = String(row[field] || '');
                      if (fieldValue) toggleCrossFilter(field, fieldValue);
                    }
                  }
                  return;
                }
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
        </LineChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
