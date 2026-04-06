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
 * Permissoes de modulo padrao APENAS para PLATFORM_ADMIN.
 * Todos os outros roles (ADMIN, MANAGER, USER, VIEWER, CUSTOM) devem ter
 * permissoes definidas em modulePermissions no banco de dados.
 */
const READ_ONLY: ModulePermission = { canRead: true, canCreate: false, canUpdate: false, canDelete: false };

const PDF_READ_GENERATE: ModulePermission = { canRead: true, canCreate: false, canUpdate: false, canDelete: false, canGenerate: true } as ModulePermission;

const DEFAULT_MODULE_PERMISSIONS: Record<RoleType, ModulePermissions> = {
  PLATFORM_ADMIN: {
    dashboard: FULL_CRUD,
    users: FULL_CRUD,
    settings: FULL_CRUD,
    entities: FULL_CRUD,
    tenants: FULL_CRUD,
    data: FULL_CRUD,
    roles: FULL_CRUD,
    automations: {
      ...FULL_CRUD,
      canExecute: true,
      // Sub-permissões para automações
      webhooks: FULL_CRUD,
      actionChains: FULL_CRUD,
      entityAutomation: FULL_CRUD,
    } as ModulePermission,
    templates: {
      ...FULL_CRUD,
      canGenerate: true,
      // Sub-permissões para templates
      pdfTemplates: FULL_CRUD,
      emailTemplates: FULL_CRUD,
    } as ModulePermission,
    logs: {
      ...READ_ONLY,
      // Sub-permissões para logs
      auditLogs: READ_ONLY,
      executionLogs: READ_ONLY,
    } as ModulePermission,
    notifications: FULL_CRUD,
    publicLinks: FULL_CRUD,
    archive: FULL_CRUD,
  },
  // Todos os outros roles usam apenas modulePermissions do DB
  ADMIN: {},
  MANAGER: {},
  USER: {},
  VIEWER: {},
  CUSTOM: {},
};

/**
 * Mapeamento de titleKey da sidebar → chave de modulePermissions
 */
const MODULE_KEY_MAP: Record<string, keyof ModulePermissions> = {
  dashboard: 'dashboard',
  entities: 'entities',
  users: 'users',
  roles: 'roles',
  settings: 'settings',
  tenants: 'tenants',
  data: 'data',
  automations: 'automations',
  templates: 'templates',
  logs: 'logs',
  notifications: 'notifications',
  publicLinks: 'publicLinks',
  archive: 'archive',
};

const MODULE_KEYS: (keyof ModulePermissions)[] = ['dashboard', 'users', 'settings', 'entities', 'tenants', 'data', 'roles', 'automations', 'templates', 'logs', 'notifications', 'publicLinks', 'archive'];

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  // Obtem roleType do customRole (novo sistema unificado)
  const roleType = user?.customRole?.roleType as RoleType | undefined;

  const modulePermissions = useMemo<ModulePermissions>(() => {
    if (!user || !roleType) return {};

    // PLATFORM_ADMIN sempre tem tudo (hardcoded)
    if (roleType === 'PLATFORM_ADMIN') {
      return DEFAULT_MODULE_PERMISSIONS.PLATFORM_ADMIN;
    }

    // Todos os outros roles: usar APENAS modulePermissions do banco
    if (user.customRole?.modulePermissions) {
      return normalizeModulePermissions(user.customRole.modulePermissions as Record<string, unknown>) as ModulePermissions;
    }

    // Sem modulePermissions no DB = sem acesso (exceto PLATFORM_ADMIN)
    return {};
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

    // APENAS PLATFORM_ADMIN tem acesso automatico
    if (roleType === 'PLATFORM_ADMIN') return true;

    // Todos os outros roles: verificar permissions[entitySlug]
    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug);
    if (!perm) return false;

    return perm[action] ?? false;
  };

  /**
   * Retorna o scope para uma entidade (all | own)
   */
  const getEntityScope = (entitySlug: string): 'all' | 'own' => {
    if (!user || !roleType) return 'own';

    // APENAS PLATFORM_ADMIN tem scope automatico
    if (roleType === 'PLATFORM_ADMIN') return 'all';

    // Todos os outros: usar scope definido nas permissoes
    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug);
    return perm?.scope || 'own';
  };

  /**
   * Verifica permissao sub-granular (acoes especiais) em um modulo
   */
  const hasModuleAction = (moduleKey: string, action: string): boolean => {
    if (!user || !roleType) return false;

    // APENAS PLATFORM_ADMIN tem acesso automatico
    if (roleType === 'PLATFORM_ADMIN') return true;

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

    // APENAS PLATFORM_ADMIN tem acesso automatico
    if (roleType === 'PLATFORM_ADMIN') return true;

    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug) as Record<string, unknown> | undefined;
    if (!perm) return false;

    return perm[action] === true;
  };

  /**
   * Verifica se o user e PLATFORM_ADMIN
   * IMPORTANTE: Nenhum outro role (incluindo ADMIN) tem privilegios automaticos
   */
  const isAdmin = roleType === 'PLATFORM_ADMIN';

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
      { moduleKey: 'entities', href: '/data' },
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

  // PLATFORM_ADMIN sempre vai para dashboard
  if (roleType === 'PLATFORM_ADMIN') return '/dashboard';

  // Todos os outros: usar modulePermissions do DB
  let modulePerms: ModulePermissions = {};
  if (user.customRole.modulePermissions) {
    modulePerms = normalizeModulePermissions(user.customRole.modulePermissions) as ModulePermissions;
  }

  const routePriority: { moduleKey: keyof ModulePermissions; href: string }[] = [
    { moduleKey: 'dashboard', href: '/dashboard' },
    { moduleKey: 'data', href: '/data' },
    { moduleKey: 'entities', href: '/data' },
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
