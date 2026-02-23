'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { RoleType, ModulePermission, ModulePermissions, EntityPermission } from '@/types';

const FULL_CRUD: ModulePermission = { canRead: true, canCreate: true, canUpdate: true, canDelete: true };
const NO_CRUD: ModulePermission = { canRead: false, canCreate: false, canUpdate: false, canDelete: false };

/**
 * Normaliza modulePermissions: converte formato boolean antigo para CRUD
 */
function normalizeModulePermission(value: unknown): ModulePermission {
  if (typeof value === 'boolean') {
    return value ? { ...FULL_CRUD } : { ...NO_CRUD };
  }
  if (value && typeof value === 'object') {
    return value as ModulePermission;
  }
  return { ...NO_CRUD };
}

function normalizeModulePermissions(mp: Record<string, unknown> | null | undefined): ModulePermissions {
  if (!mp) return {};
  const result: Record<string, ModulePermission> = {};
  for (const [key, value] of Object.entries(mp)) {
    result[key] = normalizeModulePermission(value);
  }
  return result as ModulePermissions;
}

/**
 * Permissoes de modulo padrao por roleType (formato CRUD)
 * Usado apenas como fallback se customRole.modulePermissions nao estiver definido
 */
const READ_ONLY: ModulePermission = { canRead: true, canCreate: false, canUpdate: false, canDelete: false };

const PDF_READ_GENERATE: ModulePermission = { canRead: true, canCreate: false, canUpdate: false, canDelete: false, canGenerate: true } as ModulePermission;

/**
 * Defaults espelham exatamente o seed (prisma/seed.ts).
 * Todos os 10 modulos definidos para cada role.
 */
const DEFAULT_MODULE_PERMISSIONS: Record<RoleType, ModulePermissions> = {
  PLATFORM_ADMIN: {
    dashboard: FULL_CRUD,
    users: FULL_CRUD,
    settings: FULL_CRUD,
    apis: FULL_CRUD,
    pages: FULL_CRUD,
    entities: FULL_CRUD,
    tenants: FULL_CRUD,
    data: FULL_CRUD,
    roles: FULL_CRUD,
    pdfTemplates: { ...FULL_CRUD, canGenerate: true } as ModulePermission,
  },
  ADMIN: {
    dashboard: FULL_CRUD,
    users: FULL_CRUD,
    settings: FULL_CRUD,
    apis: FULL_CRUD,
    pages: FULL_CRUD,
    entities: FULL_CRUD,
    tenants: NO_CRUD,
    data: FULL_CRUD,
    roles: FULL_CRUD,
    pdfTemplates: { ...FULL_CRUD, canGenerate: true } as ModulePermission,
  },
  MANAGER: {
    dashboard: READ_ONLY,
    users: READ_ONLY,
    settings: NO_CRUD,
    apis: NO_CRUD,
    pages: NO_CRUD,
    entities: NO_CRUD,
    tenants: NO_CRUD,
    data: { canRead: true, canCreate: true, canUpdate: true, canDelete: false },
    roles: READ_ONLY,
    pdfTemplates: PDF_READ_GENERATE,
  },
  USER: {
    dashboard: READ_ONLY,
    users: READ_ONLY,
    settings: READ_ONLY,
    apis: NO_CRUD,
    pages: NO_CRUD,
    entities: { canRead: true, canCreate: true, canUpdate: true, canDelete: false },
    tenants: NO_CRUD,
    data: { canRead: true, canCreate: true, canUpdate: true, canDelete: false },
    roles: NO_CRUD,
    pdfTemplates: PDF_READ_GENERATE,
  },
  VIEWER: {
    dashboard: READ_ONLY,
    users: NO_CRUD,
    settings: READ_ONLY,
    apis: NO_CRUD,
    pages: NO_CRUD,
    entities: NO_CRUD,
    tenants: NO_CRUD,
    data: READ_ONLY,
    roles: NO_CRUD,
    pdfTemplates: PDF_READ_GENERATE,
  },
  CUSTOM: {
    dashboard: READ_ONLY,
    users: NO_CRUD,
    settings: NO_CRUD,
    apis: NO_CRUD,
    pages: NO_CRUD,
    entities: NO_CRUD,
    tenants: NO_CRUD,
    data: NO_CRUD,
    roles: NO_CRUD,
    pdfTemplates: NO_CRUD,
  },
};

/**
 * Mapeamento de titleKey da sidebar → chave de modulePermissions
 */
const MODULE_KEY_MAP: Record<string, keyof ModulePermissions> = {
  dashboard: 'dashboard',
  entities: 'entities',
  apis: 'apis',
  pages: 'pages',
  users: 'users',
  roles: 'roles',
  settings: 'settings',
  tenants: 'tenants',
  data: 'data',
  pdfTemplates: 'pdfTemplates',
};

const MODULE_KEYS: (keyof ModulePermissions)[] = ['dashboard', 'users', 'settings', 'apis', 'pages', 'entities', 'tenants', 'data', 'roles', 'pdfTemplates'];

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  // Obtem roleType do customRole (novo sistema unificado)
  const roleType = user?.customRole?.roleType as RoleType | undefined;

  const modulePermissions = useMemo<ModulePermissions>(() => {
    if (!user || !roleType) return {};

    // PLATFORM_ADMIN sempre tem tudo
    if (roleType === 'PLATFORM_ADMIN') {
      return DEFAULT_MODULE_PERMISSIONS.PLATFORM_ADMIN;
    }

    // Usar modulePermissions da customRole (normalizado de boolean → CRUD)
    if (user.customRole?.modulePermissions) {
      const normalized = normalizeModulePermissions(user.customRole.modulePermissions as Record<string, unknown>);
      const result: Record<string, ModulePermission> = {};
      for (const key of MODULE_KEYS) {
        result[key] = normalized[key] ?? { ...NO_CRUD };
      }
      return result as ModulePermissions;
    }

    // Fallback: permissoes padrao do roleType
    return DEFAULT_MODULE_PERMISSIONS[roleType] || DEFAULT_MODULE_PERMISSIONS.VIEWER;
  }, [user, roleType]);

  const entityPermissions = useMemo<EntityPermission[]>(() => {
    if (!user || !roleType) return [];

    // PLATFORM_ADMIN tem acesso total a tudo
    if (roleType === 'PLATFORM_ADMIN') return [];

    if (user.customRole?.permissions) {
      return Array.isArray(user.customRole.permissions)
        ? user.customRole.permissions
        : [];
    }

    return [];
  }, [user, roleType]);

  // CUSTOM roles: se tem entidades com canRead, garantir acesso ao modulo data
  const adjustedModulePermissions = useMemo<ModulePermissions>(() => {
    if (roleType !== 'CUSTOM' || entityPermissions.length === 0) return modulePermissions;

    const hasAnyEntityRead = entityPermissions.some((e) => e.canRead);
    if (!hasAnyEntityRead) return modulePermissions;

    const currentData = modulePermissions.data;
    if (currentData?.canRead) return modulePermissions;

    return {
      ...modulePermissions,
      data: {
        canRead: true,
        canCreate: entityPermissions.some((e) => e.canCreate),
        canUpdate: entityPermissions.some((e) => e.canUpdate),
        canDelete: entityPermissions.some((e) => e.canDelete),
      },
    };
  }, [roleType, modulePermissions, entityPermissions]);

  /**
   * Verifica se o usuario tem acesso a um modulo (canRead)
   */
  const hasModuleAccess = (moduleKey: string): boolean => {
    if (!user || !roleType) return false;

    // PLATFORM_ADMIN sempre tem acesso
    if (roleType === 'PLATFORM_ADMIN') return true;

    const permKey = MODULE_KEY_MAP[moduleKey];
    if (!permKey) return true; // Se nao mapeado, permitir por padrao

    const perm = adjustedModulePermissions[permKey];
    if (!perm) return false;

    return perm.canRead ?? false;
  };

  /**
   * Verifica permissao CRUD em um modulo especifico
   */
  const hasModulePermission = (
    moduleKey: string,
    action: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete',
  ): boolean => {
    if (!user || !roleType) return false;

    // PLATFORM_ADMIN sempre tem acesso
    if (roleType === 'PLATFORM_ADMIN') return true;

    const permKey = MODULE_KEY_MAP[moduleKey] || moduleKey as keyof ModulePermissions;
    const perm = adjustedModulePermissions[permKey];
    if (!perm) return false;

    return perm[action] ?? false;
  };

  /**
   * Verifica permissao CRUD em uma entidade especifica
   */
  const hasEntityPermission = (
    entitySlug: string,
    action: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete',
  ): boolean => {
    if (!user || !roleType) return false;

    // PLATFORM_ADMIN tem acesso total
    if (roleType === 'PLATFORM_ADMIN') return true;

    // ADMIN: usar permissoes baseadas em roleType defaults
    if (roleType === 'ADMIN') return true;

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
    if (!perm) return false;

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
   * Verifica permissao sub-granular (acoes especiais) em um modulo
   */
  const hasModuleAction = (moduleKey: string, action: string): boolean => {
    if (!user || !roleType) return false;
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') return true;

    const permKey = MODULE_KEY_MAP[moduleKey] || moduleKey as keyof ModulePermissions;
    const perm = adjustedModulePermissions[permKey] as Record<string, unknown> | undefined;
    if (!perm) return false;

    return perm[action] === true;
  };

  /**
   * Verifica permissao sub-granular em uma entidade especifica
   */
  const hasEntityAction = (entitySlug: string, action: string): boolean => {
    if (!user || !roleType) return false;
    if (roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN') return true;

    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug) as Record<string, unknown> | undefined;
    if (!perm) return false;

    return perm[action] === true;
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

  /**
   * Retorna a rota padrao baseada nas permissoes do usuario.
   * Prioridade: dashboard > data > entities > users > settings
   */
  const getDefaultRoute = (): string => {
    const routePriority: { moduleKey: string; href: string }[] = [
      { moduleKey: 'dashboard', href: '/dashboard' },
      { moduleKey: 'data', href: '/data' },
      { moduleKey: 'entities', href: '/entities' },
      { moduleKey: 'users', href: '/users' },
      { moduleKey: 'roles', href: '/roles' },
      { moduleKey: 'apis', href: '/apis' },
      { moduleKey: 'tenants', href: '/tenants' },
      { moduleKey: 'settings', href: '/settings' },
    ];

    for (const route of routePriority) {
      if (hasModuleAccess(route.moduleKey)) {
        return route.href;
      }
    }

    return '/dashboard';
  };

  return {
    user,
    roleType,
    modulePermissions: adjustedModulePermissions,
    entityPermissions,
    hasModuleAccess,
    hasModulePermission,
    hasEntityPermission,
    hasModuleAction,
    hasEntityAction,
    getEntityScope,
    getDefaultRoute,
    isAdmin,
    isPlatformAdmin,
  };
}

/**
 * Funcao pura para determinar rota padrao baseada no user.
 * Usada no login (onSubmit) onde o hook ainda nao re-renderizou.
 */
export function getDefaultRouteForUser(user: { customRole?: { roleType?: string; modulePermissions?: Record<string, unknown> } | null } | null): string {
  if (!user?.customRole?.roleType) return '/dashboard';

  const roleType = user.customRole.roleType as RoleType;

  if (roleType === 'PLATFORM_ADMIN') return '/dashboard';

  let modulePerms: ModulePermissions;
  if (user.customRole.modulePermissions) {
    modulePerms = normalizeModulePermissions(user.customRole.modulePermissions) as ModulePermissions;
  } else {
    modulePerms = DEFAULT_MODULE_PERMISSIONS[roleType] || DEFAULT_MODULE_PERMISSIONS.VIEWER;
  }

  const routePriority: { moduleKey: keyof ModulePermissions; href: string }[] = [
    { moduleKey: 'dashboard', href: '/dashboard' },
    { moduleKey: 'data', href: '/data' },
    { moduleKey: 'entities', href: '/entities' },
    { moduleKey: 'users', href: '/users' },
    { moduleKey: 'roles', href: '/roles' },
    { moduleKey: 'apis', href: '/apis' },
    { moduleKey: 'tenants', href: '/tenants' },
    { moduleKey: 'settings', href: '/settings' },
  ];

  for (const route of routePriority) {
    const perm = modulePerms[route.moduleKey];
    if (perm?.canRead) return route.href;
  }

  return '/dashboard';
}
