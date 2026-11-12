export type FieldPermission = { fieldSlug: string; canView: boolean; canEdit: boolean };

/**
 * fieldPermissions guarda so as excecoes: campo sem entrada e livre para ver e editar
 * (e o que a tela de cargos mostra e grava).
 */
export function hiddenFieldSlugs(fieldPerms: FieldPermission[] | null | undefined): Set<string> {
  return new Set((fieldPerms ?? []).filter((f) => !f.canView).map((f) => f.fieldSlug));
}

export function readOnlyFieldSlugs(fieldPerms: FieldPermission[] | null | undefined): Set<string> {
  return new Set((fieldPerms ?? []).filter((f) => !f.canEdit).map((f) => f.fieldSlug));
}

export function omitFields<T>(data: T, slugs: Set<string>): T {
  if (slugs.size === 0 || !data || typeof data !== 'object') return data;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!slugs.has(key)) result[key] = value;
  }
  return result as T;
}

/**
 * Cargo com algum campo oculto (fora do acesso total): no app, recebe so a copia
 * dos registros sem esses campos (EntityDataMasked). Mesma regra de
 * role_has_hidden_fields() no banco.
 */
export function roleHasHiddenFields(role: { permissions?: unknown; modulePermissions?: unknown } | null | undefined): boolean {
  if (!role) return false;
  const modules = (role.modulePermissions ?? {}) as Record<string, unknown>;
  if (modules.allAccess === true) return false;
  const perms = Array.isArray(role.permissions) ? (role.permissions as Array<{ fieldPermissions?: unknown }>) : [];
  return perms.some((p) => Array.isArray(p.fieldPermissions)
    && (p.fieldPermissions as Array<{ canView?: unknown }>).some((f) => f.canView === false));
}
