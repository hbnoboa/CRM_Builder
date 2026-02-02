import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator para definir permissões necessárias em um endpoint
 * 
 * @example
 * @RequirePermissions('data:read:all')
 * @RequirePermissions('cliente:update:own', 'cliente:update:team')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
