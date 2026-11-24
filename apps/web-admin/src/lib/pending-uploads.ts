'use client';

import { useSyncExternalStore } from 'react';

/**
 * Envios de arquivo em andamento na tela. O formulario espera todos terminarem antes de
 * salvar: senao o registro sobe sem a foto que ainda estava indo (sinal ruim).
 */
let count = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function trackUpload<T>(promise: Promise<T>): Promise<T> {
  count++;
  emit();
  return promise.finally(() => {
    count--;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePendingUploads(): number {
  return useSyncExternalStore(subscribe, () => count, () => 0);
}
