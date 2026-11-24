import { isAxiosError } from 'axios';

/**
 * Falha passageira de rede: sem resposta (sem sinal, tempo esgotado, conexao caiu no meio)
 * ou proxy/servidor fora do ar. Vale tentar de novo; o resto (4xx, 500) e resposta de verdade.
 */
export function isTransientError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  if (error.code === 'ERR_CANCELED') return false;
  const status = error.response?.status;
  return !status || [408, 429, 502, 503, 504].includes(status);
}

/** Espera crescente entre tentativas: 2s, 4s, 8s... ate 30s. */
export function retryDelay(attempt: number): number {
  return Math.min(2000 * 2 ** attempt, 30_000);
}

/**
 * Espera `ms` e, se o aparelho estiver sem rede, ate ela voltar. Para na hora se `signal`
 * for abortado (tela fechada).
 */
export function waitToRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('online', check);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const check = () => {
      if (signal.aborted || navigator.onLine) done();
    };
    const timer = setTimeout(() => {
      if (navigator.onLine) done();
      else window.addEventListener('online', check);
    }, ms);
    signal.addEventListener('abort', done);
  });
}
