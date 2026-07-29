'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import type { ModulePermission, ModulePermissions, EntityPermission } from '@/types';

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

/**
 * Acesso de PLATAFORMA agora vem de PERMISSAO (modulePermissions.platform.*),
 * nao mais de platformAccess (removido no redesenho). Espelha o
 * hasPlatformAccess() do backend. Qualquer um dos 3 sinaliza poder de plataforma.
 */
export function readPlatformAccess(mp: Record<string, unknown> | null | undefined): boolean {
  if (!mp || typeof mp !== 'object') return false;
  const platform = (mp as Record<string, unknown>).platform as Record<string, unknown> | undefined;
  if (!platform || typeof platform !== 'object') return false;
  return !!(platform.crossTenant || platform.impersonateAny || platform.manageTenants);
}

/** Acesso total DENTRO do tenant (todos os módulos/tabelas, presente e futuro). Não é plataforma. */
export function readFullTenantAccess(mp: Record<string, unknown> | null | undefined): boolean {
  return !!mp && typeof mp === 'object' && (mp as Record<string, unknown>).allAccess === true;
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
 * Permissoes de modulo concedidas a quem tem ACESSO DE PLATAFORMA
 * (modulePermissions.platform.*). Nao existe mais tier por roleType:
 * todos os demais cargos usam exclusivamente modulePermissions do banco.
 */
const READ_ONLY: ModulePermission = { canRead: true, canCreate: false, canUpdate: false, canDelete: false };

const PLATFORM_FULL_PERMISSIONS: ModulePermissions = {
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
  // Sub-módulos que aparecem na sidebar
  dashboardTemplates: 'templates',  // mapeia para templates
  pdfTemplates: 'templates',        // mapeia para templates
  auditLogs: 'logs',                // mapeia para logs
  executionLogs: 'logs',            // mapeia para logs
};

const MODULE_KEYS: (keyof ModulePermissions)[] = ['dashboard', 'users', 'settings', 'entities', 'tenants', 'data', 'roles', 'automations', 'templates', 'logs', 'notifications', 'publicLinks', 'archive'];

/**
 * Modulos EXCLUSIVOS DE PLATAFORMA (gestao acima do tenant, ex.: gerir
 * organizacoes). `allAccess` (acesso total DENTRO do tenant) NAO os libera —
 * so quem tem poder de plataforma (platform.*). Espelha o backend, que ja
 * responde 403 nessas rotas para admin de tenant. Sem isso, o menu mostraria
 * uma porta que leva a 403.
 */
const PLATFORM_ONLY_MODULES = new Set<string>(['tenants']);

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  // Toda autorizacao e permission-driven: basta o usuario ter um cargo (customRole).
  const hasRole = !!user?.customRole;

  // Poder de plataforma = PERMISSAO (modulePermissions.platform.*), nao roleType.
  const platformAccess = useMemo(
    () => readPlatformAccess(user?.customRole?.modulePermissions as Record<string, unknown> | undefined),
    [user],
  );

  // Acesso total ao tenant = modulePermissions.allAccess (dinâmico, sem cross-tenant).
  const fullAccess = useMemo(
    () => readFullTenantAccess(user?.customRole?.modulePermissions as Record<string, unknown> | undefined),
    [user],
  );

  const modulePermissions = useMemo<ModulePermissions>(() => {
    if (!user || !hasRole) return {};

    // Acesso de plataforma ou total ao tenant libera tudo (hardcoded)
    if (platformAccess || fullAccess) {
      return PLATFORM_FULL_PERMISSIONS;
    }

    // Demais cargos: usar APENAS modulePermissions do banco
    if (user.customRole?.modulePermissions) {
      return normalizeModulePermissions(user.customRole.modulePermissions as Record<string, unknown>) as ModulePermissions;
    }

    // Sem modulePermissions no DB = sem acesso (exceto plataforma)
    return {};
  }, [user, hasRole, platformAccess, fullAccess]);

  const entityPermissions = useMemo<EntityPermission[]>(() => {
    if (!user || !hasRole) return [];

    // Acesso de plataforma tem acesso total a tudo
    if (platformAccess) return [];

    if (user.customRole?.permissions) {
      return Array.isArray(user.customRole.permissions)
        ? user.customRole.permissions
        : [];
    }

    return [];
  }, [user, hasRole, platformAccess]);

  // Se tem entidades com canRead, garantir acesso ao modulo data
  const adjustedModulePermissions = useMemo<ModulePermissions>(() => {
    if (entityPermissions.length === 0) return modulePermissions;

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
  }, [modulePermissions, entityPermissions]);

  /**
   * Verifica se o usuario tem acesso a um modulo (canRead)
   */
  const hasModuleAccess = (moduleKey: string): boolean => {
    if (!user || !hasRole) return false;

    // Modulo exclusivo de plataforma: allAccess NAO libera, so platform.*
    if (PLATFORM_ONLY_MODULES.has(moduleKey)) return platformAccess;

    // PLATFORM_ADMIN sempre tem acesso
    if (platformAccess || fullAccess) return true;

    const permKey = MODULE_KEY_MAP[moduleKey];
    if (!permKey) return false; // Se nao mapeado, negar por padrao (fail-secure)

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
    if (!user || !hasRole) return false;

    // Modulo exclusivo de plataforma: allAccess NAO libera, so platform.*
    if (PLATFORM_ONLY_MODULES.has(moduleKey)) return platformAccess;

    // PLATFORM_ADMIN sempre tem acesso
    if (platformAccess || fullAccess) return true;

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
    if (!user || !hasRole) return false;

    // APENAS PLATFORM_ADMIN tem acesso automatico
    if (platformAccess || fullAccess) return true;

    // Todos os outros roles: verificar permissions[entitySlug]
    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug);
    if (!perm) return false;

    return perm[action] ?? false;
  };

  /**
   * Retorna o scope para uma entidade (all | own)
   */
  const getEntityScope = (entitySlug: string): 'all' | 'own' => {
    if (!user || !hasRole) return 'own';

    // APENAS PLATFORM_ADMIN tem scope automatico
    if (platformAccess || fullAccess) return 'all';

    // Todos os outros: usar scope definido nas permissoes
    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug);
    return perm?.scope || 'own';
  };

  /**
   * Verifica permissao sub-granular (acoes especiais) em um modulo
   */
  const hasModuleAction = (moduleKey: string, action: string): boolean => {
    if (!user || !hasRole) return false;

    // Modulo exclusivo de plataforma: allAccess NAO libera, so platform.*
    if (PLATFORM_ONLY_MODULES.has(moduleKey)) return platformAccess;

    // APENAS PLATFORM_ADMIN tem acesso automatico
    if (platformAccess || fullAccess) return true;

    const permKey = MODULE_KEY_MAP[moduleKey] || moduleKey as keyof ModulePermissions;
    const perm = adjustedModulePermissions[permKey] as Record<string, unknown> | undefined;
    if (!perm) return false;

    return perm[action] === true;
  };

  /**
   * Verifica permissao sub-granular em uma entidade especifica
   */
  const hasEntityAction = (entitySlug: string, action: string): boolean => {
    if (!user || !hasRole) return false;

    // APENAS PLATFORM_ADMIN tem acesso automatico
    if (platformAccess || fullAccess) return true;

    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug) as Record<string, unknown> | undefined;
    if (!perm) return false;

    return perm[action] === true;
  };

  /**
   * SUPERFICIE OPERACIONAL (espelha o SERVICE_SCOPE=user do backend, #18).
   * Um usuario e "operacional" quando NAO tem acesso a nenhum modulo de gestao
   * (builder de entidades, tenants, usuarios, cargos, templates, logs, links
   * publicos, automacoes) e nao tem poder de plataforma/allAccess. Esse usuario
   * ganha um shell proprio (nav slim), sem o chrome do console de admin.
   * Admin NAO alterna: para ver o operacional, ele impersona um usuario.
   */
  const isOperationalSurface = useMemo(() => {
    if (!user || !hasRole) return false; // sessao ainda carregando -> nao forcar
    if (platformAccess || fullAccess) return false; // tem console completo
    const ADMIN_SURFACE_KEYS = ['entities', 'tenants', 'users', 'roles', 'templates', 'logs', 'publicLinks', 'automations'] as const;
    const perms = adjustedModulePermissions as Record<string, ModulePermission | undefined>;
    return !ADMIN_SURFACE_KEYS.some((k) => perms[k]?.canRead === true);
  }, [user, hasRole, platformAccess, fullAccess, adjustedModulePermissions]);

  /**
   * "Admin com tudo" = quem tem acesso de plataforma (permission-driven).
   * Nao existe mais tier hardcoded; o poder vem das caixas marcadas.
   */
  const isAdmin = platformAccess;

  /**
   * Acesso de plataforma (cross-tenant/impersonate/manage-tenants).
   */
  const isPlatformAdmin = platformAccess;

  /**
   * #21: a Home de ação (cards permission-aware) é o landing universal.
   */
  const getDefaultRoute = (): string => '/home';

  return {
    user,
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
    isOperationalSurface,
  };
}

/**
 * Funcao pura para determinar rota padrao baseada no user.
 * Usada no login (onSubmit) onde o hook ainda nao re-renderizou.
 */
export function getDefaultRouteForUser(_user?: unknown): string {
  // #21: a Home de ação é o landing universal (cards permission-aware).
  return '/home';
}
