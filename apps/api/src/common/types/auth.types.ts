import { UserRole } from '@prisma/client';
import { Request } from 'express';

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
  role: UserRole;
  tenantId: string;
  permissions?: string[];
}

/**
 * Payload do JWT Access Token
 */
export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  tenantId: string;
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
