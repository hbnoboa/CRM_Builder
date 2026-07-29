import { ForbiddenException } from '@nestjs/common';
import type { CurrentUser } from '../types';
import { hasPlatformAccess, hasFullTenantAccess } from './platform-access';

/**
 * Verifica se o usuario tem uma permissao especifica em um modulo.
 * Lanca ForbiddenException se nao tiver.
 *
 * APENAS PLATFORM_ADMIN tem permissoes automaticas.
 * Todos os outros roles (ADMIN, MANAGER, USER, VIEWER, CUSTOM) devem ter
 * permissoes definidas em modulePermissions no banco de dados.
 */
export function checkModulePermission(
  user: CurrentUser,
  module: string,
  action: string,
): void {
  // Acesso de plataforma (permissao) libera tudo. (Antes: roleType PLATFORM_ADMIN.)
  if (hasPlatformAccess(user.customRole?.modulePermissions)) return;
  if (hasFullTenantAccess(user.customRole?.modulePermissions)) return;

  // Todos os outros roles verificam modulePermissions do DB
  const mp = user.customRole?.modulePermissions as Record<string, Record<string, boolean>> | undefined;
  const modulePerm = mp?.[module];

  // Se modulo tem permissoes definidas, verificar acao
  if (modulePerm !== undefined && typeof modulePerm === 'object') {
    if (modulePerm[action] === true) return;
  }

  // Sem permissao
  throw new ForbiddenException(`Sem permissao: ${module}.${action}`);
}

/**
 * Verifica se o usuario tem uma acao sub-granular para uma entidade especifica.
 * Checa AMBAS as fontes: module-level (modulePermissions.data) E entity-level (permissions[entitySlug]).
 * Se qualquer uma concede → permite.
 *
 * Usado para: canConfigureColumns, canExport, canImport
 */
export function checkEntityAction(
  user: CurrentUser,
  entitySlug: string,
  action: string,
): void {
  // Acesso de plataforma (permissao) libera tudo. (Antes: roleType PLATFORM_ADMIN.)
  if (hasPlatformAccess(user.customRole?.modulePermissions)) return;
  if (hasFullTenantAccess(user.customRole?.modulePermissions)) return;

  // 1. Checar module-level (modulePermissions.data[action])
  const mp = user.customRole?.modulePermissions as Record<string, Record<string, boolean>> | undefined;
  if (mp?.data?.[action] === true) return;

  // 2. Checar entity-level (permissions[entitySlug][action])
  const permissions = user.customRole?.permissions as Array<Record<string, unknown>> | undefined;
  if (permissions) {
    const entityPerm = permissions.find((p) => p.entitySlug === entitySlug);
    if (entityPerm?.[action] === true) return;
  }

  throw new ForbiddenException(`Sem permissao: ${entitySlug}.${action}`);
}
