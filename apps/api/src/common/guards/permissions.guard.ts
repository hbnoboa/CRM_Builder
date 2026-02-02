import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * Guard que verifica permissões granulares
 * 
 * Formato de permissão: RECURSO:AÇÃO:ESCOPO
 * - Recurso: data, users, roles, cliente, etc
 * - Ação: create, read, update, delete, manage
 * - Escopo: all, team, own
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    // Platform Admin e Admin têm acesso total
    if (user.role === UserRole.PLATFORM_ADMIN || user.role === UserRole.ADMIN) {
      return true;
    }

    // Verificar permissões do usuário
    const userPermissions = this.getUserPermissions(user);
    
    const hasPermission = requiredPermissions.some((required) =>
      this.checkPermission(userPermissions, required),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Sem permissão. Necessária: ${requiredPermissions.join(' ou ')}`,
      );
    }

    return true;
  }

  private getUserPermissions(user: any): string[] {
    // Permissões baseadas na role base
    const basePermissions = this.getBaseRolePermissions(user.role);
    
    // Permissões adicionais de roles customizadas
    const additionalPermissions = user.permissions || [];

    return [...basePermissions, ...additionalPermissions];
  }

  private getBaseRolePermissions(role: UserRole): string[] {
    switch (role) {
      case UserRole.PLATFORM_ADMIN:
        return ['*:*:*']; // Acesso total
      
      case UserRole.ADMIN:
        return ['*:*:all']; // Acesso total no tenant
      
      case UserRole.MANAGER:
        return [
          'data:read:all',
          'data:create:all',
          'data:update:team',
          'data:delete:team',
          'users:read:team',
          'entities:read:all',
          'pages:read:all',
        ];
      
      case UserRole.USER:
        return [
          'data:read:team',
          'data:create:own',
          'data:update:own',
          'data:delete:own',
          'entities:read:all',
          'pages:read:all',
        ];
      
      case UserRole.VIEWER:
        return [
          'data:read:team',
          'entities:read:all',
          'pages:read:all',
        ];
      
      default:
        return [];
    }
  }

  private checkPermission(userPermissions: string[], required: string): boolean {
    const [reqResource, reqAction, reqScope] = required.split(':');

    for (const permission of userPermissions) {
      const [permResource, permAction, permScope] = permission.split(':');

      // Verificar recurso
      if (permResource !== '*' && permResource !== reqResource) {
        continue;
      }

      // Verificar ação
      if (permAction !== '*' && permAction !== 'manage' && permAction !== reqAction) {
        continue;
      }

      // Verificar escopo (all > team > own)
      if (this.scopeIncludes(permScope, reqScope)) {
        return true;
      }
    }

    return false;
  }

  private scopeIncludes(userScope: string, requiredScope: string): boolean {
    if (userScope === '*' || userScope === 'all') {
      return true;
    }
    if (userScope === 'team') {
      return requiredScope === 'team' || requiredScope === 'own';
    }
    if (userScope === 'own') {
      return requiredScope === 'own';
    }
    return false;
  }
}
