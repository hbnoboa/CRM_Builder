import { hasPlatformAccess } from './platform-access';

/**
 * Retorna o tenantId efetivo. Quem tem acesso de PLATAFORMA (permissao
 * platform.crossTenant) pode acessar qualquer tenant solicitado.
 * Para os demais, sempre retorna o tenantId do usuario autenticado.
 * (Antes dependia de roleType === 'PLATFORM_ADMIN'.)
 */
export function getEffectiveTenantId(
  currentUser: { tenantId: string; customRole?: { modulePermissions?: unknown } },
  requestedTenantId?: string,
): string {
  if (hasPlatformAccess(currentUser.customRole?.modulePermissions) && requestedTenantId) {
    return requestedTenantId;
  }
  return currentUser.tenantId;
}
