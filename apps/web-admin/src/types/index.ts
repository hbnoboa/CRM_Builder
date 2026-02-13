// Re-export all shared types from @crm-builder/shared
export type {
  RoleType,
  TenantStatus,
  PermissionScope,
  FieldType,
  HttpMethod,
  AuthType,
  ApiMode,
  FilterOperator,
  SortOrder,
  NotificationType,
  PaginationQuery,
  PaginationMeta,
  PaginatedResponse,
  AuthResponse,
  LoginCredentials,
  User,
  Tenant,
  TenantPermissions,
  Entity,
  EntityField,
  EntitySettings,
  Field,
  EntityData,
  CustomRole,
  EntityPermission,
  ModulePermission,
  ModulePermissions,
  CustomApi,
  FixedFilter,
  QueryParam,
  OrderByConfig,
  Notification,
  Page,
} from '@crm-builder/shared';

export { ROLE_TYPES, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@crm-builder/shared';

// Re-import for use in local aliases
import type { RoleType, EntityData, Status as SharedStatus } from '@crm-builder/shared';

// ============================================================================
// Frontend-specific types (not shared)
// ============================================================================

// Status com PENDING adicional (usado em forms do frontend)
export type Status = SharedStatus | 'PENDING';

// Alias para compatibilidade
export type UserRole = RoleType;

// Alias for backwards compatibility
export type EntityDate = EntityData;

export interface RegisterDate {
  email: string;
  password: string;
  name: string;
  tenantName: string;
}

// Legacy Role interface (antes do CustomRole)
export interface Role {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  permissions: string[] | Record<string, unknown>;
  tenantId: string;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
