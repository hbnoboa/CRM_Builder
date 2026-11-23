/**
 * Permissoes no modo sem internet, a partir do cargo sincronizado (mesma resolucao da API:
 * a regra da tabela ou o coringa '*'; acesso total libera tudo). Os registros ja chegam
 * filtrados pelo cargo (escopo, filtros e campos ocultos) nas regras de sincronizacao.
 */
export interface OfflineRole {
  permissions: unknown;
  modulePermissions: unknown;
}

type EntityPerm = {
  entitySlug: string;
  canRead?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  fieldPermissions?: Array<{ fieldSlug: string; canView?: boolean; canEdit?: boolean }>;
};

const parse = <T,>(v: unknown, fallback: T): T => {
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return (v ?? fallback) as T;
};

export function fullAccess(role: OfflineRole | null): boolean {
  return parse<Record<string, unknown>>(role?.modulePermissions, {}).allAccess === true;
}

function entityPerm(role: OfflineRole | null, slug: string): EntityPerm | undefined {
  const perms = parse<EntityPerm[]>(role?.permissions, []);
  return perms.find((p) => p.entitySlug === slug) ?? perms.find((p) => p.entitySlug === '*');
}

export function can(role: OfflineRole | null, slug: string, action: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'): boolean {
  if (fullAccess(role)) return true;
  return entityPerm(role, slug)?.[action] === true;
}

/** Campos escondidos e so leitura para o cargo nesta tabela. */
export function fieldRules(role: OfflineRole | null, slug: string) {
  if (fullAccess(role)) return { hidden: new Set<string>(), readOnly: new Set<string>() };
  const fp = entityPerm(role, slug)?.fieldPermissions ?? [];
  return {
    hidden: new Set(fp.filter((f) => f.canView === false).map((f) => f.fieldSlug)),
    readOnly: new Set(fp.filter((f) => f.canEdit === false).map((f) => f.fieldSlug)),
  };
}
