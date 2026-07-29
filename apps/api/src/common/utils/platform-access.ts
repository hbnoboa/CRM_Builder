// Acesso de PLATAFORMA é PERMISSÃO, não roleType.
// Substitui os checks `roleType === 'PLATFORM_ADMIN'` ao longo do redesenho (#11):
// poder de plataforma (alcançar qualquer tenant, gerir tenants, impersonar qualquer um)
// passa a vir de modulePermissions.platform.*. Nada hardcoded por nome de cargo.

function platformBlock(modulePermissions: unknown): Record<string, unknown> | undefined {
  const mp = modulePermissions as Record<string, unknown> | null | undefined;
  const p = mp?.platform;
  return p && typeof p === 'object' ? (p as Record<string, unknown>) : undefined;
}

/** Pode atuar fora do próprio tenant (alcançar/visualizar qualquer tenant). */
export function hasPlatformAccess(modulePermissions: unknown): boolean {
  return platformBlock(modulePermissions)?.crossTenant === true;
}

/** Pode impersonar usuários de qualquer tenant. */
export function canImpersonateAny(modulePermissions: unknown): boolean {
  return platformBlock(modulePermissions)?.impersonateAny === true;
}

/** Pode criar/suspender tenants. */
export function canManageTenants(modulePermissions: unknown): boolean {
  return platformBlock(modulePermissions)?.manageTenants === true;
}

/**
 * "Acesso total ao tenant": libera TODA permissão de módulo e de entidade DENTRO do
 * próprio tenant, de forma DINÂMICA (módulos/tabelas futuros já entram, sem re-grant).
 * NÃO dá poder de plataforma (cross-tenant/impersonar/gerir tenants) — isso continua
 * só em `platform.*`. É o análogo, para módulos, do coringa `*` das entidades.
 */
export function hasFullTenantAccess(modulePermissions: unknown): boolean {
  const mp = modulePermissions as Record<string, unknown> | null | undefined;
  return mp?.allAccess === true;
}
