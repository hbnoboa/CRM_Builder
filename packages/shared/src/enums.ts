// ============================================================================
// ROLE TYPES
// ============================================================================

export type RoleType = 'PLATFORM_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' | 'CUSTOM';

export const ROLE_TYPES: RoleType[] = [
  'PLATFORM_ADMIN',
  'ADMIN',
  'MANAGER',
  'USER',
  'VIEWER',
  'CUSTOM',
];

// ============================================================================
// STATUS
// ============================================================================

export type Status = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TRIAL';

// ============================================================================
// PERMISSION SCOPE
// ============================================================================

export type PermissionScope = 'all' | 'own';

// ============================================================================
// FIELD TYPES (Entity Builder)
// ============================================================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'email'
  | 'phone'
  | 'url'
  | 'cpf'
  | 'cnpj'
  | 'cep'
  | 'date'
  | 'datetime'
  | 'time'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'api-select'
  | 'relation'
  | 'file'
  | 'image'
  | 'color'
  | 'rating'
  | 'slider'
  | 'password'
  | 'hidden'
  | 'json'
  | 'map'
  | 'array'
  | 'sub-entity'
  | 'zone-diagram';

// ============================================================================
// HTTP / API
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AuthType = 'NONE' | 'API_KEY' | 'JWT' | 'BASIC';

export type ApiMode = 'visual' | 'code';

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

// ============================================================================
// SORT / PAGINATION
// ============================================================================

export type SortOrder = 'asc' | 'desc';

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
