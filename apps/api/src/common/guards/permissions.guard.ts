import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RoleType } from '../decorators/roles.decorator';

/**
 * Guard que verifica permissoes granulares
 *
 * Formato de permissao: RECURSO:ACAO:ESCOPO
 * - Recurso: data, users, roles, cliente, etc
 * - Acao: create, read, update, delete, manage
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
      throw new ForbiddenException('Usuario nao autenticado');
    }

    // Obter roleType do customRole
    const roleType = user.customRole?.roleType as RoleType | undefined;

    // PLATFORM_ADMIN e ADMIN tem acesso total
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') {
      return true;
    }

    // Verificar permissoes do usuario
    const userPermissions = this.getUserPermissions(user, roleType);

    const hasPermission = requiredPermissions.some((required) =>
      this.checkPermission(userPermissions, required),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Sem permissao. Necessaria: ${requiredPermissions.join(' ou ')}`,
      );
    }

    return true;
  }

  private getUserPermissions(user: any, roleType: RoleType | undefined): string[] {
    // Permissoes baseadas no roleType
    const basePermissions = this.getBaseRolePermissions(roleType);

    // Permissoes adicionais de roles customizadas
    const additionalPermissions = user.permissions || [];

    return [...basePermissions, ...additionalPermissions];
  }

  private getBaseRolePermissions(roleType: RoleType | undefined): string[] {
    switch (roleType) {
      case 'PLATFORM_ADMIN':
        return ['*:*:*']; // Acesso total

      case 'ADMIN':
        return ['*:*:all']; // Acesso total no tenant

      case 'MANAGER':
        return [
          'data:read:all',
          'data:create:all',
          'data:update:team',
          'data:delete:team',
          'users:read:team',
          'entities:read:all',
          'pages:read:all',
        ];

      case 'USER':
        return [
          'data:read:team',
          'data:create:own',
          'data:update:own',
          'data:delete:own',
          'entities:read:all',
          'pages:read:all',
        ];

      case 'VIEWER':
        return [
          'data:read:team',
          'entities:read:all',
          'pages:read:all',
        ];

      case 'CUSTOM':
        // Roles CUSTOM usam apenas modulePermissions e entityPermissions do customRole
        return [];

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

      // Verificar acao
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
