// Poder de PLATAFORMA (cross-tenant, impersonar qualquer um, gerir tenants) NAO existe
// mais em cargos de tenant: vive so no console da plataforma (modules/platform, staff
// proprio, JWT audience 'platform'). Aqui sobra apenas o "acesso total ao tenant".

/**
 * "Acesso total ao tenant": libera TODA permissão de módulo e de entidade DENTRO do
 * próprio tenant, de forma DINÂMICA (módulos/tabelas futuros já entram, sem re-grant).
 * Nunca alcança outros tenants. É o análogo, para módulos, do coringa `*` das entidades.
 */
export function hasFullTenantAccess(modulePermissions: unknown): boolean {
  const mp = modulePermissions as Record<string, unknown> | null | undefined;
  return mp?.allAccess === true;
}
