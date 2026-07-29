import { ForbiddenException } from '@nestjs/common';
import { hasPlatformAccess, hasFullTenantAccess } from './platform-access';

// Governanca anti-escalada de privilegio.
// SUBSET RULE: ninguem concede (cria/edita/atribui) uma permissao que ele proprio
// nao tem. Quem tem acesso de plataforma tem tudo -> concede qualquer coisa.

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
): void {
  // Plataforma tem tudo; acesso total ao tenant (allAccess) possui todos os
  // modulos/tabelas do tenant -> pode conceder qualquer permissao dentro dele.
  if (hasPlatformAccess(actorModulePermissions) || hasFullTenantAccess(actorModulePermissions)) return;
  const missing = firstMissing(actorModulePermissions, requestedModulePermissions);
  if (missing) {
    throw new ForbiddenException(
      `Sem permissao para conceder: ${missing} (voce so concede permissoes que possui)`,
    );
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
 * Quem tem acesso de plataforma age sobre qualquer rank.
 */
export function assertCanActOnRank(
  actorModulePermissions: unknown,
  actorRank: number,
  targetRank: number,
): void {
  if (hasPlatformAccess(actorModulePermissions)) return;
  if (targetRank <= actorRank) {
    throw new ForbiddenException(
      `Acesso negado: voce so age sobre cargos de rank inferior (numero maior) ao seu (${actorRank})`,
    );
  }
}
