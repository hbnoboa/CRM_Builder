'use client';

import { useState } from 'react';
import { useDashboardFilters } from './dashboard-filter-context';
import { useFieldDistribution } from '@/hooks/use-dashboard-templates';
import { WidgetWrapper } from './widget-wrapper';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import type { WidgetConfig } from '@crm-builder/shared';
import { cn } from '@/lib/utils';

interface FilterSlicerWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

export function FilterSlicerWidget({ entitySlug, config, title, isEditMode }: FilterSlicerWidgetProps) {
  const fieldSlug = config.filterFields?.[0] || config.fieldSlug || '';
  const slicerType = config.slicerType || 'dropdown';
  const { crossFilters, toggleCrossFilter, setSlicerFilter, removeSlicerFilter, setDateRange } = useDashboardFilters();

  const { data: options } = useFieldDistribution(
    slicerType === 'dropdown' || slicerType === 'tile' ? entitySlug : undefined,
    fieldSlug || undefined,
  );

  const activeFilter = crossFilters.find((f) => f.fieldSlug === fieldSlug);

  if (slicerType === 'dropdown') {
    return (
      <WidgetWrapper title={title} isEditMode={isEditMode}>
        <div className="flex items-center gap-2 h-full">
          <Select
            value={activeFilter?.values[0] || ''}
            onValueChange={(val) => {
              if (val === '__clear__') {
                if (activeFilter?.values[0]) toggleCrossFilter(fieldSlug, activeFilter.values[0]);
              } else {
                toggleCrossFilter(fieldSlug, val);
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Filtrar..." />
            </SelectTrigger>
            <SelectContent>
              {activeFilter && (
                <SelectItem value="__clear__" className="text-muted-foreground">
                  Limpar filtro
                </SelectItem>
              )}
              {(options || []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label} ({opt.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </WidgetWrapper>
    );
  }

  if (slicerType === 'tile') {
    return (
      <WidgetWrapper title={title} isEditMode={isEditMode}>
        <div className="flex flex-wrap gap-1.5 h-full items-start content-start overflow-auto">
          {(options || []).map((opt) => (
            <Button
              key={opt.value}
              variant={activeFilter?.values.includes(opt.value) ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => toggleCrossFilter(fieldSlug, opt.value)}
            >
              {opt.label}
              {activeFilter?.values.includes(opt.value) && (
                <X className="h-3 w-3 ml-1" />
              )}
            </Button>
          ))}
        </div>
      </WidgetWrapper>
    );
  }

  if (slicerType === 'date-range') {
    return <DateRangeSlicer title={title} isEditMode={isEditMode} fieldSlug={fieldSlug} setDateRange={setDateRange} />;
  }

  if (slicerType === 'relative-date') {
    const dateOptions = config.relativeDateOptions || ['last7days', 'last30days', 'last90days'];
    const labels: Record<string, string> = {
      last7days: '7 dias',
      last30days: '30 dias',
      last90days: '90 dias',
      thisMonth: 'Este mes',
      thisQuarter: 'Este trimestre',
      thisYear: 'Este ano',
    };
    return (
      <WidgetWrapper title={title} isEditMode={isEditMode}>
        <div className="flex flex-wrap gap-1.5 h-full items-start content-start">
          {dateOptions.map((opt) => (
            <Button
              key={opt}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSlicerFilter(fieldSlug, 'relative', opt)}
            >
              {labels[opt] || opt}
            </Button>
          ))}
        </div>
      </WidgetWrapper>
    );
  }

  if (slicerType === 'numeric-range') {
    return <NumericRangeSlicer title={title} isEditMode={isEditMode} fieldSlug={fieldSlug} setSlicerFilter={setSlicerFilter} removeSlicerFilter={removeSlicerFilter} />;
  }

  return <WidgetWrapper title={title} isEditMode={isEditMode}><div /></WidgetWrapper>;
}

function DateRangeSlicer({ title, isEditMode, fieldSlug, setDateRange }: {
  title?: string; isEditMode?: boolean; fieldSlug: string;
  setDateRange: (r: { start: string; end: string } | undefined) => void;
}) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const apply = () => {
    if (start && end) setDateRange({ start, end });
  };

  return (
    <WidgetWrapper title={title} isEditMode={isEditMode}>
      <div className="flex items-center gap-2 h-full">
        <Input type="date" className="h-7 text-xs" value={start} onChange={(e) => setStart(e.target.value)} />
        <span className="text-xs text-muted-foreground">a</span>
        <Input type="date" className="h-7 text-xs" value={end} onChange={(e) => setEnd(e.target.value)} />
        <Button size="sm" className="h-7 text-xs" onClick={apply}>Ok</Button>
      </div>
    </WidgetWrapper>
  );
}

function NumericRangeSlicer({ title, isEditMode, fieldSlug, setSlicerFilter, removeSlicerFilter }: {
  title?: string; isEditMode?: boolean; fieldSlug: string;
  setSlicerFilter: (f: string, op: string, v: unknown) => void;
  removeSlicerFilter: (f: string) => void;
}) {
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  const apply = () => {
    if (min || max) {
      setSlicerFilter(fieldSlug, 'range', { min: min ? Number(min) : undefined, max: max ? Number(max) : undefined });
    } else {
      removeSlicerFilter(fieldSlug);
    }
  };

  return (
    <WidgetWrapper title={title} isEditMode={isEditMode}>
      <div className="flex items-center gap-2 h-full">
        <Input type="number" placeholder="Min" className="h-7 text-xs" value={min} onChange={(e) => setMin(e.target.value)} />
        <span className="text-xs text-muted-foreground">-</span>
        <Input type="number" placeholder="Max" className="h-7 text-xs" value={max} onChange={(e) => setMax(e.target.value)} />
        <Button size="sm" className="h-7 text-xs" onClick={apply}>Ok</Button>
      </div>
    </WidgetWrapper>
  );
}
