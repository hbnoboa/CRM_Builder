/** Encerramento da conta pedido pelo dono (Tenant.settings.closure). */
export interface TenantClosure {
  requestedAt: string;
  requestedById: string;
  requestedByEmail: string;
  reason: string | null;
  deleteAfter: string;
}

export const closureOf = (settings: unknown): TenantClosure | null => {
  const c = (settings as { closure?: TenantClosure } | null)?.closure;
  return c?.deleteAfter ? c : null;
};
