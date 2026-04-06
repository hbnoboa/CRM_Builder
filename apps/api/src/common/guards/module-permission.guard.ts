import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_PERMISSION_KEY, ModulePermissionMetadata } from '../decorators/module-permission.decorator';
import type { CurrentUser } from '../types';

/**
 * Guard que verifica se o usuário tem permissão em um módulo específico.
 * Usado em conjunto com @RequireModulePermission().
 */
@Injectable()
export class ModulePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<ModulePermissionMetadata>(
      MODULE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      // Se não há metadata, permite acesso (não há restrição)
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: CurrentUser = request.user;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    const { module, action, subModule } = metadata;
    const roleType = user.customRole?.roleType;

    // APENAS PLATFORM_ADMIN tem acesso automatico
    if (roleType === 'PLATFORM_ADMIN') {
      return true;
    }

    // Todos os outros roles: verificar modulePermissions do customRole
    const modulePermissions = user.customRole?.modulePermissions as Record<string, any> | undefined;
    const modulePerm = modulePermissions?.[module];

    if (!modulePerm) {
      throw new ForbiddenException(`Sem permissão: ${module}.${action}`);
    }

    // Se não há sub-módulo, verificar apenas permissão do módulo principal
    if (!subModule) {
      if (modulePerm[action] === true) {
        return true;
      }
      throw new ForbiddenException(`Sem permissão: ${module}.${action}`);
    }

    // Se há sub-módulo, verificar permissões aninhadas
    // Primeiro: módulo principal deve ter a permissão
    if (modulePerm[action] !== true) {
      throw new ForbiddenException(`Sem permissão no módulo principal: ${module}.${action}`);
    }

    // Segundo: sub-módulo deve ter a permissão
    const subModulePerm = modulePerm[subModule] as Record<string, boolean> | undefined;
    if (subModulePerm && subModulePerm[action] === true) {
      return true;
    }

    throw new ForbiddenException(`Sem permissão: ${module}.${subModule}.${action}`);
  }
}
