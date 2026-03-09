'use client';

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useFieldDistribution } from '@/hooks/use-dashboard-templates';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

interface PieChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function PieChartWidget({ entitySlug, config, title, isEditMode }: PieChartWidgetProps) {
  const fieldSlug = config.groupByField || config.fieldSlug || '';
  const dashFilters = useWidgetFilters({ excludeField: fieldSlug });
  const { data, isLoading, error } = useFieldDistribution(entitySlug, fieldSlug || undefined, config.limit, dashFilters);
  const { crossFilters, toggleCrossFilter } = useDashboardFilters();

  const colors = config.chartColors || DEFAULT_COLORS;
  const activeFilter = crossFilters.find((f) => f.fieldSlug === fieldSlug);

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
        <PieChart>
          <Pie
            data={data || []}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            paddingAngle={2}
            onClick={(_, idx) => {
              const entry = (data || [])[idx];
              if (entry && fieldSlug) {
                toggleCrossFilter(fieldSlug, entry.value);
              }
            }}
            cursor="pointer"
          >
            {(data || []).map((entry, idx) => (
              <Cell
                key={entry.value}
                fill={colors[idx % colors.length]}
                opacity={activeFilter && activeFilter.value !== entry.value ? 0.3 : 1}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number) => [(v ?? 0).toLocaleString('pt-BR'), 'Registros']}
          />
          {config.showLegend !== false && (
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ fontSize: 11 }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </WidgetWrapper>
  );
}
