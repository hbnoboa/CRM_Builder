import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator para definir roles necessárias em um endpoint
 * 
 * @example
 * @Roles(UserRole.ADMIN, UserRole.PLATFORM_ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
