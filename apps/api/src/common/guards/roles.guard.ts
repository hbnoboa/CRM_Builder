import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, RoleType } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Usuario nao autenticado');
    }

    // Obter roleType do customRole
    const roleType = user.customRole?.roleType as RoleType | undefined;

    if (!roleType) {
      throw new ForbiddenException('Usuario sem role definida');
    }

    // PLATFORM_ADMIN tem acesso a tudo
    if (roleType === 'PLATFORM_ADMIN') {
      return true;
    }

    const hasRole = requiredRoles.some((role) => roleType === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Acesso negado. Roles necessarias: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
