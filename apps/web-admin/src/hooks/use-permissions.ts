'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole, ModulePermissions, EntityPermission } from '@/types';

/**
 * Permissões de módulo padrão por role base
 * PLATFORM_ADMIN e ADMIN têm tudo, MANAGER/USER/VIEWER tem menos
 */
const DEFAULT_MODULE_PERMISSIONS: Record<UserRole, ModulePermissions> = {
  PLATFORM_ADMIN: {
    dashboard: true,
    users: true,
    settings: true,
    apis: true,
    pages: true,
    entities: true,
  },
  ADMIN: {
    dashboard: true,
    users: true,
    settings: true,
    apis: true,
    pages: true,
    entities: true,
  },
  MANAGER: {
    dashboard: true,
    users: true,
    settings: false,
    apis: false,
    pages: false,
    entities: false,
  },
  USER: {
    dashboard: true,
    users: false,
    settings: false,
    apis: false,
    pages: false,
    entities: false,
  },
  VIEWER: {
    dashboard: true,
    users: false,
    settings: false,
    apis: false,
    pages: false,
    entities: false,
  },
};

/**
 * Mapeamento de titleKey da sidebar → chave de modulePermissions
 */
const MODULE_KEY_MAP: Record<string, keyof ModulePermissions> = {
  dashboard: 'dashboard',
  entities: 'entities',
  data: 'entities', // /data usa a mesma permissão de entities
  apis: 'apis',
  users: 'users',
  roles: 'users', // /roles usa a mesma permissão de users
  settings: 'settings',
  pages: 'pages',
};

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  const modulePermissions = useMemo<ModulePermissions>(() => {
    if (!user) return {};

    const role = user.role;

    // PLATFORM_ADMIN sempre tem tudo
    if (role === 'PLATFORM_ADMIN') {
      return DEFAULT_MODULE_PERMISSIONS.PLATFORM_ADMIN;
    }

    // Se tem customRole com modulePermissions, usar essas
    if (user.customRole?.modulePermissions) {
      const mp = user.customRole.modulePermissions as ModulePermissions;
      return {
        dashboard: mp.dashboard ?? true,
        users: mp.users ?? false,
        settings: mp.settings ?? false,
        apis: mp.apis ?? false,
        pages: mp.pages ?? false,
        entities: mp.entities ?? false,
      };
    }

    // Fallback: permissões padrão do role base
    return DEFAULT_MODULE_PERMISSIONS[role] || DEFAULT_MODULE_PERMISSIONS.VIEWER;
  }, [user]);

  const entityPermissions = useMemo<EntityPermission[]>(() => {
    if (!user) return [];

    // PLATFORM_ADMIN e ADMIN têm acesso total a tudo
    if (user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN') return [];

    if (user.customRole?.permissions) {
      return Array.isArray(user.customRole.permissions)
        ? user.customRole.permissions
        : [];
    }

    return [];
  }, [user]);

  /**
   * Verifica se o usuário tem acesso a um módulo
   */
  const hasModuleAccess = (moduleKey: string): boolean => {
    if (!user) return false;

    // PLATFORM_ADMIN sempre tem acesso
    if (user.role === 'PLATFORM_ADMIN') return true;

    // tenants é exclusivo PLATFORM_ADMIN
    if (moduleKey === 'tenants') return false;

    const permKey = MODULE_KEY_MAP[moduleKey];
    if (!permKey) return true; // Se não mapeado, permitir por padrão

    return modulePermissions[permKey] ?? false;
  };

  /**
   * Verifica permissão CRUD em uma entidade específica
   */
  const hasEntityPermission = (
    entitySlug: string,
    action: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete',
  ): boolean => {
    if (!user) return false;

    // PLATFORM_ADMIN e ADMIN têm acesso total
    if (user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN') return true;

    // Se não tem customRole, usar defaults do role base
    if (!user.customRole) {
      const defaults: Record<UserRole, Record<string, boolean>> = {
        PLATFORM_ADMIN: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
        ADMIN: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
        MANAGER: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
        USER: { canCreate: true, canRead: true, canUpdate: true, canDelete: false },
        VIEWER: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
      };
      return defaults[user.role]?.[action] ?? false;
    }

    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug);
    if (!perm) return false; // Se entidade não está nas permissões, sem acesso

    return perm[action] ?? false;
  };

  /**
   * Retorna o scope para uma entidade (all | own)
   */
  const getEntityScope = (entitySlug: string): 'all' | 'own' => {
    if (!user) return 'own';
    if (user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN') return 'all';

    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug);
    return perm?.scope || 'all';
  };

  /**
   * Verifica se o user é admin (PLATFORM_ADMIN ou ADMIN)
   */
  const isAdmin = user?.role === 'PLATFORM_ADMIN' || user?.role === 'ADMIN';

  /**
   * Verifica se é PLATFORM_ADMIN
   */
  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';

  return {
    user,
    modulePermissions,
    entityPermissions,
    hasModuleAccess,
    hasEntityPermission,
    getEntityScope,
    isAdmin,
    isPlatformAdmin,
  };
}
