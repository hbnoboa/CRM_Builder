'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { dataService } from '@/services/data.service';
import type { EntityData } from '@/types';
import type { DataRecord } from './unified-filter-types';
import { DASHBOARD_MAX_LIMIT, SERVER_MODE_THRESHOLD } from '@crm-builder/shared';

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
  /** Tabela grande (> SERVER_MODE_THRESHOLD): nada e baixado; graficos e tabela pedem ao servidor. */
  serverMode: boolean;
  refresh: () => void;
}

// ─── Converter EntityData → DataRecord ──────────────────────────────

export function toDataRecord(ed: EntityData): DataRecord {
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

/** Espera para juntar avisos de tempo real antes de buscar (ms). */
const FLUSH_DELAY_MS = 1000;
/** Registros por busca parcial (cabe na URL). */
const BATCH_SIZE = 100;
/** Acima disso no mesmo lote (ex.: importacao), uma recarga completa e mais barata. */
const MAX_INCREMENTAL = 300;

export function useEntityDataSource(
  entitySlug: string | undefined,
  dashboardFilters?: string,
  disableWebSocketUpdates?: boolean
): DataSourceState {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalServerRecords, setTotalServerRecords] = useState(0);
  // Modo da tabela (decidido pelo total sem filtros, uma vez por tabela)
  const [serverMode, setServerMode] = useState(false);
  const modeRef = useRef<{ slug?: string; server: boolean }>({ server: false });

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
      const slug = entitySlugRef.current;
      // Tabela grande: so o total; os registros ficam no servidor (paginas e contas no banco)
      if (modeRef.current.slug !== slug) {
        const probe = await dataService.getAll(slug, { limit: 1, includeChildren: 'true' });
        modeRef.current = { slug, server: probe.meta.total > SERVER_MODE_THRESHOLD };
        setServerMode(modeRef.current.server);
        if (modeRef.current.server) setTotalServerRecords(probe.meta.total);
      }
      if (modeRef.current.server) {
        setRecords([]);
        return;
      }
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
      // NÃO apagar os registros já carregados: um refetch que falha (ex: token
      // expirado, evento de websocket, troca de filtro) deixava tudo zerado até o
      // F5. Mantém os dados anteriores e só sinaliza o erro.
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch inicial quando entitySlug muda, e refetch quando dashboardFilters mudam
  useEffect(() => {
    fetchAll();
  }, [entitySlug, dashboardFilters, fetchAll]);

  // Avisos em tempo real (entity-data-changed). O servidor manda so o id do registro
  // (cada um ve com a propria permissao): em vez de baixar a tabela inteira a cada
  // registro salvo, junta os avisos por ~1 s e busca so os registros alterados.
  // Muitos de uma vez (ex.: importacao) -> uma unica recarga completa.
  const pendingRef = useRef<Map<string, 'created' | 'updated'>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsFullRef = useRef(false);

  const flushPending = useCallback(async () => {
    flushTimerRef.current = null;
    const slug = entitySlugRef.current;
    if (!slug) return;
    if (modeRef.current.server) { pendingRef.current.clear(); needsFullRef.current = false; return; }
    if (needsFullRef.current || pendingRef.current.size > MAX_INCREMENTAL) {
      needsFullRef.current = false;
      pendingRef.current.clear();
      fetchAll();
      return;
    }
    const batch = new Map(pendingRef.current);
    pendingRef.current.clear();
    if (batch.size === 0) return;
    try {
      const ids = Array.from(batch.keys());
      const fetched = new Map<string, DataRecord>();
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const params: Record<string, string> = {
          recordIds: JSON.stringify(ids.slice(i, i + BATCH_SIZE)),
          includeChildren: 'true',
          limit: String(BATCH_SIZE),
        };
        if (dashFiltersRef.current) params.dashboardFilters = dashFiltersRef.current;
        const response = await dataService.getAll(slug, params);
        for (const ed of response.data) fetched.set(ed.id, toDataRecord(ed));
      }
      if (entitySlugRef.current !== slug) return;
      let added = 0;
      let removed = 0;
      setRecords((prev) => {
        const known = new Set(prev.map((r) => r.id));
        // Alterado: troca pelo que veio. Nao veio (sem permissao, fora do filtro, excluido): sai.
        const next = prev.flatMap((r) => {
          if (!batch.has(r.id)) return [r];
          const fresh = fetched.get(r.id);
          if (!fresh) { removed++; return []; }
          return [fresh];
        });
        // Novos (ou que passaram a ser visiveis): entram no topo
        const novos = Array.from(fetched.values()).filter((r) => !known.has(r.id));
        added = novos.length;
        return novos.length ? [...novos, ...next] : next;
      });
      if (added || removed) setTotalServerRecords((n) => Math.max(0, n + added - removed));
    } catch {
      // Falhou a busca parcial: recarrega tudo uma vez, como antes
      fetchAll();
    }
  }, [fetchAll]);

  const scheduleFlush = useCallback(() => {
    if (!flushTimerRef.current) flushTimerRef.current = setTimeout(flushPending, FLUSH_DELAY_MS);
  }, [flushPending]);

  useEffect(() => () => { if (flushTimerRef.current) clearTimeout(flushTimerRef.current); }, []);

  useEffect(() => {
    if (!entitySlug || disableWebSocketUpdates) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<EntityDataChangedDetail>).detail;
      if (!detail || detail.entitySlug !== entitySlugRef.current) return;

      switch (detail.operation) {
        case 'created':
        case 'updated': {
          const id = detail.record?.id || detail.recordId;
          if (!id) { needsFullRef.current = true; scheduleFlush(); break; }
          // 'created' vence 'updated' para o mesmo id no mesmo lote
          if (pendingRef.current.get(id) !== 'created') pendingRef.current.set(id, detail.operation);
          scheduleFlush();
          break;
        }

        case 'deleted': {
          if (detail.recordId) {
            pendingRef.current.delete(detail.recordId);
            setRecords(prev => prev.filter(r => r.id !== detail.recordId));
            setTotalServerRecords(prev => Math.max(0, prev - 1));
          }
          break;
        }

        case 'refresh':
        default:
          needsFullRef.current = true;
          scheduleFlush();
          break;
      }
    };

    window.addEventListener('entity-data-changed', handler);
    return () => window.removeEventListener('entity-data-changed', handler);
  }, [entitySlug, scheduleFlush, disableWebSocketUpdates]);

  const isFullDataset = !serverMode && totalServerRecords <= DASHBOARD_MAX_LIMIT;

  return {
    records,
    isLoading,
    error,
    totalServerRecords,
    isFullDataset,
    serverMode,
    refresh: fetchAll,
  };
}
