import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Lista de permissões disponíveis no sistema
export const PERMISSIONS = {
  // Entidades
  'entities:create': 'Criar entidades',
  'entities:read': 'Visualizar entidades',
  'entities:update': 'Atualizar entidades',
  'entities:delete': 'Excluir entidades',
  
  // Dados
  'data:create': 'Criar registros',
  'data:read': 'Visualizar registros',
  'data:update': 'Atualizar registros',
  'data:delete': 'Excluir registros',
  'data:export': 'Exportar registros',
  'data:import': 'Importar registros',
  
  // Páginas
  'pages:create': 'Criar páginas',
  'pages:read': 'Visualizar páginas',
  'pages:update': 'Atualizar páginas',
  'pages:delete': 'Excluir páginas',
  'pages:publish': 'Publicar páginas',
  
  // APIs
  'apis:create': 'Criar APIs customizadas',
  'apis:read': 'Visualizar APIs',
  'apis:update': 'Atualizar APIs',
  'apis:delete': 'Excluir APIs',
  'apis:execute': 'Executar APIs',
  
  // Usuários
  'users:create': 'Criar usuários',
  'users:read': 'Visualizar usuários',
  'users:update': 'Atualizar usuários',
  'users:delete': 'Excluir usuários',
  'users:invite': 'Convidar usuários',
  
  // Roles
  'roles:create': 'Criar papéis',
  'roles:read': 'Visualizar papéis',
  'roles:update': 'Atualizar papéis',
  'roles:delete': 'Excluir papéis',
  'roles:assign': 'Atribuir papéis',
  
  // Organização
  'organization:read': 'Visualizar organização',
  'organization:update': 'Atualizar organização',
  
  // Configurações
  'settings:read': 'Visualizar configurações',
  'settings:update': 'Atualizar configurações',
  
  // Stats
  'stats:read': 'Visualizar estatísticas',
  
  // Upload
  'upload:create': 'Fazer upload de arquivos',
  'upload:delete': 'Excluir arquivos',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

// Permissões por papel padrão
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  PLATFORM_ADMIN: Object.keys(PERMISSIONS) as PermissionKey[],
  ADMIN: Object.keys(PERMISSIONS).filter(p => !p.startsWith('roles:delete')) as PermissionKey[],
  MANAGER: [
    'entities:read',
    'data:create', 'data:read', 'data:update', 'data:delete', 'data:export',
    'pages:read',
    'apis:read', 'apis:execute',
    'users:read',
    'roles:read',
    'organization:read',
    'stats:read',
    'upload:create',
  ],
  USER: [
    'entities:read',
    'data:create', 'data:read', 'data:update',
    'pages:read',
    'apis:execute',
    'organization:read',
    'upload:create',
  ],
  VIEWER: [
    'entities:read',
    'data:read',
    'pages:read',
    'organization:read',
    'stats:read',
  ],
};

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna todas as permissões disponíveis no sistema
   */
  getAllPermissions() {
    return Object.entries(PERMISSIONS).map(([key, description]) => ({
      key,
      description,
      category: key.split(':')[0],
    }));
  }

  /**
   * Retorna permissões agrupadas por categoria
   */
  getPermissionsByCategory() {
    const permissions = this.getAllPermissions();
    const grouped: Record<string, typeof permissions> = {};
    
    permissions.forEach(perm => {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    });
    
    return grouped;
  }

  /**
   * Retorna permissões padrão para um papel
   */
  getDefaultPermissionsForRole(role: string): PermissionKey[] {
    return DEFAULT_ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Verifica se um usuário tem uma permissão específica
   */
  async hasPermission(
    userId: string,
    permission: PermissionKey,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        customRoleId: true,
      },
    });

    if (!user) return false;

    // Super admin e admin tem todas as permissões
    if (user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN') return true;

    // Verificar custom role primeiro
    if (user.customRoleId) {
      const customRole = await this.prisma.customRole.findUnique({
        where: { id: user.customRoleId },
        select: { permissions: true, modulePermissions: true },
      });
      if (customRole) {
        const [category, action] = permission.split(':');
        const modulePerms = customRole.modulePermissions as Record<string, boolean>;

        // Verificar permissão de módulo
        if (modulePerms && modulePerms[category] !== undefined) {
          return modulePerms[category];
        }

        // Para data:*, verificar permissões de entidade
        if (category === 'data') {
          const entityPerms = customRole.permissions as unknown as Array<{
            entitySlug: string; canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean;
          }>;
          return entityPerms.some((p) => {
            if (action === 'create') return p.canCreate;
            if (action === 'read' || action === 'export') return p.canRead;
            if (action === 'update' || action === 'import') return p.canUpdate;
            if (action === 'delete') return p.canDelete;
            return false;
          });
        }
      }
    }

    // Verificar permissões do papel base
    const basePermissions = this.getDefaultPermissionsForRole(user.role);
    return basePermissions.includes(permission);
  }

  /**
   * Retorna todas as permissões de um usuário
   */
  async getUserPermissions(userId: string): Promise<PermissionKey[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        customRoleId: true,
      },
    });

    if (!user) return [];

    // Super admin e admin tem todas as permissões
    if (user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN') {
      return Object.keys(PERMISSIONS) as PermissionKey[];
    }

    // Se tem custom role, construir lista de permissões
    if (user.customRoleId) {
      const customRole = await this.prisma.customRole.findUnique({
        where: { id: user.customRoleId },
        select: { permissions: true, modulePermissions: true },
      });
      if (customRole) {
        const perms: PermissionKey[] = [];
        const modulePerms = customRole.modulePermissions as Record<string, boolean>;
        const entityPerms = customRole.permissions as unknown as Array<{
          entitySlug: string; canCreate: boolean; canRead: boolean; canUpdate: boolean; canDelete: boolean;
        }>;

        if (modulePerms?.dashboard) perms.push('stats:read');
        if (modulePerms?.users) { perms.push('users:read', 'users:create', 'users:update'); }
        if (modulePerms?.settings) { perms.push('settings:read', 'settings:update', 'organization:read', 'organization:update'); }
        if (modulePerms?.apis) { perms.push('apis:read', 'apis:create', 'apis:update', 'apis:delete', 'apis:execute'); }
        if (modulePerms?.pages) { perms.push('pages:read', 'pages:create', 'pages:update', 'pages:delete'); }
        if (modulePerms?.entities) { perms.push('entities:read', 'entities:create', 'entities:update', 'entities:delete'); }

        if (entityPerms.some(p => p.canRead)) perms.push('data:read');
        if (entityPerms.some(p => p.canCreate)) perms.push('data:create');
        if (entityPerms.some(p => p.canUpdate)) perms.push('data:update');
        if (entityPerms.some(p => p.canDelete)) perms.push('data:delete');

        perms.push('upload:create', 'organization:read');
        return [...new Set(perms)];
      }
    }

    // Retorna permissões do papel base
    return this.getDefaultPermissionsForRole(user.role);
  }
}
