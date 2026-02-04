import api from '@/lib/api';
import { PaginatedResponse } from '@/types';

export interface CustomApi {
  id: string;
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description?: string;
  mode?: 'visual' | 'code';
  sourceEntityId?: string;
  sourceEntity?: {
    id: string;
    name: string;
    slug: string;
    fields?: unknown[];
  };
  selectedFields?: string[];
  filters?: unknown[];
  queryParams?: unknown[];
  orderBy?: unknown;
  limitRecords?: number;
  code?: string;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomApiData {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description?: string;
  mode?: 'visual' | 'code';
  sourceEntityId?: string;
  selectedFields?: string[];
  filters?: unknown[];
  queryParams?: unknown[];
  orderBy?: unknown;
  limitRecords?: number;
  code?: string;
}

export interface UpdateCustomApiData {
  name?: string;
  path?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description?: string;
  mode?: 'visual' | 'code';
  sourceEntityId?: string;
  selectedFields?: string[];
  filters?: unknown[];
  queryParams?: unknown[];
  orderBy?: unknown;
  limitRecords?: number;
  code?: string;
  isActive?: boolean;
}

export interface QueryCustomApisParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  method?: string;
}

export const customApisService = {
  async getAll(params?: QueryCustomApisParams): Promise<PaginatedResponse<CustomApi>> {
    const response = await api.get<PaginatedResponse<CustomApi>>('/custom-apis', { params });
    return response.data;
  },

  async getByEntityId(entityId: string): Promise<PaginatedResponse<CustomApi>> {
    const response = await api.get<PaginatedResponse<CustomApi>>('/custom-apis', {
      params: { sourceEntityId: entityId }
    });
    return response.data;
  },

  async getById(id: string): Promise<CustomApi> {
    const response = await api.get<CustomApi>(`/custom-apis/${id}`);
    return response.data;
  },

  async create(data: CreateCustomApiData): Promise<CustomApi> {
    const response = await api.post<CustomApi>('/custom-apis', data);
    return response.data;
  },

  async update(id: string, data: UpdateCustomApiData): Promise<CustomApi> {
    const response = await api.patch<CustomApi>(`/custom-apis/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/custom-apis/${id}`);
  },

  async activate(id: string): Promise<CustomApi> {
    const response = await api.patch<CustomApi>(`/custom-apis/${id}/activate`);
    return response.data;
  },

  async deactivate(id: string): Promise<CustomApi> {
    const response = await api.patch<CustomApi>(`/custom-apis/${id}/deactivate`);
    return response.data;
  },

  async test(id: string, payload?: Record<string, unknown>): Promise<unknown> {
    const response = await api.post(`/custom-apis/${id}/test`, payload);
    return response.data;
  },
};
