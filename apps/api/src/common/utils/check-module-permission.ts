import { ForbiddenException } from '@nestjs/common';
import type { CurrentUser } from '../types';

/**
 * Permissoes padrao por roleType do sistema.
 * Replica a matriz do frontend (usePermissions) para que o backend
 * consiga validar roles sistema mesmo sem modulePermissions no banco.
 */
const DEFAULT_MODULE_PERMISSIONS: Record<string, Record<string, Record<string, boolean>>> = {
  MANAGER: {
    dashboard: { canRead: true },
    data: { canRead: true, canCreate: true, canUpdate: true },
    users: { canRead: true },
    roles: { canRead: true },
  },
  USER: {
    dashboard: { canRead: true },
    entities: { canRead: true, canCreate: true, canUpdate: true },
    data: { canRead: true, canCreate: true, canUpdate: true },
    users: { canRead: true },
  },
  VIEWER: {
    dashboard: { canRead: true },
    data: { canRead: true },
    settings: { canRead: true },
  },
};

/**
 * Verifica se o usuario tem uma permissao especifica em um modulo.
 * Lanca ForbiddenException se nao tiver.
 *
 * PLATFORM_ADMIN e ADMIN sempre tem todas as permissoes.
 * Para MANAGER/USER/VIEWER, checa modulePermissions do banco
 * e faz fallback para DEFAULT_MODULE_PERMISSIONS.
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
  if (modulePerm && modulePerm[action] === true) return;

  // Fallback: defaults para roles sistema (MANAGER, USER, VIEWER)
  if (roleType && roleType !== 'CUSTOM') {
    const defaults = DEFAULT_MODULE_PERMISSIONS[roleType];
    if (defaults?.[module]?.[action] === true) return;
  }

  throw new ForbiddenException(`Sem permissao: ${module}.${action}`);
}
