// RoleType substitui o antigo UserRole - agora baseado em CustomRole.roleType
export type RoleType = 'PLATFORM_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' | 'CUSTOM';
// Manter UserRole como alias para compatibilidade
export type UserRole = RoleType;

export type Status = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TRIAL';

export interface TenantPermissions {
  canAccessAllTenants?: boolean;
  allowedTenantIds?: string[];
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  settings?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    users?: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  // role foi removido - usar customRole.roleType
  customRoleId: string;
  customRole: CustomRole;
  status: Status;
  tenantId: string;
  tenant?: Tenant;
  permissions?: string[];
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomRole {
  id: string;
  name: string;
  description?: string;
  color?: string;
  roleType: RoleType;           // Tipo da role (PLATFORM_ADMIN, ADMIN, MANAGER, USER, VIEWER, CUSTOM)
  isSystem: boolean;            // Se e role do sistema (nao pode deletar/renomear)
  permissions: EntityPermission[];
  modulePermissions?: ModulePermissions;
  tenantPermissions?: TenantPermissions; // Permissoes cross-tenant (para PLATFORM_ADMIN)
  isDefault?: boolean;
  tenantId: string;
  _count?: { users: number };
  users?: Array<{ id: string; name: string; email: string; avatar?: string }>;
  createdAt?: string;
  updatedAt?: string;
}

export type PermissionScope = 'all' | 'own';

export interface EntityPermission {
  entitySlug: string;
  entityName?: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  scope?: PermissionScope; // 'all' = todos os registros, 'own' = apenas proprios
}

export interface ModulePermissions {
  dashboard?: boolean;
  users?: boolean;
  settings?: boolean;
  apis?: boolean;
  pages?: boolean;
  entities?: boolean;
}

export interface Role {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  permissions: string[] | Record<string, unknown>;
  tenantId: string;
  tenant?: Tenant;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterDate {
  email: string;
  password: string;
  name: string;
  tenantName: string;
}

export interface Entity {
  id: string;
  tenantId: string;
  tenant?: Tenant;
  name: string;
  namePlural?: string;
  slug: string;
  icon?: string;
  color?: string;
  description?: string;
  fields: EntityField[];
  settings?: EntitySettings;
  isSystem?: boolean;
  _count?: {
    data: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface EntityField {
  slug: string;
  name: string;
  label?: string; // Optional, fallback to name for display
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  hidden?: boolean; // Se true, campo nao aparece no formulario (preenchido via Custom API)
  default?: unknown;
  options?: Array<string | { value: string; label: string; color?: string }>;
  validation?: Record<string, unknown>;
  placeholder?: string;
  helpText?: string;

  // Grid positioning for form layout
  gridRow?: number;    // Row position (1-based, fields with same row appear on same line)
  gridColSpan?: number; // Column span (1-12, default 12 = full width)
  gridColStart?: number; // Column start position (1-based, allows gaps between fields)

  // api-select specific properties
  apiEndpoint?: string; // Custom API path (e.g., "/corretores")
  valueField?: string; // Field to use as value (default: "id")
  labelField?: string; // Field to use as label (default: "name" or first text field)
  // Fields available from the API response (for auto-fill source selection)
  apiFields?: string[];
  // Fields to auto-fill from selected item
  autoFillFields?: Array<{
    sourceField: string; // Field from API response
    targetField: string; // Field in this entity to fill
  }>;

  // relation specific properties
  relatedEntityId?: string;    // ID of the related entity
  relatedEntitySlug?: string;  // Slug of the related entity
  relatedDisplayField?: string; // Field to display from related entity (default: first text field)

  // number/currency specific
  min?: number;
  max?: number;
  step?: number;
  prefix?: string; // e.g., "R$" for currency
  suffix?: string; // e.g., "%" for percentage

  // text specific
  mask?: string; // Input mask pattern

  // map specific
  mapMode?: 'latlng' | 'address' | 'both'; // Display mode: lat/lng inputs, address input, or both
  mapDefaultCenter?: [number, number]; // Default center [lat, lng]
  mapDefaultZoom?: number; // Default zoom level (1-18)
  mapHeight?: number; // Map height in pixels (default 300)

  // sub-entity specific
  subEntityId?: string;    // ID of the child entity
  subEntitySlug?: string;  // Slug of the child entity
  subEntityDisplayFields?: string[]; // Which fields of the child entity to show in the table

  // zone-diagram specific
  diagramImage?: string;       // URL of the background image
  diagramZones?: Array<{
    id: string;
    label: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    optionsSource: 'manual' | 'entity'; // Where options come from
    options?: string[];                 // Manual hardcoded options
    sourceEntitySlug?: string;          // Entity slug to fetch options from
    sourceFieldSlug?: string;           // Field from entity to use as option labels
  }>;
}

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
  | 'api-select' // Select that fetches options from Custom API
  | 'relation'   // Relation to another entity
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

export interface EntitySettings {
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  enableAudit?: boolean;
  softDelete?: boolean;
}

// Alias para compatibilidade
export type Field = EntityField;

export interface EntityData {
  id: string;
  entityId: string;
  tenantId: string;
  tenant?: Tenant;
  data: Record<string, unknown>;
  createdById: string;
  updatedById: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  updatedBy?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Alias for backwards compatibility
export type EntityDate = EntityData;

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
