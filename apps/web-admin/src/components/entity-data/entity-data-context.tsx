'use client';

import React, { createContext, useContext, useReducer, useMemo, useCallback, useEffect } from 'react';
import { useEntityDataSource } from './use-entity-data-source';
import { useEntityBySlug } from '@/hooks/use-entities';
import { applyAllFilters, sortRecords } from './unified-filter-engine';
import { INITIAL_FILTER_STATE } from './unified-filter-types';
import type {
  DataRecord,
  EntityMeta,
  EntityField,
  UnifiedFilterState,
  FieldFilter,
  CrossFilter,
  ComparisonFilter,
  FilterPreset,
} from './unified-filter-types';
import type { Entity } from '@/types';

// ─── Context Value ───────────────────────────────────────────────────

export interface EntityDataContextValue {
  // Data
  entitySlug: string;
  entity: EntityMeta | null;
  allRecords: DataRecord[];
  filteredRecords: DataRecord[];
  sortedRecords: DataRecord[];
  comparisonRecords: DataRecord[] | null;
  isLoading: boolean;
  error: string | null;
  totalServerRecords: number;
  isFullDataset: boolean;

  // Filter state
  filters: UnifiedFilterState;

  // Filter actions
  addFieldFilter: (filter: FieldFilter) => void;
  removeFieldFilter: (id: string) => void;
  updateFieldFilter: (id: string, updates: Partial<FieldFilter>) => void;
  toggleCrossFilter: (cf: CrossFilter) => void;
  removeCrossFilter: (fieldSlug: string) => void;
  setSearchTerm: (term: string) => void;
  setSortConfig: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  setDateRange: (range: { start: string; end: string } | undefined) => void;
  setComparisonFilters: (comparison: ComparisonFilter | undefined) => void;
  clearAllFilters: () => void;
  setFilters: (state: Partial<UnifiedFilterState>) => void;

  // CRUD otimista
  addRecord: (record: DataRecord) => void;
  updateRecord: (id: string, data: Record<string, unknown>) => void;
  removeRecord: (id: string) => void;

  // Server-side dashboard filters (cross-entity filters that need API resolution)
  setServerDashFilters: (filters: string | undefined) => void;

  // Refresh
  refresh: () => void;
}

const EntityDataContext = createContext<EntityDataContextValue | null>(null);

// ─── Reducer ─────────────────────────────────────────────────────────

type FilterAction =
  | { type: 'ADD_FIELD_FILTER'; filter: FieldFilter }
  | { type: 'REMOVE_FIELD_FILTER'; id: string }
  | { type: 'UPDATE_FIELD_FILTER'; id: string; updates: Partial<FieldFilter> }
  | { type: 'TOGGLE_CROSS_FILTER'; cf: CrossFilter }
  | { type: 'REMOVE_CROSS_FILTER'; fieldSlug: string }
  | { type: 'SET_SEARCH'; term: string }
  | { type: 'SET_SORT'; sortBy: string; sortOrder: 'asc' | 'desc' }
  | { type: 'SET_DATE_RANGE'; range: { start: string; end: string } | undefined }
  | { type: 'SET_COMPARISON'; comparison: ComparisonFilter | undefined }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_STATE'; partial: Partial<UnifiedFilterState> };

function filterReducer(state: UnifiedFilterState, action: FilterAction): UnifiedFilterState {
  switch (action.type) {
    case 'ADD_FIELD_FILTER':
      return { ...state, fieldFilters: [...state.fieldFilters, action.filter] };

    case 'REMOVE_FIELD_FILTER':
      return { ...state, fieldFilters: state.fieldFilters.filter(f => f.id !== action.id) };

    case 'UPDATE_FIELD_FILTER':
      return {
        ...state,
        fieldFilters: state.fieldFilters.map(f =>
          f.id === action.id ? { ...f, ...action.updates } : f,
        ),
      };

    case 'TOGGLE_CROSS_FILTER': {
      const existing = state.crossFilters.findIndex(
        cf => cf.fieldSlug === action.cf.fieldSlug,
      );
      if (existing >= 0) {
        // Se mesmo fieldSlug e mesmos valores, remove; senão substitui
        const current = state.crossFilters[existing];
        const sameValues =
          current.values.length === action.cf.values.length &&
          current.values.every(v => action.cf.values.includes(v));
        if (sameValues) {
          return {
            ...state,
            crossFilters: state.crossFilters.filter((_, i) => i !== existing),
          };
        }
        const updated = [...state.crossFilters];
        updated[existing] = action.cf;
        return { ...state, crossFilters: updated };
      }
      return { ...state, crossFilters: [...state.crossFilters, action.cf] };
    }

    case 'REMOVE_CROSS_FILTER':
      return {
        ...state,
        crossFilters: state.crossFilters.filter(cf => cf.fieldSlug !== action.fieldSlug),
      };

    case 'SET_SEARCH':
      return { ...state, searchTerm: action.term };

    case 'SET_SORT':
      return { ...state, sortBy: action.sortBy, sortOrder: action.sortOrder };

    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.range };

    case 'SET_COMPARISON':
      return { ...state, comparison: action.comparison };

    case 'CLEAR_ALL':
      return { ...INITIAL_FILTER_STATE };

    case 'SET_STATE':
      return { ...state, ...action.partial };

    default:
      return state;
  }
}

// ─── Converter Entity → EntityMeta ──────────────────────────────────

function toEntityMeta(entity: Entity): EntityMeta {
  const extra = entity as unknown as Record<string, unknown>;
  const settings = entity.settings as Record<string, unknown> | undefined;
  return {
    id: entity.id,
    name: entity.name,
    namePlural: entity.namePlural ?? undefined,
    slug: entity.slug,
    // Spread all field properties so hidden, disabled, multiple, onChangeAutoFill,
    // gridRow, gridColSpan, gridColStart, imageDisplaySize, etc. are preserved
    fields: (entity.fields || []).map(f => ({
      ...(f as unknown as Record<string, unknown>),
      slug: f.slug,
      name: f.name,
      label: f.label,
      type: f.type,
      options: f.options as EntityField['options'],
    })) as EntityField[],
    displayField: (settings?.titleField as string) ?? undefined,
    parentEntityId: (extra.parentEntityId as string | null) ?? null,
    parentEntitySlug: (extra.parentEntitySlug as string | null) ?? null,
    settings,
  };
}

// ─── Provider ────────────────────────────────────────────────────────

interface EntityDataProviderProps {
  entitySlug: string;
  children: React.ReactNode;
  initialFilters?: Partial<UnifiedFilterState>;
  disableWebSocketUpdates?: boolean;
}

export function EntityDataProvider({
  entitySlug,
  disableWebSocketUpdates,
  children,
  initialFilters,
}: EntityDataProviderProps) {
  const [serverDashFilters, setServerDashFilters] = React.useState<string | undefined>();
  const { records: allRecords, isLoading, error, totalServerRecords, isFullDataset, refresh } =
    useEntityDataSource(entitySlug, serverDashFilters, disableWebSocketUpdates);

  const { data: rawEntity } = useEntityBySlug(entitySlug);

  const entity = useMemo<EntityMeta | null>(
    () => (rawEntity ? toEntityMeta(rawEntity) : null),
    [rawEntity],
  );

  const [filters, dispatch] = useReducer(filterReducer, {
    ...INITIAL_FILTER_STATE,
    ...initialFilters,
  });

  // Filtrar records
  const filteredRecords = useMemo(
    () => applyAllFilters(allRecords, filters, entity),
    [allRecords, filters, entity],
  );

  // Ordenar
  const sortedRecords = useMemo(
    () => sortRecords(filteredRecords, filters.sortBy, filters.sortOrder, entity?.fields),
    [filteredRecords, filters.sortBy, filters.sortOrder, entity?.fields],
  );

  // Comparison records
  const comparisonRecords = useMemo(() => {
    if (!filters.comparison) return null;
    const comparisonState: UnifiedFilterState = {
      ...filters,
      fieldFilters: filters.comparison.filters,
      comparison: undefined,
    };
    return applyAllFilters(allRecords, comparisonState, entity);
  }, [allRecords, filters, entity]);

  // Actions
  const addFieldFilter = useCallback((filter: FieldFilter) => {
    dispatch({ type: 'ADD_FIELD_FILTER', filter });
  }, []);

  const removeFieldFilter = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FIELD_FILTER', id });
  }, []);

  const updateFieldFilter = useCallback((id: string, updates: Partial<FieldFilter>) => {
    dispatch({ type: 'UPDATE_FIELD_FILTER', id, updates });
  }, []);

  const toggleCrossFilter = useCallback((cf: CrossFilter) => {
    dispatch({ type: 'TOGGLE_CROSS_FILTER', cf });
  }, []);

  const removeCrossFilter = useCallback((fieldSlug: string) => {
    dispatch({ type: 'REMOVE_CROSS_FILTER', fieldSlug });
  }, []);

  const setSearchTerm = useCallback((term: string) => {
    dispatch({ type: 'SET_SEARCH', term });
  }, []);

  const setSortConfig = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    dispatch({ type: 'SET_SORT', sortBy, sortOrder });
  }, []);

  const setDateRange = useCallback((range: { start: string; end: string } | undefined) => {
    dispatch({ type: 'SET_DATE_RANGE', range });
  }, []);

  const setComparisonFilters = useCallback((comparison: ComparisonFilter | undefined) => {
    dispatch({ type: 'SET_COMPARISON', comparison });
  }, []);

  const clearAllFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const setFilters = useCallback((partial: Partial<UnifiedFilterState>) => {
    dispatch({ type: 'SET_STATE', partial });
  }, []);

  // CRUD otimista
  const addRecord = useCallback((record: DataRecord) => {
    // Dispatch via window event para que useEntityDataSource capte
    window.dispatchEvent(
      new CustomEvent('entity-data-changed', {
        detail: {
          operation: 'created',
          entitySlug,
          record: { id: record.id, data: record.data, updatedAt: record.updatedAt, createdAt: record.createdAt },
        },
      }),
    );
  }, [entitySlug]);

  const updateRecord = useCallback((id: string, partialData: Record<string, unknown>) => {
    // Emitir evento de atualização otimista (será processado pelo useEntityDataSource)
    window.dispatchEvent(
      new CustomEvent('entity-data-changed', {
        detail: {
          operation: 'updated',
          entitySlug,
          record: { id, data: partialData, updatedAt: new Date().toISOString() },
        },
      }),
    );
  }, [entitySlug]);

  const removeRecord = useCallback((id: string) => {
    window.dispatchEvent(
      new CustomEvent('entity-data-changed', {
        detail: {
          operation: 'deleted',
          entitySlug,
          recordId: id,
        },
      }),
    );
  }, [entitySlug]);

  const value = useMemo<EntityDataContextValue>(
    () => ({
      entitySlug,
      entity,
      allRecords,
      filteredRecords,
      sortedRecords,
      comparisonRecords,
      isLoading,
      error,
      totalServerRecords,
      isFullDataset,
      filters,
      addFieldFilter,
      removeFieldFilter,
      updateFieldFilter,
      toggleCrossFilter,
      removeCrossFilter,
      setSearchTerm,
      setSortConfig,
      setDateRange,
      setComparisonFilters,
      clearAllFilters,
      setFilters,
      addRecord,
      updateRecord,
      removeRecord,
      setServerDashFilters,
      refresh,
    }),
    [
      entitySlug, entity, allRecords, filteredRecords, sortedRecords,
      comparisonRecords, isLoading, error, totalServerRecords, isFullDataset,
      filters, addFieldFilter, removeFieldFilter, updateFieldFilter,
      toggleCrossFilter, removeCrossFilter, setSearchTerm, setSortConfig,
      setDateRange, setComparisonFilters, clearAllFilters, setFilters,
      addRecord, updateRecord, removeRecord, setServerDashFilters, refresh,
    ],
  );

  return (
    <EntityDataContext.Provider value={value}>
      {children}
    </EntityDataContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useEntityData(): EntityDataContextValue {
  const ctx = useContext(EntityDataContext);
  if (!ctx) {
    throw new Error('useEntityData must be used within EntityDataProvider');
  }
  return ctx;
}

export function useEntityDataOptional(): EntityDataContextValue | null {
  return useContext(EntityDataContext);
}

export { EntityDataContext };
