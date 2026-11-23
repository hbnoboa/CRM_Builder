/** Modo sem internet ligado neste aparelho (por empresa e pessoa). Leve: sem o SDK. */
const FLAG = (tenantId: string, userId: string) => `offline:${tenantId}:${userId}`;

export function offlineEnabled(tenantId: string, userId: string): boolean {
  try {
    return localStorage.getItem(FLAG(tenantId, userId)) === '1';
  } catch {
    return false;
  }
}

export function setOfflineEnabled(tenantId: string, userId: string, on: boolean) {
  try {
    if (on) localStorage.setItem(FLAG(tenantId, userId), '1');
    else localStorage.removeItem(FLAG(tenantId, userId));
  } catch {
    /* sem armazenamento: o modo nao fica ligado */
  }
}
