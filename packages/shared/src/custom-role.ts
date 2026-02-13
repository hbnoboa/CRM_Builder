import { RoleType, PermissionScope } from './enums';
import { TenantPermissions } from './tenant';

export interface EntityPermission {
  entitySlug: string;
  entityName?: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  scope?: PermissionScope;
}

export interface ModulePermission {
  canRead?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

export interface ModulePermissions {
  dashboard?: ModulePermission;
  users?: ModulePermission;
  settings?: ModulePermission;
  apis?: ModulePermission;
  pages?: ModulePermission;
  entities?: ModulePermission;
  tenants?: ModulePermission;
}

export interface CustomRole {
  id: string;
  name: string;
  description?: string;
  color?: string;
  roleType: RoleType;
  isSystem: boolean;
  permissions: EntityPermission[];
  modulePermissions?: ModulePermissions;
  tenantPermissions?: TenantPermissions;
  isDefault?: boolean;
  tenantId: string;
  _count?: { users: number };
  users?: Array<{ id: string; name: string; email: string; avatar?: string }>;
  createdAt?: string;
  updatedAt?: string;
}
