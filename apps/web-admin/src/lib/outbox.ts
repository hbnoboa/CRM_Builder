'use client';

import { useSyncExternalStore } from 'react';
import { dataService } from '@/services/data.service';
import { isTransientError } from '@/lib/network-retry';
import { LOCAL_PREFIX, removeQueuedPhoto, uploadQueuedPhoto } from '@/lib/offline/photo-queue';

/**
 * Fila de envio da tela normal (igual ao app do celular): salvar sem internet, ou com a
 * conexao caindo no meio, guarda a alteracao no aparelho (IndexedDB) e libera a tela. A
 * fila sobe sozinha quando a internet volta, inclusive depois de fechar e abrir o sistema.
 * Registro novo leva o id gerado no aparelho: repetir o envio nao duplica.
 */
const DB_NAME = 'crm-fila';
const STORE = 'envios';

export type Owner = { tenantId: string; userId: string };

export interface OutboxItem {
  key: string;
  tenantId: string;
  userId: string;
  op: 'create' | 'update';
  entitySlug: string;
  entityName?: string;
  recordId: string;
  parentRecordId?: string;
  data: Record<string, unknown>;
  createdAt: string;
  /** Recusado pelo servidor (ex.: campo invalido): fica parado ate a pessoa descartar. */
  error?: string;
}

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'key' });
      store.createIndex('owner', ['tenantId', 'userId']);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openStore();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function list(owner: Owner): Promise<OutboxItem[]> {
  const items = await tx('readonly', (s) => s.index('owner').getAll([owner.tenantId, owner.userId]) as IDBRequest<OutboxItem[]>);
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ─── Estado para a tela (quantas faltam, quais foram recusadas) ─────────────────
type Snapshot = { items: OutboxItem[]; sending: boolean };
let snapshot: Snapshot = { items: [], sending: false };
let currentOwner: Owner | null = null;
const listeners = new Set<() => void>();

function publish(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

async function refresh() {
  if (currentOwner) publish({ items: await list(currentOwner) });
}

export function useOutbox(): Snapshot {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => snapshot,
    () => snapshot,
  );
}

/** Dados ainda na fila para um registro (para a tela mostrar o que ja foi salvo). */
export function pendingData(items: OutboxItem[], recordId: string): Record<string, unknown> | null {
  const mine = items.filter((i) => i.recordId === recordId);
  return mine.length ? Object.assign({}, ...mine.map((i) => i.data)) : null;
}

// ─── Enfileirar e enviar ────────────────────────────────────────────────────────
export async function enqueue(owner: Owner, item: Omit<OutboxItem, 'key' | 'tenantId' | 'userId' | 'createdAt'>) {
  const full: OutboxItem = { ...item, ...owner, key: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await tx('readwrite', (s) => s.put(full));
  currentOwner = owner;
  await refresh();
  void processOutbox(owner);
}

export async function discard(key: string) {
  const item = await tx('readonly', (s) => s.get(key) as IDBRequest<OutboxItem | undefined>);
  await tx('readwrite', (s) => s.delete(key));
  if (item) await dropUnusedPhotos(item, item);
  await refresh();
}

/** Fotos do item que nenhum outro envio da fila usa (o mesmo "local://" pode estar em dois). */
async function dropUnusedPhotos(owner: Owner, item: OutboxItem) {
  const still = await outboxRefs(owner);
  for (const ref of localRefs(item.data)) if (!still.has(ref)) await removeQueuedPhoto(ref).catch(() => undefined);
}

/** Ids das fotos guardadas no aparelho ("local://<id>") que o registro usa. */
export function localRefs(data: Record<string, unknown>): string[] {
  const refs: string[] = [];
  for (const value of Object.values(data)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      if (typeof v === 'string' && v.startsWith(LOCAL_PREFIX)) refs.push(v.slice(LOCAL_PREFIX.length));
    }
  }
  return refs;
}

/** Todas as referencias "local://" que a fila ainda vai usar (as fotos nao podem sair do aparelho). */
export async function outboxRefs(owner: Owner): Promise<Set<string>> {
  return new Set((await list(owner)).flatMap((i) => localRefs(i.data)));
}

/**
 * Sobe as fotos "local://" e troca pelo endereco real. Sem rede lanca o erro (tenta de
 * novo depois). Foto recusada pelo servidor sai do registro e volta como aviso.
 */
export async function withUploadedPhotos(data: Record<string, unknown>): Promise<{ data: Record<string, unknown>; warnings: string[] }> {
  const out: Record<string, unknown> = { ...data };
  const warnings: string[] = [];
  const resolve = async (v: unknown) => {
    if (typeof v !== 'string' || !v.startsWith(LOCAL_PREFIX)) return v;
    const result = await uploadQueuedPhoto(v.slice(LOCAL_PREFIX.length));
    if (result.url === null && result.reason) warnings.push(result.reason);
    return result.url;
  };
  for (const [slug, value] of Object.entries(data)) {
    if (Array.isArray(value)) out[slug] = (await Promise.all(value.map(resolve))).filter((v) => v !== null);
    else out[slug] = await resolve(value);
  }
  return { data: out, warnings };
}

function errorMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return (Array.isArray(message) ? message.join(', ') : message) || 'O servidor recusou a alteração';
}

let running: Promise<number> | null = null;
let onSent: (() => void) | null = null;

/** Quem mostra listas avisa aqui para recarregar quando algo da fila subir. */
export function setOnSent(fn: (() => void) | null) {
  onSent = fn;
}

/** Envia a fila em ordem. Para no primeiro erro de rede (tenta de novo depois). */
export function processOutbox(owner: Owner): Promise<number> {
  currentOwner = owner;
  if (running) return running;
  running = (async () => {
    let sent = 0;
    try {
      const items = await list(owner);
      publish({ items });
      if (!items.some((i) => !i.error) || (typeof navigator !== 'undefined' && !navigator.onLine)) return 0;
      publish({ sending: true });
      for (const item of items) {
        if (item.error) continue;
        try {
          const { data } = await withUploadedPhotos(item.data);
          if (item.op === 'create') await dataService.create(item.entitySlug, data, item.parentRecordId, item.recordId);
          else await dataService.update(item.entitySlug, item.recordId, data);
          await tx('readwrite', (s) => s.delete(item.key));
          await dropUnusedPhotos(owner, item);
          sent++;
        } catch (error) {
          if (isTransientError(error) || !(error as { response?: unknown })?.response) break; // sem rede: depois
          await tx('readwrite', (s) => s.put({ ...item, error: errorMessage(error) }));
        }
        await refresh();
      }
    } finally {
      publish({ sending: false });
      await refresh().catch(() => undefined);
      running = null;
      if (sent) onSent?.();
    }
    return sent;
  })();
  return running;
}
