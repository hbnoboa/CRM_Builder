import { RoleType } from '@crm-builder/shared';

/**
 * Retorna o tenantId efetivo. PLATFORM_ADMIN pode acessar qualquer tenant.
 * Para outros roles, sempre retorna o tenantId do usuario autenticado.
 */
export function getEffectiveTenantId(
  currentUser: { tenantId: string; customRole?: { roleType: string } },
  requestedTenantId?: string,
): string {
  const roleType = currentUser.customRole?.roleType as RoleType | undefined;
  if (roleType === 'PLATFORM_ADMIN' && requestedTenantId) {
    return requestedTenantId;
  }
  return currentUser.tenantId;
}
