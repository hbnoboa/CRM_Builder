'use client';

import type { PowerSyncDatabase } from '@powersync/web';
import api from '@/lib/api';

/**
 * Fotos tiradas no modo sem internet (igual ao app do celular): a foto fica guardada no
 * aparelho (IndexedDB), o campo recebe "local://<id>" e o registro e salvo normalmente.
 * Com internet, a foto sobe (/upload/image) e o "local://" vira o endereco real no
 * registro local, o que gera a alteracao que sobe para o servidor.
 */
export const LOCAL_PREFIX = 'local://';
const DB_NAME = 'crm-campo-fotos';
const STORE = 'fotos';
const MAX_SIDE = 1920;
const MAX_ATTEMPTS = 8;

export interface QueuedPhoto {
  id: string;
  tenantId: string;
  userId: string;
  recordId: string;
  fieldSlug: string;
  blob: Blob;
  name: string;
  createdAt: string;
  attempts: number;
  nextTryAt: number;
  /** Recusada pelo servidor (nao tenta de novo). */
  failed?: string;
}

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
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

/** Reduz a foto da camera (ate 1920 px, JPEG): menos espaco no aparelho e envio mais leve. */
async function compress(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // formato que o navegador nao abre: guarda como veio
  }
}

/** Guarda a foto no aparelho e devolve o valor do campo ("local://<id>"). */
export async function queuePhoto(owner: { tenantId: string; userId: string }, recordId: string, fieldSlug: string, file: File): Promise<string> {
  const id = crypto.randomUUID();
  const blob = await compress(file);
  const item: QueuedPhoto = {
    id, ...owner, recordId, fieldSlug, blob,
    name: `${fieldSlug}-${Date.now()}.jpg`,
    createdAt: new Date().toISOString(), attempts: 0, nextTryAt: 0,
  };
  await tx('readwrite', (s) => s.put(item));
  return `${LOCAL_PREFIX}${id}`;
}

export async function getQueuedPhoto(id: string): Promise<QueuedPhoto | undefined> {
  return tx('readonly', (s) => s.get(id) as IDBRequest<QueuedPhoto | undefined>);
}

export async function listQueuedPhotos(owner: { tenantId: string; userId: string }): Promise<QueuedPhoto[]> {
  return tx('readonly', (s) => s.index('owner').getAll([owner.tenantId, owner.userId]) as IDBRequest<QueuedPhoto[]>);
}

export async function removeQueuedPhoto(id: string) {
  await tx('readwrite', (s) => s.delete(id));
}

export async function clearQueuedPhotos(owner: { tenantId: string; userId: string }) {
  for (const item of await listQueuedPhotos(owner)) await removeQueuedPhoto(item.id);
}

let running = false;

/**
 * Envia as fotos pendentes (com internet). Falha temporaria espera e tenta de novo;
 * recusa do servidor fica marcada e aparece na tela de campo.
 */
export async function processPhotoQueue(db: PowerSyncDatabase, owner: { tenantId: string; userId: string }): Promise<void> {
  if (running || !navigator.onLine) return;
  running = true;
  try {
    for (const item of await listQueuedPhotos(owner)) {
      if (item.failed || item.nextTryAt > Date.now()) continue;
      const row = await db.getOptional<{ data: string }>('SELECT data FROM EntityData WHERE id = ?', [item.recordId]);
      if (!row) { await removeQueuedPhoto(item.id); continue; } // registro excluido
      try {
        const form = new FormData();
        form.append('image', item.blob, item.name);
        form.append('folder', 'images');
        const { data: up } = await api.post<{ url?: string; publicUrl?: string }>('/upload/image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        const url = up.publicUrl || up.url;
        if (!url) throw new Error('Envio sem endereco');
        // Troca o "local://" pelo endereco real (se o campo ainda aponta para esta foto)
        await db.writeTransaction(async (t) => {
          const fresh = await t.getOptional<{ data: string }>('SELECT data FROM EntityData WHERE id = ?', [item.recordId]);
          if (!fresh) return;
          const data = JSON.parse(fresh.data || '{}') as Record<string, unknown>;
          if (data[item.fieldSlug] !== `${LOCAL_PREFIX}${item.id}`) return;
          data[item.fieldSlug] = url;
          await t.execute('UPDATE EntityData SET data = ?, updatedAt = ? WHERE id = ?', [JSON.stringify(data), new Date().toISOString(), item.recordId]);
        });
        await removeQueuedPhoto(item.id);
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        const permanent = !!status && status >= 400 && status < 500 && ![401, 408, 429].includes(status);
        const attempts = item.attempts + 1;
        const next: QueuedPhoto = {
          ...item, attempts,
          nextTryAt: Date.now() + Math.min(30_000, 500 * 2 ** attempts),
          failed: permanent || attempts >= MAX_ATTEMPTS ? (error as Error).message || 'Foto recusada pelo servidor' : undefined,
        };
        await tx('readwrite', (s) => s.put(next));
        if (!status) break; // sem rede: para e tenta depois
      }
    }
  } finally {
    running = false;
  }
}
