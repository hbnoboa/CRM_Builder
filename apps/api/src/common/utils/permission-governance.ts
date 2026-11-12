import { ForbiddenException } from '@nestjs/common';
import { hasFullTenantAccess } from './platform-access';

// Governanca anti-escalada de privilegio.
// SUBSET RULE: ninguem concede (cria/edita/atribui) uma permissao que ele proprio
// nao tem. Quem tem allAccess possui tudo DO TENANT -> concede qualquer coisa dentro dele.

// Modulos que dao poder sobre OUTRAS empresas (fora do proprio tenant). Bloqueio
// INCONDICIONAL: ninguem os concede num cargo de tenant (vivem so no console da plataforma).
const ABOVE_TENANT_MODULES = ['platform', 'tenants'] as const;

// Retorna o caminho da primeira permissao pedida que o ator NAO tem (ou null).
function firstMissing(actor: unknown, requested: unknown): string | null {
  if (requested === true) {
    return actor === true ? null : '';
  }
  if (requested && typeof requested === 'object') {
    const a = (actor || {}) as Record<string, unknown>;
    const r = requested as Record<string, unknown>;
    for (const key of Object.keys(r)) {
      const sub = firstMissing(a[key], r[key]);
      if (sub !== null) return sub === '' ? key : `${key}.${sub}`;
    }
  }
  return null;
}

/**
 * Garante que `requestedModulePermissions` seja subconjunto das permissoes do ator.
 * Lanca ForbiddenException no primeiro item que o ator nao possui.
 */
export function assertPermissionsSubset(
  actorModulePermissions: unknown,
  requestedModulePermissions: unknown,
  // Antes liberava manter platform.*/tenants ja existentes; hoje ignorado (bloqueio incondicional).
  _currentModulePermissions?: unknown,
): void {
  // Poder ACIMA do tenant (platform.*, tenants) nunca pode ser concedido num cargo
  // de tenant, por ninguem. So bloqueia se o pedido liga algo (valor `true`).
  const requested = (requestedModulePermissions || {}) as Record<string, unknown>;
  for (const key of ABOVE_TENANT_MODULES) {
    const missing = firstMissing(undefined, requested[key]);
    if (missing !== null) {
      throw new ForbiddenException(
        `Sem permissao para conceder: ${missing ? `${key}.${missing}` : key} (acesso de plataforma so pelo console da plataforma)`,
      );
    }
  }

  // Acesso total ao tenant (allAccess) possui todos os modulos/tabelas do tenant ->
  // pode conceder qualquer permissao dentro dele.
  if (hasFullTenantAccess(actorModulePermissions)) return;
  const missing = firstMissing(actorModulePermissions, requestedModulePermissions);
  if (missing) {
    throw new ForbiddenException(
      `Sem permissao para conceder: ${missing} (voce so concede permissoes que possui)`,
    );
  }
}

type EntityPerm = {
  entitySlug?: string;
  scope?: string;
  dataFilters?: unknown[];
  fieldPermissions?: Array<{ fieldSlug: string; canView?: boolean; canEdit?: boolean }>;
  [key: string]: unknown;
};

const ENTITY_FLAGS = [
  'canRead', 'canCreate', 'canUpdate', 'canDelete',
  'canExport', 'canImport', 'canConfigureColumns', 'canEditLocked',
] as const;
// Quanto maior, mais registros o escopo enxerga.
// 'client' mostra registros que a pessoa nao criou (os do cliente): exige quem concede ver mais que os proprios.
const SCOPE_BREADTH: Record<string, number> = { own: 0, team: 1, client: 1, all: 2 };

/**
 * SUBSET RULE tambem por tabela: o cargo concedido nao pode ler/criar/editar/excluir/
 * exportar... onde o ator nao pode, nem com escopo mais amplo, sem os filtros de dados
 * do ator ou vendo campos que o ator nao ve. Regra da tabela = a especifica ou o coringa '*'.
 */
export function assertEntityPermissionsSubset(
  actorModulePermissions: unknown,
  actorPermissions: unknown,
  requestedPermissions: unknown,
): void {
  if (hasFullTenantAccess(actorModulePermissions)) return;
  const actor = (Array.isArray(actorPermissions) ? actorPermissions : []) as EntityPerm[];
  const requested = (Array.isArray(requestedPermissions) ? requestedPermissions : []) as EntityPerm[];
  const actorRule = (slug: string): EntityPerm | undefined =>
    actor.find((p) => p.entitySlug === slug) ?? (slug === '*' ? undefined : actor.find((p) => p.entitySlug === '*'));

  for (const req of requested) {
    const slug = req.entitySlug ?? '';
    const label = slug === '*' ? 'todas as tabelas' : slug;
    const mine = actorRule(slug);
    const deny = (what: string): never => {
      throw new ForbiddenException(`Sem permissao para conceder: ${what} em ${label} (voce so concede permissoes que possui)`);
    };
    for (const flag of ENTITY_FLAGS) {
      if (req[flag] === true && mine?.[flag] !== true) deny(flag);
    }
    // Sem nenhuma acao ligada, escopo/filtros/campos nao dao acesso a nada.
    if (!ENTITY_FLAGS.some((f) => req[f] === true)) continue;
    const reqScope = SCOPE_BREADTH[req.scope ?? 'all'] ?? 2;
    const myScope = SCOPE_BREADTH[mine?.scope ?? 'all'] ?? 2;
    if (reqScope > myScope) deny(`escopo "${req.scope ?? 'all'}"`);
    const reqFilters = (req.dataFilters ?? []).map((f) => JSON.stringify(f));
    for (const f of mine?.dataFilters ?? []) {
      if (!reqFilters.includes(JSON.stringify(f))) deny('registros fora dos seus filtros de dados');
    }
    for (const fp of mine?.fieldPermissions ?? []) {
      const r = (req.fieldPermissions ?? []).find((x) => x.fieldSlug === fp.fieldSlug);
      if (fp.canView === false && r?.canView !== false) deny(`ver o campo ${fp.fieldSlug}`);
      if (fp.canEdit === false && r?.canEdit !== false) deny(`editar o campo ${fp.fieldSlug}`);
    }
  }
}

/**
 * Bloqueia acoes SENSIVEIS/nucleares quando a sessao e de impersonacao.
 * (Ex.: gestao de cargos/permissoes/membership; impersonar de novo.)
 * A acao sai atribuida ao ator real via impersonatedBy no audit, mas nao executa.
 */
export function assertNotImpersonating(
  actor: { impersonatedBy?: { id: string; name: string } },
  action = 'esta acao',
): void {
  if (actor.impersonatedBy) {
    throw new ForbiddenException(
      `Acao sensivel bloqueada em sessao de impersonacao: ${action}`,
    );
  }
}

/**
 * RANK RULE: voce so age sobre cargos/pessoas de rank ESTRITAMENTE MAIOR
 * (numero maior = menos poder). Rank igual ou menor = intocavel.
 * Sem excecoes (nao ha mais bypass de plataforma em cargo de tenant).
 */
export function assertCanActOnRank(actorRank: number, targetRank: number): void {
  if (targetRank <= actorRank) {
    throw new ForbiddenException(
      `Acesso negado: voce so age sobre cargos de rank inferior (numero maior) ao seu (${actorRank})`,
    );
  }
}
