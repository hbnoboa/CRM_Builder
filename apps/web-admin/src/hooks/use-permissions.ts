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

/** Acesso total DENTRO do tenant (todos os módulos/tabelas, presente e futuro). */
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
 * Permissoes de modulo concedidas a quem tem ACESSO TOTAL ao tenant
 * (modulePermissions.allAccess). Nao existe tier por roleType:
 * todos os demais cargos usam exclusivamente modulePermissions do banco.
 */
const READ_ONLY: ModulePermission = { canRead: true, canCreate: false, canUpdate: false, canDelete: false };

const FULL_TENANT_PERMISSIONS: ModulePermissions = {
  dashboard: FULL_CRUD,
  users: FULL_CRUD,
  settings: FULL_CRUD,
  entities: FULL_CRUD,
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

/** Modulos da camada "administracao da empresa" (espelha ADMIN_AREA_MODULES da API). */
const ADMIN_AREA_MODULES = ['entities', 'users', 'roles', 'settings', 'automations', 'templates', 'logs', 'publicLinks'] as const;

/** Secao de /gestao -> permissao que abre a secao. */
const ADMIN_SECTION_RULES: Record<string, { module: string; action: 'canRead' | 'canUpdate' | 'any' }> = {
  users: { module: 'users', action: 'canRead' },
  roles: { module: 'roles', action: 'canRead' },
  permissions: { module: 'roles', action: 'canRead' },
  entities: { module: 'entities', action: 'any' },
  'pdf-templates': { module: 'pdfTemplates', action: 'canRead' },
  'dashboard-templates': { module: 'dashboardTemplates', action: 'canRead' },
  'public-links': { module: 'publicLinks', action: 'any' },
  'audit-logs': { module: 'auditLogs', action: 'canRead' },
  'execution-logs': { module: 'executionLogs', action: 'canRead' },
  organization: { module: 'settings', action: 'canUpdate' },
  plan: { module: 'settings', action: 'canUpdate' },
};

const MODULE_KEYS: (keyof ModulePermissions)[] = ['dashboard', 'users', 'settings', 'entities', 'data', 'roles', 'automations', 'templates', 'logs', 'notifications', 'publicLinks', 'archive'];

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  // Toda autorizacao e permission-driven: basta o usuario ter um cargo (customRole).
  const hasRole = !!user?.customRole;

  // Acesso total ao tenant = modulePermissions.allAccess (dinâmico, sem cross-tenant).
  const fullAccess = useMemo(
    () => readFullTenantAccess(user?.customRole?.modulePermissions as Record<string, unknown> | undefined),
    [user],
  );

  const modulePermissions = useMemo<ModulePermissions>(() => {
    if (!user || !hasRole) return {};

    // Acesso total ao tenant libera tudo (hardcoded)
    if (fullAccess) {
      return FULL_TENANT_PERMISSIONS;
    }

    // Demais cargos: usar APENAS modulePermissions do banco
    if (user.customRole?.modulePermissions) {
      return normalizeModulePermissions(user.customRole.modulePermissions as Record<string, unknown>) as ModulePermissions;
    }

    // Sem modulePermissions no DB = sem acesso
    return {};
  }, [user, hasRole, fullAccess]);

  const entityPermissions = useMemo<EntityPermission[]>(() => {
    if (!user || !hasRole) return [];

    if (user.customRole?.permissions) {
      return Array.isArray(user.customRole.permissions)
        ? user.customRole.permissions
        : [];
    }

    return [];
  }, [user, hasRole]);

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

    // Acesso total ao tenant sempre tem acesso
    if (fullAccess) return true;

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

    // Acesso total ao tenant sempre tem acesso
    if (fullAccess) return true;

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

    // Acesso total ao tenant tem acesso automatico
    if (fullAccess) return true;

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

    // Acesso total ao tenant tem scope automatico
    if (fullAccess) return 'all';

    // Todos os outros: usar scope definido nas permissoes
    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug);
    return perm?.scope || 'own';
  };

  /**
   * Verifica permissao sub-granular (acoes especiais) em um modulo
   */
  const hasModuleAction = (moduleKey: string, action: string): boolean => {
    if (!user || !hasRole) return false;

    // Acesso total ao tenant tem acesso automatico
    if (fullAccess) return true;

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

    // Acesso total ao tenant tem acesso automatico
    if (fullAccess) return true;

    const perm = entityPermissions.find((p) => p.entitySlug === entitySlug) as Record<string, unknown> | undefined;
    if (!perm) return false;

    return perm[action] === true;
  };

  /**
   * Administracao da empresa (/gestao): mesma regra do hasAdminArea da API —
   * acesso total, ou qualquer permissao num modulo de gestao (settings: so canUpdate).
   */
  const canAccessAdminArea = useMemo(() => {
    if (!user || !hasRole) return false;
    if (fullAccess) return true;
    const raw = (user.customRole?.modulePermissions ?? {}) as Record<string, unknown>;
    return ADMIN_AREA_MODULES.some((key) => {
      const perm = raw[key];
      if (perm === true) return true;
      if (!perm || typeof perm !== 'object') return false;
      const p = perm as Record<string, unknown>;
      // settings: so editar a organizacao; templates: ver/gerar e operacao (gerar PDF).
      if (key === 'settings') return p.canUpdate === true;
      if (key === 'templates') return p.canCreate === true || p.canUpdate === true || p.canDelete === true;
      return Object.values(p).some((v) => v === true);
    });
  }, [user, hasRole, fullAccess]);

  /**
   * SUPERFICIE OPERACIONAL (espelha o SERVICE_SCOPE=user do backend, #18): quem nao
   * entra na administracao usa o shell operacional (nav slim, sem chrome de gestao).
   */
  const isOperationalSurface = !!user && hasRole && !canAccessAdminArea;

  /** Pode abrir esta secao da administracao? (`section` = 1o segmento depois de /gestao) */
  const canAccessAdminSection = (section: string | undefined): boolean => {
    if (!canAccessAdminArea) return false;
    if (fullAccess || !section) return true;
    const rule = ADMIN_SECTION_RULES[section];
    if (!rule) return false;
    return rule.action === 'any'
      ? (['canRead', 'canCreate', 'canUpdate', 'canDelete'] as const).some((a) => hasModulePermission(rule.module, a))
      : hasModulePermission(rule.module, rule.action);
  };

  /**
   * "Admin com tudo" = acesso total DENTRO do tenant (modulePermissions.allAccess).
   * Poderes de plataforma vivem apenas no console de staff (/admin).
   */
  const isAdmin = fullAccess;

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
    isOperationalSurface,
    canAccessAdminArea,
    canAccessAdminSection,
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
