import { SetMetadata } from '@nestjs/common';
import { RoleType } from '@crm-builder/shared';

export { RoleType };

export const ROLES_KEY = 'roles';

/**
 * Decorator para definir roles necessarias em um endpoint
 *
 * @example
 * @Roles('ADMIN', 'PLATFORM_ADMIN')
 */
export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
