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

/** Modulos da camada "administracao da empresa" (o resto e operacao). */
export const ADMIN_AREA_MODULES = [
  'entities', 'users', 'roles', 'settings', 'automations', 'templates', 'logs', 'publicLinks', 'apis',
] as const;

/** Quem entra na administracao da empresa: acesso total ou alguma permissao de gestao. */
export function hasAdminArea(modulePermissions: unknown): boolean {
  if (hasFullTenantAccess(modulePermissions)) return true;
  const mp = (modulePermissions ?? {}) as Record<string, unknown>;
  return ADMIN_AREA_MODULES.some((key) => {
    const perm = mp[key];
    if (perm === true) return true;
    if (!perm || typeof perm !== 'object') return false;
    const p = perm as Record<string, unknown>;
    // settings: so editar a organizacao; templates: ver/gerar e operacao (gerar PDF).
    if (key === 'settings') return p.canUpdate === true;
    if (key === 'templates') return p.canCreate === true || p.canUpdate === true || p.canDelete === true;
    return Object.values(p).some((v) => v === true);
  });
}
