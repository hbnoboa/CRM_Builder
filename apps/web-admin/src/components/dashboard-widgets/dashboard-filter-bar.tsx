'use client';

import { useMemo, useState } from 'react';
import { X, FilterX, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardFilters } from './dashboard-filter-context';
import { useEntities } from '@/hooks/use-entities';
import { cn } from '@/lib/utils';

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

  const [expanded, setExpanded] = useState(false);
  // Nome da tabela e rotulo da opcao no lugar dos codigos (ordens-servico, cancelada)
  const { data: entitiesPage } = useEntities({ limit: 200 });
  const entities = entitiesPage?.data || [];
  const entityName = (slug: string) => entities.find((e) => e.slug === slug)?.name ?? slug;
  const valueLabel = (entitySlug: string | undefined, fieldSlug: string, value: string) => {
    const slug = fieldSlug.split('.').pop() || fieldSlug;
    const fields = (entities.find((e) => e.slug === entitySlug)?.fields || entityFields || []) as Array<{ slug: string; type: string; options?: unknown[] }>;
    const field = fields.find((f) => f.slug === slug);
    if (field?.type === 'boolean') return value === 'true' ? 'Sim' : value === 'false' ? 'Não' : value;
    const opt = (field?.options || []).find((o) => (typeof o === 'string' ? o : (o as { value: string }).value) === value);
    return opt ? (typeof opt === 'string' ? opt : (opt as { label: string }).label) : value;
  };

  const hasFilters = crossFilters.length > 0 || slicerFilters.length > 0 || !!dateRange;
  const totalCount = crossFilters.length + slicerFilters.length + (dateRange ? 1 : 0);

  const getFieldLabel = (fieldSlug: string) => {
    // Strip parent./child.X. prefix for display
    let slug = fieldSlug;
    if (slug.startsWith('parent.')) slug = slug.slice(7);
    else if (slug.startsWith('child.')) {
      const parts = slug.split('.');
      slug = parts.length >= 3 ? parts.slice(2).join('.') : slug;
    }
    const field = entityFields?.find((f) => f.slug === slug);
    return field?.label || field?.name || slug;
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
        last7days: 'Últimos 7 dias',
        last30days: 'Últimos 30 dias',
        last90days: 'Últimos 90 dias',
        thisMonth: 'Este mês',
        thisQuarter: 'Este trimestre',
        thisYear: 'Este ano',
      };
      return labels[filter.value as string] || String(filter.value);
    }
    return String(filter.value);
  };

  // Group cross-filters by entitySlug
  const groups = useMemo(() => {
    const map = new Map<string, typeof crossFilters>();
    for (const cf of crossFilters) {
      const key = cf.entitySlug || '_global';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cf);
    }
    return map;
  }, [crossFilters]);

  if (!hasFilters) {
    return (
      <div className="flex items-center gap-2 mb-2 px-1 py-1.5">
        <Filter className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground/50">
          Clique num gráfico ou num valor da lista para filtrar
        </span>
      </div>
    );
  }

  // Decide whether to collapse
  const shouldCollapse = totalCount > 5 && !expanded;

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 mb-3 px-1 py-2">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">
            Filtros
            {totalCount > 1 && <span className="ml-1 text-muted-foreground/60">({totalCount})</span>}
          </span>
        </div>

        <div className={cn('flex flex-wrap gap-1.5 flex-1', shouldCollapse && 'max-h-[28px] overflow-hidden')}>
          {/* Cross-filter chips grouped by entity */}
          {Array.from(groups.entries()).map(([entityKey, filters]) => (
            filters.map((cf) => (
              <Badge
                key={`cross-${cf.entitySlug || ''}-${cf.fieldSlug}`}
                variant="secondary"
                className="gap-1 text-xs py-0.5 px-2 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors group"
                onClick={() => removeCrossFilter(cf.fieldSlug)}
              >
                {entityKey !== '_global' && groups.size > 1 && (
                  <span className="text-muted-foreground/70 mr-0.5">{entityName(entityKey)}:</span>
                )}
                <span className="font-medium">{getFieldLabel(cf.fieldSlug)}</span>
                <span className="text-muted-foreground mx-0.5">=</span>
                <span>{cf.values.map((v) => valueLabel(cf.entitySlug, cf.fieldSlug, v)).join(', ')}</span>
                <X className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
              </Badge>
            ))
          ))}

          {/* Slicer filter chips */}
          {slicerFilters.map((sf) => (
            <Badge
              key={`slicer-${sf.entitySlug || ''}-${sf.fieldSlug}`}
              variant="secondary"
              className="gap-1 text-xs py-0.5 px-2 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors group"
              onClick={() => removeSlicerFilter(sf.fieldSlug, sf.entitySlug)}
            >
              {sf.entitySlug && (
                <span className="text-muted-foreground/70 mr-0.5">{entityName(sf.entitySlug)}:</span>
              )}
              <span className="font-medium">{getFieldLabel(sf.fieldSlug)}</span>
              <span className="text-muted-foreground mx-0.5">:</span>
              <span>{formatSlicerValue(sf)}</span>
              <X className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            </Badge>
          ))}

          {/* Date range chip */}
          {dateRange && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs py-0.5 px-2 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors group"
              onClick={() => setDateRange(undefined)}
            >
              <span className="font-medium">Período</span>
              <span className="text-muted-foreground mx-0.5">:</span>
              <span>{dateRange.start} a {dateRange.end}</span>
              <X className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            </Badge>
          )}
        </div>

        {/* Expand/collapse toggle when many filters */}
        {totalCount > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3 mr-1" />Menos</>
            ) : (
              <><ChevronDown className="h-3 w-3 mr-1" />Ver todos ({totalCount})</>
            )}
          </Button>
        )}

        {/* Clear all */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
          onClick={clearAllFilters}
        >
          <FilterX className="h-3 w-3 mr-1" />
          Limpar
        </Button>
      </div>
    </div>
  );
}
