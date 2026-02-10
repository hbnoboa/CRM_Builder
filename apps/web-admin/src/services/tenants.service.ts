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
};
