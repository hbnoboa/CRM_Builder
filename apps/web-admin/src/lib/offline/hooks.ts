'use client';

import { useEffect, useState } from 'react';
import type { PowerSyncDatabase, SyncStatus } from '@powersync/web';

/** Consulta ao banco local que se atualiza sozinha quando os dados mudam. */
export function useLocalQuery<T>(db: PowerSyncDatabase | null, sql: string, params: unknown[] = []): { data: T[]; loading: boolean } {
  const [state, setState] = useState<{ data: T[]; loading: boolean }>({ data: [], loading: true });
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!db) return;
    const abort = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    db.watch(sql, params, {
      onResult: (result) => setState({ data: (result.rows?._array ?? []) as T[], loading: false }),
      onError: () => setState({ data: [], loading: false }),
    }, { signal: abort.signal });
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, sql, key]);
  return state;
}

/** Situacao da sincronizacao (conectado, baixando, ultima vez) e alteracoes na fila. */
export function useOfflineStatus(db: PowerSyncDatabase | null) {
  const [status, setStatus] = useState<SyncStatus | null>(db?.currentStatus ?? null);
  const pending = useLocalQuery<{ n: number }>(db, 'SELECT count(*) AS n FROM ps_crud');
  useEffect(() => {
    if (!db) return;
    setStatus(db.currentStatus);
    return db.registerListener({ statusChanged: (s) => setStatus(s) });
  }, [db]);
  return { status, pending: Number(pending.data[0]?.n ?? 0) };
}
