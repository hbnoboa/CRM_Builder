import api from '@/lib/api';
import { Tenant, TenantStatus, PaginatedResponse } from '@/types';

export interface QueryTenantsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: TenantStatus;
}

export interface CreateTenantData {
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export interface UpdateTenantData {
  name?: string;
  domain?: string;
  logo?: string;
  settings?: Record<string, unknown>;
}

export interface TenantStats {
  total: number;
  active: number;
  suspended: number;
}

// ═══════════════════════════════════════
// Copy Tenant Data
// ═══════════════════════════════════════

export interface CopyableRole {
  id: string;
  name: string;
  roleType: string;
  color: string | null;
  isSystem: boolean;
  _count: { users: number };
}

export interface CopyableEntity {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  _count: { data: number };
}

export interface CopyablePage {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
}

export interface CopyableEndpoint {
  id: string;
  name: string;
  path: string;
  method: string;
  isActive: boolean;
}

export interface CopyablePdfTemplate {
  id: string;
  name: string;
  slug: string;
  templateType: string;
  isPublished: boolean;
}

export interface CopyableData {
  roles: CopyableRole[];
  entities: CopyableEntity[];
  pages: CopyablePage[];
  endpoints: CopyableEndpoint[];
  pdfTemplates: CopyablePdfTemplate[];
}

export interface CopyEntitySelection {
  id: string;
  includeData?: boolean;
}

export interface CopyTenantDataPayload {
  sourceTenantId: string;
  targetTenantId: string;
  conflictStrategy?: 'skip' | 'suffix';
  modules: {
    roles?: string[];
    entities?: CopyEntitySelection[];
    pages?: string[];
    endpoints?: string[];
    pdfTemplates?: string[];
  };
}

export interface CopyResult {
  copied: {
    roles: number;
    entities: number;
    entityData: number;
    endpoints: number;
    pdfTemplates: number;
    pages: number;
  };
  skipped: string[];
  warnings: string[];
}

export const tenantsService = {
  async getAll(params?: QueryTenantsParams): Promise<PaginatedResponse<Tenant>> {
    const response = await api.get<PaginatedResponse<Tenant>>('/tenants', { params });
    return response.data;
  },

  async getById(id: string): Promise<Tenant> {
    const response = await api.get<Tenant>(`/tenants/${id}`);
    return response.data;
  },

  async create(data: CreateTenantData): Promise<Tenant> {
    const response = await api.post<Tenant>('/tenants', data);
    return response.data;
  },

  async update(id: string, data: UpdateTenantData): Promise<Tenant> {
    const response = await api.patch<Tenant>(`/tenants/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/tenants/${id}`);
  },

  async suspend(id: string): Promise<Tenant> {
    const response = await api.patch<Tenant>(`/tenants/${id}/suspend`);
    return response.data;
  },

  async activate(id: string): Promise<Tenant> {
    const response = await api.patch<Tenant>(`/tenants/${id}/activate`);
    return response.data;
  },

  async getStats(): Promise<TenantStats> {
    const response = await api.get<TenantStats>('/tenants/stats');
    return response.data;
  },

  async getCopyableData(tenantId: string): Promise<CopyableData> {
    const response = await api.get<CopyableData>(`/tenants/${tenantId}/copyable-data`);
    return response.data;
  },

  async copyData(payload: CopyTenantDataPayload): Promise<CopyResult> {
    const response = await api.post<CopyResult>('/tenants/copy-data', payload);
    return response.data;
  },
};
