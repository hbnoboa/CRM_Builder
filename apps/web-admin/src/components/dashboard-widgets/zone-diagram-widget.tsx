'use client';

import { useMemo } from 'react';
import { useAdaptedFieldDistribution as useFieldDistribution } from '@/components/entity-data/adapter-hooks';
import { useDashboardFilters, useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';

const DEFAULT_ZONE_LABELS: Record<string, string> = {
  q1: 'Frente Esq', q2: 'Frente Centro', q3: 'Frente Dir',
  q4: 'Meio Esq', q5: 'Meio Centro', q6: 'Meio Dir',
  q7: 'Tras Esq', q8: 'Tras Centro', q9: 'Tras Dir',
};

const ZONE_ORDER = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9'];

interface ZoneDiagramWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function ZoneDiagramWidget({ entitySlug, config, title, isEditMode }: ZoneDiagramWidgetProps) {
  const zoneField = config.zoneField || config.groupByField || config.fieldSlug || '';
  const dashFilters = useWidgetFilters();
  const { crossFilters, toggleCrossFilter } = useDashboardFilters();
  const { data, isLoading, error } = useFieldDistribution(entitySlug, zoneField || undefined, 20, dashFilters);

  const labels = config.zoneLabels || DEFAULT_ZONE_LABELS;
  const activeFilter = crossFilters.find((f) => f.fieldSlug === zoneField);

  const zones = useMemo(() => {
    if (!data) return [];

    // Build a map of value -> count from distribution data
    const countMap = new Map<string, number>();
    for (const item of data) {
      countMap.set(item.value?.toLowerCase(), item.count);
    }

    // Determine which zone keys to use — either ZONE_ORDER or actual values from data
    const keys = ZONE_ORDER.some((k) => countMap.has(k))
      ? ZONE_ORDER
      : data.slice(0, 9).map((d) => d.value);

    const maxCount = Math.max(...data.map((d) => d.count), 1);

    return keys.map((key) => {
      const count = countMap.get(key?.toLowerCase()) || countMap.get(key) || 0;
      const label = labels[key] || labels[key?.toLowerCase()] || data.find((d) => d.value === key)?.label || key;
      const intensity = count / maxCount;
      return { key, label, count, intensity };
    });
  }, [data, labels]);

  if (!zoneField) {
    return (
      <WidgetWrapper title={title} isEditMode={isEditMode}>
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          Clique em ⚙ e selecione o campo de quadrante
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
      <div className="flex items-center justify-center h-full">
        <div className="grid grid-cols-3 gap-1.5 w-full max-w-[280px]">
          {zones.map((zone) => (
            <button
              type="button"
              key={zone.key}
              onClick={() => !isEditMode && zoneField && toggleCrossFilter(zoneField, zone.key)}
              className="border rounded-md p-2 text-center transition-colors cursor-pointer hover:opacity-80"
              style={{
                opacity: activeFilter && activeFilter.value !== zone.key ? 0.35 : 1,
                backgroundColor: zone.count > 0
                  ? `rgba(239, 68, 68, ${0.08 + zone.intensity * 0.25})`
                  : 'hsl(var(--muted) / 0.1)',
                borderColor: zone.count > 0
                  ? `rgba(239, 68, 68, ${0.3 + zone.intensity * 0.4})`
                  : 'hsl(var(--border))',
              }}
            >
              <div className="text-[10px] text-muted-foreground truncate">{zone.label}</div>
              <div className={`text-lg font-bold ${zone.count > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {zone.count}
              </div>
            </button>
          ))}
        </div>
      </div>
    </WidgetWrapper>
  );
}
