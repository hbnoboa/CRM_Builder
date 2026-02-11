'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { RoleType, ModulePermissions, EntityPermission } from '@/types';

/**
 * Permissoes de modulo padrao por roleType
 * Usado apenas como fallback se customRole.modulePermissions nao estiver definido
 */
const DEFAULT_MODULE_PERMISSIONS: Record<RoleType, ModulePermissions> = {
  PLATFORM_ADMIN: {
    dashboard: true,
    users: true,
    settings: true,
    apis: true,
    pages: true,
    entities: true,
    tenants: true,
  },
  ADMIN: {
    dashboard: true,
    users: true,
    settings: true,
    apis: true,
    pages: true,
    entities: true,
    tenants: false,
  },
  MANAGER: {
    dashboard: true,
    users: true,
    settings: false,
    apis: false,
    pages: false,
    entities: false,
    tenants: false,
  },
  USER: {
    dashboard: true,
    users: true,
    settings: true,
    apis: false,
    pages: false,
    entities: true,
    tenants: false,
  },
  VIEWER: {
    dashboard: true,
    users: false,
    settings: true,
    apis: false,
    pages: false,
    entities: false,
    tenants: false,
  },
  CUSTOM: {
    dashboard: true,
    users: false,
    settings: false,
    apis: false,
    pages: false,
    entities: false,
    tenants: false,
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
  tenants: 'tenants',
};

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  // Obtem roleType do customRole (novo sistema unificado)
  const roleType = user?.customRole?.roleType as RoleType | undefined;

  const modulePermissions = useMemo<ModulePermissions>(() => {
    if (!user || !roleType) return {};

    // PLATFORM_ADMIN e ADMIN sempre tem tudo
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') {
      return DEFAULT_MODULE_PERMISSIONS[roleType];
    }

    // Usar modulePermissions da customRole
    if (user.customRole?.modulePermissions) {
      const mp = user.customRole.modulePermissions as ModulePermissions;
      return {
        dashboard: mp.dashboard ?? true,
        users: mp.users ?? false,
        settings: mp.settings ?? false,
        apis: mp.apis ?? false,
        pages: mp.pages ?? false,
        entities: mp.entities ?? false,
        tenants: mp.tenants ?? false,
      };
    }

    // Fallback: permissoes padrao do roleType
    return DEFAULT_MODULE_PERMISSIONS[roleType] || DEFAULT_MODULE_PERMISSIONS.VIEWER;
  }, [user, roleType]);

  const entityPermissions = useMemo<EntityPermission[]>(() => {
    if (!user || !roleType) return [];

    // PLATFORM_ADMIN e ADMIN tem acesso total a tudo
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') return [];

    if (user.customRole?.permissions) {
      return Array.isArray(user.customRole.permissions)
        ? user.customRole.permissions
        : [];
    }

    return [];
  }, [user, roleType]);

  /**
   * Verifica se o usuario tem acesso a um modulo
   */
  const hasModuleAccess = (moduleKey: string): boolean => {
    if (!user || !roleType) return false;

    // PLATFORM_ADMIN sempre tem acesso
    if (roleType === 'PLATFORM_ADMIN') return true;

    const permKey = MODULE_KEY_MAP[moduleKey];
    if (!permKey) return true; // Se nao mapeado, permitir por padrao

    return modulePermissions[permKey] ?? false;
  };

  /**
   * Verifica permissao CRUD em uma entidade especifica
   */
  const hasEntityPermission = (
    entitySlug: string,
    action: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete',
  ): boolean => {
    if (!user || !roleType) return false;

    // PLATFORM_ADMIN e ADMIN tem acesso total
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') return true;

    // Usar permissoes baseadas em roleType
    const defaults: Record<RoleType, Record<string, boolean>> = {
      PLATFORM_ADMIN: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
      ADMIN: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
      MANAGER: { canCreate: true, canRead: true, canUpdate: true, canDelete: true },
      USER: { canCreate: true, canRead: true, canUpdate: true, canDelete: false },
      VIEWER: { canCreate: false, canRead: true, canUpdate: false, canDelete: false },
      CUSTOM: { canCreate: false, canRead: false, canUpdate: false, canDelete: false },
    };

    // Se roleType nao e CUSTOM, usar defaults
    if (roleType !== 'CUSTOM') {
      return defaults[roleType]?.[action] ?? false;
    }

    // CUSTOM usa permissoes definidas na customRole
    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug);
    if (!perm) return false; // Se entidade nao esta nas permissoes, sem acesso

    return perm[action] ?? false;
  };

  /**
   * Retorna o scope para uma entidade (all | own)
   */
  const getEntityScope = (entitySlug: string): 'all' | 'own' => {
    if (!user || !roleType) return 'own';
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') return 'all';
    if (roleType === 'MANAGER' || roleType === 'VIEWER') return 'all';
    if (roleType === 'USER') return 'own';

    // CUSTOM: usar scope definido nas permissoes
    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug);
    return perm?.scope || 'all';
  };

  /**
   * Verifica se o user e admin (PLATFORM_ADMIN ou ADMIN)
   * IMPORTANTE: Roles CUSTOM nunca sao consideradas admin
   */
  const isAdmin = roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN';

  /**
   * Verifica se e PLATFORM_ADMIN
   */
  const isPlatformAdmin = roleType === 'PLATFORM_ADMIN';

  return {
    user,
    roleType,
    modulePermissions,
    entityPermissions,
    hasModuleAccess,
    hasEntityPermission,
    getEntityScope,
    isAdmin,
    isPlatformAdmin,
  };
}
