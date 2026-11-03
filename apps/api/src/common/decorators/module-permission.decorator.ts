import { SetMetadata } from '@nestjs/common';

export const MODULE_PERMISSION_KEY = 'modulePermission';

export interface ModulePermissionMetadata {
  module: string;
  action: string;
  subModule?: string; // Sub-módulo opcional (ex: webhooks dentro de automations)
}

/**
 * Decorator para exigir uma permissão de módulo específica.
 *
 * Exemplos:
 * @RequireModulePermission('publicLinks', 'canCreate')
 * @RequireModulePermission('automations', 'canCreate', 'webhooks')
 *
 * Verifica se o usuário tem a permissão no campo modulePermissions do seu customRole.
 * Se subModule for especificado, verifica permissões aninhadas.
 * Cargos com allAccess sempre tem acesso (dentro do proprio tenant).
 */
export const RequireModulePermission = (module: string, action: string, subModule?: string) =>
  SetMetadata(MODULE_PERMISSION_KEY, { module, action, subModule } as ModulePermissionMetadata);
