import { SetMetadata } from '@nestjs/common';

// Tipos de role do sistema (substituindo UserRole enum)
export type RoleType = 'PLATFORM_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' | 'CUSTOM';

export const ROLES_KEY = 'roles';

/**
 * Decorator para definir roles necessarias em um endpoint
 *
 * @example
 * @Roles('ADMIN', 'PLATFORM_ADMIN')
 */
export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
