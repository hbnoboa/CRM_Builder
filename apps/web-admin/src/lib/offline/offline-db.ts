'use client';

import type { PowerSyncDatabase } from '@powersync/web';
import type { OfflineConnector } from './connector';
import { setOfflineEnabled } from './flags';

export { offlineEnabled, setOfflineEnabled } from './flags';

/**
 * Banco local do modo sem internet: um arquivo por pessoa e empresa no aparelho.
 * O SDK roda num worker (arquivos em /@powersync/, copiados no build). Carregado sob
 * demanda: so quem liga "Usar sem internet neste aparelho" baixa esse codigo.
 */
let current: { key: string; db: PowerSyncDatabase; connector: OfflineConnector } | null = null;

export async function openOfflineDb(tenantId: string, userId: string) {
  const key = `${tenantId}:${userId}`;
  if (current?.key === key) return current;
  if (current) await current.db.close();
  const { PowerSyncDatabase, WASQLiteVFS } = await import('@powersync/web');
  const { OfflineSchema } = await import('./schema');
  const db = new PowerSyncDatabase({
    schema: OfflineSchema,
    database: {
      dbFilename: `campo-${tenantId}-${userId}.db`,
      // IndexedDB: funciona em todos os navegadores (inclusive Safari/iPhone)
      vfs: WASQLiteVFS.IDBBatchAtomicVFS,
      worker: '/@powersync/worker.js',
    },
    sync: { worker: '/@powersync/worker.js' },
  });
  await db.init();
  const { OfflineConnector } = await import('./connector');
  const connector = new OfflineConnector();
  current = { key, db, connector };
  return current;
}

/** Liga a sincronizacao (baixa e mantem os dados; envia o que foi feito sem internet). */
export async function connectOffline(tenantId: string, userId: string) {
  const handle = await openOfflineDb(tenantId, userId);
  await handle.db.connect(handle.connector);
  return handle;
}

/** Desliga e apaga os dados deste aparelho (para esta pessoa e empresa). */
export async function removeOfflineData(tenantId: string, userId: string) {
  const handle = await openOfflineDb(tenantId, userId);
  await handle.db.disconnectAndClear();
  await handle.db.close();
  current = null;
  setOfflineEnabled(tenantId, userId, false);
}
