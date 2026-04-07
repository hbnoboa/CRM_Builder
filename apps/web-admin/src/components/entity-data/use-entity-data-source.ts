'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { dataService } from '@/services/data.service';
import type { EntityData } from '@/types';
import type { DataRecord } from './unified-filter-types';
import { DASHBOARD_MAX_LIMIT } from '@crm-builder/shared';

// ─── Tipos ───────────────────────────────────────────────────────────

interface EntityDataChangedDetail {
  operation: 'created' | 'updated' | 'deleted' | 'refresh';
  entitySlug: string;
  record?: { id: string; data: Record<string, unknown>; updatedAt: string; createdAt?: string };
  recordId?: string;
}

export interface DataSourceState {
  records: DataRecord[];
  isLoading: boolean;
  error: string | null;
  totalServerRecords: number;
  isFullDataset: boolean;
  refresh: () => void;
}

// ─── Converter EntityData → DataRecord ──────────────────────────────

function toDataRecord(ed: EntityData): DataRecord {
  // API response includes extra fields not in the shared EntityData type
  const extra = ed as unknown as Record<string, unknown>;
  return {
    id: ed.id,
    tenantId: ed.tenantId,
    parentRecordId: (extra.parentRecordId as string | null) ?? null,
    data: ed.data ?? {},
    _childCounts: extra._childCounts as Record<string, number> | undefined,
    _parentDisplay: (extra._parentDisplay as string | null) ?? null,
    _parentEntityName: (extra._parentEntityName as string | null) ?? null,
    _parentEntitySlug: (extra._parentEntitySlug as string | null) ?? null,
    createdAt: typeof ed.createdAt === 'string' ? ed.createdAt : new Date(ed.createdAt).toISOString(),
    updatedAt: typeof ed.updatedAt === 'string' ? ed.updatedAt : new Date(ed.updatedAt).toISOString(),
  };
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useEntityDataSource(
  entitySlug: string | undefined,
  dashboardFilters?: string,
  disableWebSocketUpdates?: boolean
): DataSourceState {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalServerRecords, setTotalServerRecords] = useState(0);

  const entitySlugRef = useRef(entitySlug);
  entitySlugRef.current = entitySlug;
  const dashFiltersRef = useRef(dashboardFilters);
  dashFiltersRef.current = dashboardFilters;

  // Fetch completo
  const fetchAll = useCallback(async () => {
    if (!entitySlugRef.current) {
      setRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        all: 'true',
        includeChildren: 'true',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      if (dashFiltersRef.current) {
        params.dashboardFilters = dashFiltersRef.current;
      }
      const response = await dataService.getAll(entitySlugRef.current, params);

      const mapped = response.data.map(toDataRecord);
      setRecords(mapped);
      setTotalServerRecords(response.meta.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setError(msg);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch inicial quando entitySlug muda, e refetch quando dashboardFilters mudam
  useEffect(() => {
    fetchAll();
  }, [entitySlug, dashboardFilters, fetchAll]);

  // Escutar eventos de WebSocket (entity-data-changed)
  useEffect(() => {
    if (!entitySlug || disableWebSocketUpdates) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<EntityDataChangedDetail>).detail;
      console.log('[WebSocket] entity-data-changed recebido:', detail);

      if (!detail || detail.entitySlug !== entitySlugRef.current) {
        console.log('[WebSocket] Ignorando evento - entitySlug diferente:', {
          received: detail?.entitySlug,
          current: entitySlugRef.current,
        });
        return;
      }

      console.log(`[WebSocket] Processando ${detail.operation} para ${detail.entitySlug}`);

      switch (detail.operation) {
        case 'created': {
          if (detail.record) {
            // Inserir no topo (mais recente)
            const newRecord: DataRecord = {
              id: detail.record.id,
              data: detail.record.data,
              createdAt: detail.record.createdAt || detail.record.updatedAt || new Date().toISOString(),
              updatedAt: detail.record.updatedAt || new Date().toISOString(),
            };
            setRecords(prev => [newRecord, ...prev]);
            setTotalServerRecords(prev => prev + 1);
          } else {
            // Sem dados do record, re-fetch completo
            fetchAll();
          }
          break;
        }

        case 'updated': {
          if (detail.record) {
            setRecords(prev =>
              prev.map(r =>
                r.id === detail.record!.id
                  ? {
                      ...r,
                      data: detail.record!.data,
                      updatedAt: detail.record!.updatedAt || new Date().toISOString(),
                    }
                  : r,
              ),
            );
          }
          break;
        }

        case 'deleted': {
          if (detail.recordId) {
            setRecords(prev => prev.filter(r => r.id !== detail.recordId));
            setTotalServerRecords(prev => Math.max(0, prev - 1));
          }
          break;
        }

        case 'refresh':
        default:
          fetchAll();
          break;
      }
    };

    window.addEventListener('entity-data-changed', handler);
    return () => window.removeEventListener('entity-data-changed', handler);
  }, [entitySlug, fetchAll, disableWebSocketUpdates]);

  const isFullDataset = DASHBOARD_MAX_LIMIT === 0 || totalServerRecords <= DASHBOARD_MAX_LIMIT;

  return {
    records,
    isLoading,
    error,
    totalServerRecords,
    isFullDataset,
    refresh: fetchAll,
  };
}
