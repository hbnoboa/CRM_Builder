import { ForbiddenException } from '@nestjs/common';
import type { CurrentUser } from '../types';

/**
 * Verifica se o usuario tem uma permissao especifica em um modulo.
 * Lanca ForbiddenException se nao tiver.
 *
 * PLATFORM_ADMIN e ADMIN sempre tem todas as permissoes.
 */
export function checkModulePermission(
  user: CurrentUser,
  module: string,
  action: string,
): void {
  const roleType = user.customRole?.roleType;

  // PLATFORM_ADMIN e ADMIN tem tudo
  if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') return;

  const mp = user.customRole?.modulePermissions as Record<string, Record<string, boolean>> | undefined;
  const modulePerm = mp?.[module];

  if (!modulePerm || modulePerm[action] !== true) {
    throw new ForbiddenException(`Sem permissao: ${module}.${action}`);
  }
}
