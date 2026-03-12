'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DashboardFilterParams } from '@/hooks/use-dashboard-templates';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CrossFilter {
  fieldSlug: string;
  values: string[];          // multi-select: one or more selected values
  entitySlug?: string;       // scopes filter to widgets of this entity
  sourceWidgetId?: string;   // which widget emitted this filter
}

interface SlicerFilter {
  fieldSlug: string;
  operator: string;
  value: unknown;
}

// Drill-through: record detail opened from a widget
interface DrillRecord {
  entitySlug: string;
  recordId: string;
}

// Public interface returned by useDashboardFilters()
interface DashboardFilters {
  crossFilters: CrossFilter[];
  slicerFilters: SlicerFilter[];
  dateRange?: { start: string; end: string };
  drillRecord: DrillRecord | null;
  toggleCrossFilter: (fieldSlug: string, value: string) => void;
  addCrossFilter: (fieldSlug: string, value: string) => void;
  removeCrossFilter: (fieldSlug: string) => void;
  clearCrossFilters: () => void;
  clearAllFilters: () => void;
  setSlicerFilter: (fieldSlug: string, operator: string, value: unknown) => void;
  removeSlicerFilter: (fieldSlug: string) => void;
  setDateRange: (range: { start: string; end: string } | undefined) => void;
  openDrillThrough: (entitySlug: string, recordId: string) => void;
  closeDrillThrough: () => void;
}

// ─── Widget Identity Context ────────────────────────────────────────────────

interface WidgetIdentity {
  entitySlug?: string;
  widgetId?: string;
}

const WidgetIdentityContext = createContext<WidgetIdentity>({});

export function WidgetProvider({
  entitySlug,
  widgetId,
  children,
}: {
  entitySlug: string;
  widgetId: string;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ entitySlug, widgetId }), [entitySlug, widgetId]);
  return <WidgetIdentityContext.Provider value={value}>{children}</WidgetIdentityContext.Provider>;
}

// ─── Internal Context ───────────────────────────────────────────────────────

interface InternalFilters {
  mainEntitySlug?: string;  // dashboard's primary entity
  allCrossFilters: CrossFilter[];
  slicerFilters: SlicerFilter[];
  dateRange?: { start: string; end: string };
  drillRecord: DrillRecord | null;
  toggleCrossFilter: (fieldSlug: string, value: string, entitySlug?: string, sourceWidgetId?: string) => void;
  addCrossFilter: (fieldSlug: string, value: string, entitySlug?: string, sourceWidgetId?: string) => void;
  removeCrossFilter: (fieldSlug: string, entitySlug?: string) => void;
  clearCrossFilters: () => void;
  clearAllFilters: () => void;
  setSlicerFilter: (fieldSlug: string, operator: string, value: unknown) => void;
  removeSlicerFilter: (fieldSlug: string) => void;
  setDateRange: (range: { start: string; end: string } | undefined) => void;
  openDrillThrough: (entitySlug: string, recordId: string) => void;
  closeDrillThrough: () => void;
}

const noop = () => {};

const InternalFilterContext = createContext<InternalFilters>({
  allCrossFilters: [],
  slicerFilters: [],
  dateRange: undefined,
  drillRecord: null,
  toggleCrossFilter: noop,
  addCrossFilter: noop,
  removeCrossFilter: noop,
  clearCrossFilters: noop,
  clearAllFilters: noop,
  setSlicerFilter: noop,
  removeSlicerFilter: noop,
  setDateRange: noop,
  openDrillThrough: noop,
  closeDrillThrough: noop,
});

// ─── Provider ───────────────────────────────────────────────────────────────

export function DashboardFilterProvider({
  mainEntitySlug,
  children,
}: {
  mainEntitySlug?: string;
  children: ReactNode;
}) {
  const [crossFilters, setCrossFilters] = useState<CrossFilter[]>([]);
  const [slicerFilters, setSlicerFilters] = useState<SlicerFilter[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | undefined>();
  const [drillRecord, setDrillRecord] = useState<DrillRecord | null>(null);

  const openDrillThrough = useCallback((entitySlug: string, recordId: string) => {
    setDrillRecord({ entitySlug, recordId });
  }, []);

  const closeDrillThrough = useCallback(() => {
    setDrillRecord(null);
  }, []);

  const addCrossFilter = useCallback(
    (fieldSlug: string, value: string, entitySlug?: string, sourceWidgetId?: string) => {
      setCrossFilters((prev) => {
        const filtered = prev.filter((f) => !(f.fieldSlug === fieldSlug && f.entitySlug === entitySlug));
        return [...filtered, { fieldSlug, values: [value], entitySlug, sourceWidgetId }];
      });
    },
    [],
  );

  const removeCrossFilter = useCallback((fieldSlug: string, entitySlug?: string) => {
    setCrossFilters((prev) => {
      if (entitySlug !== undefined) {
        return prev.filter((f) => !(f.fieldSlug === fieldSlug && f.entitySlug === entitySlug));
      }
      return prev.filter((f) => f.fieldSlug !== fieldSlug && !f.fieldSlug.endsWith(`.${fieldSlug}`));
    });
  }, []);

  const toggleCrossFilter = useCallback(
    (fieldSlug: string, value: string, entitySlug?: string, sourceWidgetId?: string) => {
      setCrossFilters((prev) => {
        const existing = prev.find(
          (f) => f.fieldSlug === fieldSlug && f.entitySlug === entitySlug,
        );
        if (existing) {
          const hasValue = existing.values.includes(value);
          if (hasValue) {
            // Remove value from array; if empty, remove the whole filter
            const newValues = existing.values.filter((v) => v !== value);
            if (newValues.length === 0) {
              return prev.filter((f) => !(f.fieldSlug === fieldSlug && f.entitySlug === entitySlug));
            }
            return prev.map((f) =>
              f.fieldSlug === fieldSlug && f.entitySlug === entitySlug
                ? { ...f, values: newValues }
                : f,
            );
          }
          // Add value to existing array
          return prev.map((f) =>
            f.fieldSlug === fieldSlug && f.entitySlug === entitySlug
              ? { ...f, values: [...f.values, value], sourceWidgetId }
              : f,
          );
        }
        // New filter
        return [...prev, { fieldSlug, values: [value], entitySlug, sourceWidgetId }];
      });
    },
    [],
  );

  const clearCrossFilters = useCallback(() => setCrossFilters([]), []);

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

  const value = useMemo<InternalFilters>(
    () => ({
      mainEntitySlug,
      allCrossFilters: crossFilters,
      slicerFilters,
      dateRange,
      drillRecord,
      toggleCrossFilter,
      addCrossFilter,
      removeCrossFilter,
      clearCrossFilters,
      clearAllFilters,
      setSlicerFilter: setSlicerFilterFn,
      removeSlicerFilter,
      setDateRange,
      openDrillThrough,
      closeDrillThrough,
    }),
    [mainEntitySlug, crossFilters, slicerFilters, dateRange, drillRecord, toggleCrossFilter, addCrossFilter, removeCrossFilter, clearCrossFilters, clearAllFilters, setSlicerFilterFn, removeSlicerFilter, setDateRange, openDrillThrough, closeDrillThrough],
  );

  return <InternalFilterContext.Provider value={value}>{children}</InternalFilterContext.Provider>;
}

// ─── useDashboardFilters ────────────────────────────────────────────────────
// Returns entity-scoped crossFilters (for highlighting).
// Parent entity filters propagate to sub-entity widgets with "parent." prefix.
// toggleCrossFilter auto-injects entitySlug + widgetId from context.
// Outside any WidgetProvider (filter bar), returns ALL filters.

export function useDashboardFilters(): DashboardFilters {
  const ctx = useContext(InternalFilterContext);
  const { entitySlug: widgetEntity, widgetId } = useContext(WidgetIdentityContext);

  const crossFilters = useMemo(() => {
    // Filter bar (no widget context): show all
    if (!widgetEntity) return ctx.allCrossFilters;

    const mainEntity = ctx.mainEntitySlug;
    const isSubEntity = mainEntity && widgetEntity !== mainEntity;

    const isMainEntity = mainEntity && widgetEntity === mainEntity;

    const result: CrossFilter[] = [];
    for (const f of ctx.allCrossFilters) {
      if (!f.entitySlug) {
        // No entity scope: include as-is (global filter)
        result.push(f);
      } else if (f.entitySlug === widgetEntity) {
        // Same entity: include as-is
        result.push(f);
      } else if (isSubEntity && f.entitySlug === mainEntity) {
        // Parent→Child: parent entity filter propagates with parent.* prefix
        result.push({ ...f, fieldSlug: `parent.${f.fieldSlug}` });
      } else if (isMainEntity && f.entitySlug !== mainEntity) {
        // Child→Parent: sub-entity filter propagates with child.<entitySlug>.* prefix
        // Backend resolves: "show parent records that have children matching this filter"
        result.push({ ...f, fieldSlug: `child.${f.entitySlug}.${f.fieldSlug}` });
      }
    }
    return result;
  }, [ctx.allCrossFilters, widgetEntity, ctx.mainEntitySlug]);

  const toggleCrossFilter = useCallback(
    (fieldSlug: string, value: string) => {
      ctx.toggleCrossFilter(fieldSlug, value, widgetEntity, widgetId);
    },
    [ctx.toggleCrossFilter, widgetEntity, widgetId],
  );

  const addCrossFilter = useCallback(
    (fieldSlug: string, value: string) => {
      ctx.addCrossFilter(fieldSlug, value, widgetEntity, widgetId);
    },
    [ctx.addCrossFilter, widgetEntity, widgetId],
  );

  const removeCrossFilter = useCallback(
    (fieldSlug: string) => {
      ctx.removeCrossFilter(fieldSlug, widgetEntity);
    },
    [ctx.removeCrossFilter, widgetEntity],
  );

  return {
    crossFilters,
    slicerFilters: ctx.slicerFilters,
    dateRange: ctx.dateRange,
    drillRecord: ctx.drillRecord,
    addCrossFilter,
    removeCrossFilter,
    toggleCrossFilter,
    clearCrossFilters: ctx.clearCrossFilters,
    clearAllFilters: ctx.clearAllFilters,
    setSlicerFilter: ctx.setSlicerFilter,
    removeSlicerFilter: ctx.removeSlicerFilter,
    setDateRange: ctx.setDateRange,
    openDrillThrough: ctx.openDrillThrough,
    closeDrillThrough: ctx.closeDrillThrough,
  };
}

// ─── useWidgetFilters ───────────────────────────────────────────────────────
// Converts cross-filters into API query params.
// Automatically EXCLUDES filters emitted by the CURRENT widget (sourceWidgetId).
// Parent→child propagation already handled by useDashboardFilters().

export function useWidgetFilters(): DashboardFilterParams {
  const { crossFilters, slicerFilters, dateRange } = useDashboardFilters();
  const { widgetId } = useContext(WidgetIdentityContext);

  return useMemo(() => {
    const filterItems: Array<{ fieldSlug: string; operator: string; value: unknown }> = [];

    for (const cf of crossFilters) {
      // Skip filters emitted by THIS widget — prevents self-filtering
      if (widgetId && cf.sourceWidgetId === widgetId) continue;
      if (cf.values.length === 1) {
        filterItems.push({ fieldSlug: cf.fieldSlug, operator: 'equals', value: cf.values[0] });
      } else if (cf.values.length > 1) {
        filterItems.push({ fieldSlug: cf.fieldSlug, operator: 'in', value: cf.values });
      }
    }

    for (const sf of slicerFilters) {
      filterItems.push({ fieldSlug: sf.fieldSlug, operator: sf.operator, value: sf.value });
    }

    return {
      filters: filterItems.length > 0 ? JSON.stringify(filterItems) : undefined,
      dateStart: dateRange?.start,
      dateEnd: dateRange?.end,
    };
  }, [crossFilters, slicerFilters, dateRange, widgetId]);
}

// ─── Visual State Helper ───────────────────────────────────────────────────
// Returns 'sel' (selected/highlighted), 'dim' (other values selected), or '' (no filter active)

export function getFilterVisualState(
  crossFilters: CrossFilter[],
  fieldSlug: string,
  value: string,
): 'sel' | 'dim' | '' {
  const filter = crossFilters.find((f) => f.fieldSlug === fieldSlug);
  if (!filter) return '';
  return filter.values.includes(value) ? 'sel' : 'dim';
}
