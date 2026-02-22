import { Request } from 'express';
import { RoleType } from '@crm-builder/shared';

/**
 * Interface para custom role no usuario autenticado
 */
export interface CurrentUserCustomRole {
  id: string;
  name: string;
  roleType: RoleType;
  isSystem: boolean;
  permissions: unknown[];
  modulePermissions: Record<string, unknown>;
  tenantPermissions: Record<string, unknown>;
}

/**
 * Interface para o usuario autenticado
 *
 * Usar em todos os services ao inves de `any`:
 * async create(dto: CreateUserDto, currentUser: CurrentUser) { ... }
 *
 * Extraido do token JWT pelo JwtStrategy
 */
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  customRoleId: string;
  customRole: CurrentUserCustomRole;
}

/**
 * Payload do JWT Access Token
 */
export interface JwtPayload {
  sub: string; // userId
  email: string;
  tenantId: string;
  customRoleId: string;
  roleType: RoleType; // Para checks rapidos sem DB lookup
  iat?: number;
  exp?: number;
}

/**
 * Payload do JWT Refresh Token
 */
export interface RefreshTokenPayload {
  sub: string; // userId
  type: 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Request com usuario autenticado (Express)
 */
export interface AuthenticatedRequest extends Request {
  user: CurrentUser;
}
