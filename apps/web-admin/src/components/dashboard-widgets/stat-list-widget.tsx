'use client';

import { useFieldDistribution } from '@/hooks/use-dashboard-templates';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface StatListWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function StatListWidget({ entitySlug, config, title, isEditMode }: StatListWidgetProps) {
  const fieldSlug = config.groupByField || config.fieldSlug || '';
  const listStyle = config.listStyle || 'simple';
  const suffix = config.valueSuffix || '';
  const colors = config.chartColors || DEFAULT_COLORS;
  const showTotal = config.showTotal ?? false;

  const dashFilters = useWidgetFilters();
  const { data, isLoading, error } = useFieldDistribution(entitySlug, fieldSlug || undefined, config.limit, dashFilters);
  const { crossFilters, toggleCrossFilter } = useDashboardFilters();

  const activeFilter = crossFilters.find((f) => f.fieldSlug === fieldSlug);

  const totalCount = (data || []).reduce((sum, item) => sum + item.count, 0);

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
      <div className="flex flex-col gap-2 h-full overflow-auto p-1">
        {/* Total count header */}
        {showTotal && (
          <div className="text-center flex-shrink-0 pb-1">
            <div className="text-3xl font-bold text-destructive">{totalCount.toLocaleString('pt-BR')}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              total
            </div>
          </div>
        )}

        {/* Breakdown list */}
        {(data || []).map((item, idx) => {
          const isActive = activeFilter?.values.includes(item.value) ?? false;
          const color = colors[idx % colors.length];

          return (
            <button
              key={item.value}
              type="button"
              className={`flex items-center gap-2 text-left transition-all rounded-md px-2 py-1.5 hover:bg-accent/50 ${
                isActive ? 'ring-1 ring-primary bg-accent/30' : ''
              } ${activeFilter && !isActive ? 'opacity-40' : ''}`}
              onClick={() => !isEditMode && fieldSlug && toggleCrossFilter(fieldSlug, item.value)}
            >
              {listStyle === 'ranked' && (
                <span className="text-[10px] text-muted-foreground font-medium w-5 shrink-0">
                  #{idx + 1}
                </span>
              )}

              {(listStyle === 'colored' || showTotal) && (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
              )}

              <span className="flex-1 text-xs truncate">
                {item.label}
              </span>

              <span
                className="text-xs font-semibold tabular-nums shrink-0"
                style={listStyle === 'colored' || showTotal ? { color } : undefined}
              >
                {item.count.toLocaleString('pt-BR')}
                {suffix ? ` ${suffix}` : ''}
              </span>
            </button>
          );
        })}

        {(!data || data.length === 0) && !isLoading && (
          <div className="text-center text-xs text-muted-foreground py-4">
            Sem dados
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}
