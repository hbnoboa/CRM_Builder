import { ForbiddenException } from '@nestjs/common';
import type { CurrentUser } from '../types';

/**
 * Permissoes padrao por roleType do sistema.
 * Usado APENAS como fallback quando modulePermissions no DB nao define o modulo.
 */
const DEFAULT_MODULE_PERMISSIONS: Record<string, Record<string, Record<string, boolean>>> = {
  MANAGER: {
    dashboard: { canRead: true },
    data: { canRead: true, canCreate: true, canUpdate: true },
    users: { canRead: true },
    roles: { canRead: true },
    pdfTemplates: { canRead: true, canGenerate: true },
  },
  USER: {
    dashboard: { canRead: true },
    entities: { canRead: true, canCreate: true, canUpdate: true },
    data: { canRead: true, canCreate: true, canUpdate: true },
    users: { canRead: true },
    settings: { canRead: true },
    pdfTemplates: { canRead: true, canGenerate: true },
  },
  VIEWER: {
    dashboard: { canRead: true },
    data: { canRead: true },
    settings: { canRead: true },
    pdfTemplates: { canRead: true, canGenerate: true },
  },
};

/**
 * Verifica se o usuario tem uma permissao especifica em um modulo.
 * Lanca ForbiddenException se nao tiver.
 *
 * PLATFORM_ADMIN e ADMIN sempre tem todas as permissoes.
 * Se o DB define o modulo → usa exclusivamente o valor do DB.
 * Se o DB NAO define o modulo → fallback para DEFAULT_MODULE_PERMISSIONS.
 */
export function checkModulePermission(
  user: CurrentUser,
  module: string,
  action: string,
): void {
  const roleType = user.customRole?.roleType;

  // PLATFORM_ADMIN e ADMIN tem tudo
  if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') return;

  // Checar modulePermissions do customRole (banco)
  const mp = user.customRole?.modulePermissions as Record<string, Record<string, boolean>> | undefined;
  const modulePerm = mp?.[module];

  // Se DB tem valor para este modulo → usar exclusivamente
  if (modulePerm !== undefined) {
    if (modulePerm[action] === true) return;
    throw new ForbiddenException(`Sem permissao: ${module}.${action}`);
  }

  // Fallback: so se DB NAO define este modulo (roles sistema sem campo preenchido)
  if (roleType && roleType !== 'CUSTOM') {
    const defaults = DEFAULT_MODULE_PERMISSIONS[roleType];
    if (defaults?.[module]?.[action] === true) return;
  }

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
  const roleType = user.customRole?.roleType;

  // PLATFORM_ADMIN e ADMIN tem tudo
  if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') return;

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
