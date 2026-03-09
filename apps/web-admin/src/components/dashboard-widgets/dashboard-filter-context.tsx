'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DashboardFilterParams } from '@/hooks/use-dashboard-templates';

interface CrossFilter {
  fieldSlug: string;
  value: string;
}

interface SlicerFilter {
  fieldSlug: string;
  operator: string;
  value: unknown;
}

interface DashboardFilters {
  crossFilters: CrossFilter[];
  slicerFilters: SlicerFilter[];
  dateRange?: { start: string; end: string };
  addCrossFilter: (fieldSlug: string, value: string) => void;
  removeCrossFilter: (fieldSlug: string) => void;
  toggleCrossFilter: (fieldSlug: string, value: string) => void;
  clearCrossFilters: () => void;
  clearAllFilters: () => void;
  setSlicerFilter: (fieldSlug: string, operator: string, value: unknown) => void;
  removeSlicerFilter: (fieldSlug: string) => void;
  setDateRange: (range: { start: string; end: string } | undefined) => void;
}

const noop = () => {};

const DEFAULT_FILTERS: DashboardFilters = {
  crossFilters: [],
  slicerFilters: [],
  dateRange: undefined,
  addCrossFilter: noop,
  removeCrossFilter: noop,
  toggleCrossFilter: noop,
  clearCrossFilters: noop,
  clearAllFilters: noop,
  setSlicerFilter: noop,
  removeSlicerFilter: noop,
  setDateRange: noop,
};

const DashboardFilterContext = createContext<DashboardFilters>(DEFAULT_FILTERS);

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [crossFilters, setCrossFilters] = useState<CrossFilter[]>([]);
  const [slicerFilters, setSlicerFilters] = useState<SlicerFilter[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | undefined>();

  const addCrossFilter = useCallback((fieldSlug: string, value: string) => {
    setCrossFilters((prev) => {
      const filtered = prev.filter((f) => f.fieldSlug !== fieldSlug);
      return [...filtered, { fieldSlug, value }];
    });
  }, []);

  const removeCrossFilter = useCallback((fieldSlug: string) => {
    setCrossFilters((prev) => prev.filter((f) => f.fieldSlug !== fieldSlug));
  }, []);

  const toggleCrossFilter = useCallback((fieldSlug: string, value: string) => {
    setCrossFilters((prev) => {
      const existing = prev.find((f) => f.fieldSlug === fieldSlug && f.value === value);
      if (existing) {
        return prev.filter((f) => !(f.fieldSlug === fieldSlug && f.value === value));
      }
      const filtered = prev.filter((f) => f.fieldSlug !== fieldSlug);
      return [...filtered, { fieldSlug, value }];
    });
  }, []);

  const clearCrossFilters = useCallback(() => {
    setCrossFilters([]);
  }, []);

  const clearAllFilters = useCallback(() => {
    setCrossFilters([]);
    setSlicerFilters([]);
    setDateRange(undefined);
  }, []);

  const setSlicerFilterFn = useCallback((fieldSlug: string, operator: string, value: unknown) => {
    setSlicerFilters((prev) => {
      const filtered = prev.filter((f) => f.fieldSlug !== fieldSlug);
      return [...filtered, { fieldSlug, operator, value }];
    });
  }, []);

  const removeSlicerFilter = useCallback((fieldSlug: string) => {
    setSlicerFilters((prev) => prev.filter((f) => f.fieldSlug !== fieldSlug));
  }, []);

  return (
    <DashboardFilterContext.Provider
      value={{
        crossFilters,
        slicerFilters,
        dateRange,
        addCrossFilter,
        removeCrossFilter,
        toggleCrossFilter,
        clearCrossFilters,
        clearAllFilters,
        setSlicerFilter: setSlicerFilterFn,
        removeSlicerFilter,
        setDateRange,
      }}
    >
      {children}
    </DashboardFilterContext.Provider>
  );
}

export function useDashboardFilters() {
  return useContext(DashboardFilterContext);
}

/**
 * Hook that converts dashboard filters from context into API query params.
 * Optionally excludes a field (so a chart doesn't filter itself).
 */
export function useWidgetFilters(options?: { excludeField?: string }): DashboardFilterParams {
  const { crossFilters, slicerFilters, dateRange } = useDashboardFilters();

  return useMemo(() => {
    const filterItems: Array<{ fieldSlug: string; operator: string; value: unknown }> = [];

    for (const cf of crossFilters) {
      if (options?.excludeField && cf.fieldSlug === options.excludeField) continue;
      filterItems.push({ fieldSlug: cf.fieldSlug, operator: 'equals', value: cf.value });
    }

    for (const sf of slicerFilters) {
      filterItems.push({ fieldSlug: sf.fieldSlug, operator: sf.operator, value: sf.value });
    }

    return {
      filters: filterItems.length > 0 ? JSON.stringify(filterItems) : undefined,
      dateStart: dateRange?.start,
      dateEnd: dateRange?.end,
    };
  }, [crossFilters, slicerFilters, dateRange, options?.excludeField]);
}
