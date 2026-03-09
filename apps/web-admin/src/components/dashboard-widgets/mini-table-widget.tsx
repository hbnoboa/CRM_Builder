'use client';

import { useEntityTopRecords } from '@/hooks/use-dashboard-templates';
import { useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';

interface MiniTableWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
  entityFields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function MiniTableWidget({ entitySlug, config, title, isEditMode, entityFields }: MiniTableWidgetProps) {
  const dashFilters = useWidgetFilters();
  const { data, isLoading, error } = useEntityTopRecords(entitySlug, {
    limit: config.limit || 5,
    sortBy: config.sortBy,
    sortOrder: config.sortOrder,
    fields: config.displayFields,
    ...dashFilters,
  });

  const displayFields = config.displayFields || [];
  const columns = displayFields.length > 0
    ? displayFields.map((slug) => {
        const field = entityFields?.find((f) => f.slug === slug);
        return { slug, label: field?.label || field?.name || slug };
      })
    : entityFields?.slice(0, 4).map((f) => ({ slug: f.slug, label: f.label || f.name })) || [];

  const formatCell = (value: unknown): string => {
    if (value == null) return '-';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return value.map((v) => (typeof v === 'object' && v && 'label' in v ? (v as { label: string }).label : String(v))).join(', ');
      if ('label' in (value as Record<string, unknown>)) return String((value as { label: string }).label);
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
    return String(value);
  };

  return (
    <WidgetWrapper
      title={title}
      isEditMode={isEditMode}
      isLoading={isLoading}
      error={error ? 'Erro ao carregar dados' : null}
    >
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              {columns.map((col) => (
                <th key={col.slug} className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data || []).map((record) => (
              <tr key={record.id} className="border-b last:border-0 hover:bg-muted/50">
                {columns.map((col) => (
                  <td key={col.slug} className="px-2 py-1.5 truncate max-w-[150px]">
                    {formatCell(record.data[col.slug])}
                  </td>
                ))}
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr>
                <td colSpan={columns.length} className="text-center py-4 text-muted-foreground">
                  Sem dados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </WidgetWrapper>
  );
}
