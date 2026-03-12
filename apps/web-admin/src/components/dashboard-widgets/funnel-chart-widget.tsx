'use client';

import { useEntityFunnel } from '@/hooks/use-dashboard-templates';
import { useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface FunnelChartWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function FunnelChartWidget({ entitySlug, config, title, isEditMode }: FunnelChartWidgetProps) {
  const fieldSlug = config.groupByField || config.fieldSlug || '';
  const dashFilters = useWidgetFilters();
  const { data, isLoading, error } = useEntityFunnel(
    entitySlug,
    fieldSlug || undefined,
    config.stages,
    dashFilters,
  );

  const colors = config.chartColors || DEFAULT_COLORS;
  const maxCount = Math.max(...(data || []).map((d) => d.count), 1);

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
      <div className="flex flex-col gap-2 h-full justify-center">
        {(data || []).map((stage, idx) => {
          const widthPercent = Math.max((stage.count / maxCount) * 100, 8);
          return (
            <div key={stage.stage} className="flex items-center gap-3">
              <div className="w-24 text-xs text-right truncate text-muted-foreground">
                {stage.label || stage.stage}
              </div>
              <div className="flex-1 relative">
                <div
                  className="h-7 rounded-sm flex items-center px-2 transition-all hover:brightness-110 hover:shadow-sm cursor-pointer"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: colors[idx % colors.length],
                    minWidth: '40px',
                  }}
                >
                  <span className="text-xs font-medium text-white whitespace-nowrap">
                    {stage.count} ({stage.percentage.toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetWrapper>
  );
}
