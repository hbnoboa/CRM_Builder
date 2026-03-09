'use client';

import { X, FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardFilters } from './dashboard-filter-context';

interface DashboardFilterBarProps {
  entityFields?: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function DashboardFilterBar({ entityFields }: DashboardFilterBarProps) {
  const {
    crossFilters,
    slicerFilters,
    dateRange,
    removeCrossFilter,
    removeSlicerFilter,
    setDateRange,
    clearAllFilters,
  } = useDashboardFilters();

  const hasFilters = crossFilters.length > 0 || slicerFilters.length > 0 || !!dateRange;

  if (!hasFilters) return null;

  const getFieldLabel = (fieldSlug: string) => {
    const field = entityFields?.find((f) => f.slug === fieldSlug);
    return field?.label || field?.name || fieldSlug;
  };

  const formatSlicerValue = (filter: { operator: string; value: unknown }): string => {
    if (filter.operator === 'range') {
      const range = filter.value as { min?: number; max?: number };
      if (range.min !== undefined && range.max !== undefined) return `${range.min} - ${range.max}`;
      if (range.min !== undefined) return `>= ${range.min}`;
      if (range.max !== undefined) return `<= ${range.max}`;
    }
    if (filter.operator === 'relative') {
      const labels: Record<string, string> = {
        last7days: 'Ultimos 7 dias',
        last30days: 'Ultimos 30 dias',
        last90days: 'Ultimos 90 dias',
        thisMonth: 'Este mes',
        thisQuarter: 'Este trimestre',
        thisYear: 'Este ano',
      };
      return labels[filter.value as string] || String(filter.value);
    }
    return String(filter.value);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap mb-3 px-1">
      <span className="text-xs font-medium text-muted-foreground">Filtros:</span>

      {crossFilters.map((cf) => (
        <Badge
          key={`cross-${cf.fieldSlug}`}
          variant="secondary"
          className="gap-1 text-xs cursor-pointer hover:bg-secondary/80"
          onClick={() => removeCrossFilter(cf.fieldSlug)}
        >
          {getFieldLabel(cf.fieldSlug)} = {cf.value}
          <X className="h-3 w-3" />
        </Badge>
      ))}

      {slicerFilters.map((sf) => (
        <Badge
          key={`slicer-${sf.fieldSlug}`}
          variant="secondary"
          className="gap-1 text-xs cursor-pointer hover:bg-secondary/80"
          onClick={() => removeSlicerFilter(sf.fieldSlug)}
        >
          {getFieldLabel(sf.fieldSlug)}: {formatSlicerValue(sf)}
          <X className="h-3 w-3" />
        </Badge>
      ))}

      {dateRange && (
        <Badge
          variant="secondary"
          className="gap-1 text-xs cursor-pointer hover:bg-secondary/80"
          onClick={() => setDateRange(undefined)}
        >
          {dateRange.start} a {dateRange.end}
          <X className="h-3 w-3" />
        </Badge>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={clearAllFilters}
      >
        <FilterX className="h-3 w-3 mr-1" />
        Limpar tudo
      </Button>
    </div>
  );
}
