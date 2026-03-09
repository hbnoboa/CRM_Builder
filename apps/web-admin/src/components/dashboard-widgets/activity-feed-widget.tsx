'use client';

import { Plus, Pencil } from 'lucide-react';
import { useEntityRecentActivity } from '@/hooks/use-dashboard-templates';
import { useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActivityFeedWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function ActivityFeedWidget({ entitySlug, config, title, isEditMode }: ActivityFeedWidgetProps) {
  const dashFilters = useWidgetFilters();
  const { data, isLoading, error } = useEntityRecentActivity(
    entitySlug,
    config.activityLimit || config.limit || 10,
    dashFilters,
  );

  return (
    <WidgetWrapper
      title={title}
      isEditMode={isEditMode}
      isLoading={isLoading}
      error={error ? 'Erro ao carregar dados' : null}
    >
      <div className="flex flex-col gap-2 overflow-auto h-full">
        {(data || []).map((item) => (
          <div key={item.id} className="flex items-start gap-2 text-xs">
            <div className="mt-0.5 shrink-0">
              {item.action === 'created' ? (
                <Plus className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Pencil className="h-3.5 w-3.5 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium">
                {item.userName || 'Usuario'}
              </span>{' '}
              <span className="text-muted-foreground">
                {item.action === 'created' ? 'criou' : 'atualizou'} registro
              </span>
              <div className="text-muted-foreground mt-0.5">
                {(() => {
                  try {
                    return formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true, locale: ptBR });
                  } catch {
                    return item.timestamp;
                  }
                })()}
              </div>
            </div>
          </div>
        ))}
        {(!data || data.length === 0) && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            Sem atividades recentes
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}
