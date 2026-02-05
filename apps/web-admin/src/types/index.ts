export type UserRole = 'PLATFORM_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';
export type Status = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TRIAL';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan?: string;
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
  role: UserRole;
  status: Status;
  tenantId: string;
  tenant?: Tenant;
  additionalRoles?: Role[];
  permissions?: string[];
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
  default?: unknown;
  options?: Array<string | { value: string; label: string; color?: string }>;
  validation?: Record<string, unknown>;
  // api-select specific properties
  apiEndpoint?: string; // Custom API path (e.g., "/corretores")
  valueField?: string; // Field to use as value (default: "id")
  labelField?: string; // Field to use as label (default: "name" or first text field)
  // Fields to auto-fill from selected item
  autoFillFields?: Array<{
    sourceField: string; // Field from API response
    targetField: string; // Field in this entity to fill
  }>;
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'api-select' // Select that fetches options from Custom API
  | 'file'
  | 'image'
  | 'relation'
  | 'json';

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

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
