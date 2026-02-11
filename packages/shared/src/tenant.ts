import { TenantStatus } from './enums';

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

export interface TenantPermissions {
  canAccessAllTenants?: boolean;
  allowedTenantIds?: string[];
}
