import { Prisma } from '@prisma/client';

/**
 * Cargos padrao de toda empresa nova (cadastro self-service e console).
 * Mesmos nomes e niveis em todas as empresas: menor rank = mais poder.
 * O coringa '*' cobre todas as tabelas, inclusive as criadas depois.
 */
export type DefaultRoleKey = 'admin' | 'manager' | 'operator' | 'viewer';

type ModulePerm = { canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean };

const NONE: ModulePerm = { canRead: false, canCreate: false, canUpdate: false, canDelete: false };
const READ: ModulePerm = { ...NONE, canRead: true };
const WRITE: ModulePerm = { canRead: true, canCreate: true, canUpdate: true, canDelete: false };

export interface DefaultRoleTemplate {
  key: DefaultRoleKey;
  rank: number;
  color: string;
  isDefault: boolean;
  modulePermissions: Prisma.InputJsonObject;
  permissions: Prisma.InputJsonArray;
}

export const DEFAULT_ROLE_TEMPLATES: DefaultRoleTemplate[] = [
  {
    key: 'admin',
    rank: 10,
    color: '#7c3aed',
    isDefault: false,
    modulePermissions: { allAccess: true },
    permissions: [{
      entitySlug: '*', scope: 'all',
      canRead: true, canCreate: true, canUpdate: true, canDelete: true,
      canExport: true, canImport: true, canConfigureColumns: true,
    }],
  },
  {
    key: 'manager',
    rank: 30,
    color: '#2563eb',
    isDefault: false,
    modulePermissions: {
      dashboard: READ, data: { ...WRITE, canDelete: true }, users: READ, roles: READ,
      settings: READ, entities: NONE, apis: NONE,
      templates: { ...READ, canGenerate: true }, publicLinks: READ, chat: { manage: true },
    },
    permissions: [{
      entitySlug: '*', scope: 'all',
      canRead: true, canCreate: true, canUpdate: true, canDelete: true, canExport: true, canImport: false,
    }],
  },
  {
    key: 'operator',
    rank: 50,
    color: '#059669',
    isDefault: true,
    modulePermissions: {
      dashboard: READ, data: WRITE, users: NONE, roles: NONE,
      settings: READ, entities: NONE, apis: NONE,
      templates: { ...READ, canGenerate: true },
    },
    permissions: [{
      entitySlug: '*', scope: 'own',
      canRead: true, canCreate: true, canUpdate: true, canDelete: false, canExport: false, canImport: false,
    }],
  },
  {
    key: 'viewer',
    rank: 70,
    color: '#64748b',
    isDefault: false,
    modulePermissions: {
      dashboard: READ, data: READ, users: NONE, roles: NONE,
      settings: READ, entities: NONE, apis: NONE,
      templates: { ...READ, canGenerate: true },
    },
    permissions: [{
      entitySlug: '*', scope: 'all',
      canRead: true, canCreate: false, canUpdate: false, canDelete: false, canExport: false, canImport: false,
    }],
  },
];
