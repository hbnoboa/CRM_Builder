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
