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
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tenantId?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  role: UserRole;
  status: Status;
  tenantId: string;
  organizationId: string;
  tenant?: Tenant;
  organization?: Organization;
  additionalRoles?: Role[];
  permissions?: string[];
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Record<string, unknown>;
  tenantId: string;
  organizationId?: string;
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
  workspaceId: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  fields: EntityField[];
  settings?: EntitySettings;
  createdAt?: string;
  updatedAt?: string;
}

export interface EntityField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  options?: string[];
  validation?: Record<string, unknown>;
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

export interface EntityDate {
  id: string;
  entityId: string;
  data: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
