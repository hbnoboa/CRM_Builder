'use client';

import type { PowerSyncDatabase } from '@powersync/web';
import api from '@/lib/api';

/**
 * Fotos tiradas no modo sem internet (igual ao app do celular): a foto fica guardada no
 * aparelho (IndexedDB), o campo recebe "local://<id>" e o registro e salvo normalmente.
 * Na hora de enviar o registro (connector.uploadData), cada "local://" sobe antes e vira
 * o endereco real: o servidor nunca recebe "local://", e um registro que some do aparelho
 * depois de enviado (ex.: veiculo concluido, que o cargo deixa de ver) ja foi com as fotos.
 */
export const LOCAL_PREFIX = 'local://';
const DB_NAME = 'crm-campo-fotos';
const STORE = 'fotos';
const MAX_SIDE = 1920;
/** Envio de foto travado em sinal ruim: desiste desta vez e tenta de novo depois. */
const UPLOAD_TIMEOUT_MS = 90_000;
/** Foto de formulario abandonado (nunca salvo) sai do aparelho depois disso. */
const ABANDONED_MS = 24 * 60 * 60 * 1000;

export interface QueuedPhoto {
  id: string;
  tenantId: string;
  userId: string;
  recordId: string;
  fieldSlug: string;
  blob: Blob;
  name: string;
  createdAt: string;
  /** Endereco depois de enviada. A foto fica ate o registro subir com ele (o mesmo
   *  "local://" pode estar em mais de uma alteracao na fila). */
  url?: string;
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
    createdAt: new Date().toISOString(),
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

/** Resultado do envio: endereco real, ou null com o motivo (foto apagada ou recusada). */
export type PhotoUpload = { url: string } | { url: null; reason?: string };

/**
 * Envia uma foto da fila (ou devolve o endereco, se ja subiu). Falta de rede ou servidor
 * fora: lanca o erro, e quem chamou tenta de novo depois, sem limite de tentativas (no
 * campo a internet cai o tempo todo). So a recusa do servidor (4xx) desiste da foto.
 */
export async function uploadQueuedPhoto(id: string): Promise<PhotoUpload> {
  const item = await getQueuedPhoto(id);
  if (!item) return { url: null };
  if (item.url) return { url: item.url };
  try {
    const form = new FormData();
    form.append('image', item.blob, item.name);
    form.append('folder', 'images');
    const { data: up } = await api.post<{ url?: string; publicUrl?: string }>('/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    });
    const url = up.publicUrl || up.url;
    if (!url) throw new Error('Envio sem endereco');
    await tx('readwrite', (s) => s.put({ ...item, url }));
    return { url };
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (!status || status >= 500 || [401, 408, 429].includes(status)) throw error;
    const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
    return { url: null, reason: (Array.isArray(message) ? message.join(', ') : message) || 'Foto recusada pelo servidor' };
  }
}

/** Ids de "local://" ainda presentes na fila de alteracoes (o registro nao subiu). */
async function pendingRefs(db: PowerSyncDatabase): Promise<string> {
  const rows = await db.getAll<{ data: string | null }>('SELECT data FROM ps_crud');
  return rows.map((r) => r.data ?? '').join('\n');
}

/** Fotos que ainda vao subir (o registro delas esta na fila e a foto nao subiu). */
export async function countPendingPhotos(db: PowerSyncDatabase, owner: { tenantId: string; userId: string }): Promise<number> {
  const refs = await pendingRefs(db);
  return (await listQueuedPhotos(owner)).filter((i) => !i.url && refs.includes(`${LOCAL_PREFIX}${i.id}`)).length;
}

/**
 * Tira do aparelho as fotos que nao fazem mais falta: ja subiram e o registro nao aponta
 * mais para o "local://" (subiu com o endereco real), ou ficaram de um formulario
 * abandonado sem salvar. Foto que ainda nao subiu e nao esta em nada salvo pode ser de um
 * formulario aberto agora (ex.: veiculo ainda nao salvo enquanto se cria a NC): fica.
 */
export async function cleanPhotoQueue(db: PowerSyncDatabase, owner: { tenantId: string; userId: string }): Promise<void> {
  const refs = await pendingRefs(db);
  for (const item of await listQueuedPhotos(owner)) {
    const ref = `${LOCAL_PREFIX}${item.id}`;
    if (refs.includes(ref)) continue; // registro ainda na fila
    const row = await db.getOptional<{ data: string | null }>('SELECT data FROM EntityData WHERE id = ?', [item.recordId]);
    if (row?.data?.includes(ref)) continue; // registro no aparelho ainda aponta para ela
    if (!item.url && Date.now() - Date.parse(item.createdAt) < ABANDONED_MS) continue;
    await removeQueuedPhoto(item.id);
  }
}
