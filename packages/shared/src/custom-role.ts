import { RoleType, PermissionScope } from './enums';
import { TenantPermissions } from './tenant';

export interface FieldPermission {
  fieldSlug: string;
  canView: boolean;
  canEdit: boolean;
}

export interface DataFilter {
  fieldSlug: string;
  fieldName: string;
  fieldType: string;
  operator: string;
  value?: unknown;
  value2?: unknown;
}

export interface NotificationRule {
  enabled: boolean;
  onCreate: boolean;
  onUpdate: boolean;
  onDelete: boolean;
  conditions?: DataFilter[];
}

export interface EntityPermission {
  entitySlug: string;
  entityName?: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  scope?: PermissionScope;
  fieldPermissions?: FieldPermission[];
  dataFilters?: DataFilter[];
  notificationRules?: NotificationRule;
  // Sub-granular actions per entity (data module)
  canExport?: boolean;
  canImport?: boolean;
  canConfigureColumns?: boolean;
}

export interface ModulePermission {
  canRead?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  // Sub-granular actions (each module uses its relevant fields)
  canActivate?: boolean;      // apis, tenants
  canTest?: boolean;           // apis
  canPublish?: boolean;        // pages
  canDuplicate?: boolean;      // pages
  canGenerate?: boolean;       // pdfTemplates
  canSuspend?: boolean;        // tenants
  canAssignRole?: boolean;     // users
  canChangeStatus?: boolean;   // users
  canSetDefault?: boolean;     // roles
  canManagePermissions?: boolean; // roles
  canUpdateLayout?: boolean;   // entities
  canCreateField?: boolean;    // entities
  canDeleteField?: boolean;    // entities
  canUpdateField?: boolean;    // entities
  canConfigureColumns?: boolean; // data
  canExport?: boolean;         // data
  canImport?: boolean;         // data
}

export interface ModulePermissions {
  dashboard?: ModulePermission;
  users?: ModulePermission;
  settings?: ModulePermission;
  apis?: ModulePermission;
  pages?: ModulePermission;
  pdfTemplates?: ModulePermission;
  entities?: ModulePermission;
  tenants?: ModulePermission;
  data?: ModulePermission;
  roles?: ModulePermission;
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
