/**
 * Retorna o tenantId efetivo: SEMPRE o tenant ativo do usuario autenticado.
 * `_requestedTenantId` e ignorado (mantido so para nao mexer em todos os callers);
 * usuario de tenant nunca age fora do tenant em que tem membership ativa.
 */
export function getEffectiveTenantId(
  currentUser: { tenantId: string },
  _requestedTenantId?: string,
): string {
  return currentUser.tenantId;
}
