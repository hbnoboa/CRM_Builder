/** Datas relativas a hoje para os registros de exemplo (o painel sempre mostra "o ultimo mes"). */

export function daysAgo(days: number, hour = 8): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, (days * 7) % 60, 0, 0);
  return d.toISOString();
}

export function dateAhead(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dateAgo(days: number): string {
  return dateAhead(-days);
}

/**
 * Prazos dos registros em aberto, em dias a partir de hoje: alguns atrasados, um
 * vencendo hoje e o resto nas proximas semanas ("Minhas pendencias" fica realista).
 */
export const PRAZO_ESPALHADO = [-4, 1, -1, 3, 0, 6, 2, 10, -2, 14, 4, 8];

export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

/** Item ciclico de uma lista (exemplos deterministicos, sem aleatorio). */
export function cycle<T>(list: readonly T[], n: number): T {
  return list[n % list.length];
}
