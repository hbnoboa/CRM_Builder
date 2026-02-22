import api from '@/lib/api';
import { DataFilter, Entity, EntityField, PaginatedResponse } from '@/types';

export interface CreateEntityData {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  fields?: EntityField[];
  settings?: Record<string, unknown>;
  tenantId?: string;
}

export interface UpdateEntityData {
  name?: string;
  namePlural?: string;
  description?: string;
  icon?: string;
  color?: string;
  fields?: EntityField[];
  settings?: Record<string, unknown>;
}

export interface QueryEntitiesParams {
  page?: number;
  limit?: number;
  search?: string;
  tenantId?: string;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const entitiesService = {
  async getAll(params?: QueryEntitiesParams): Promise<PaginatedResponse<Entity>> {
    const response = await api.get<PaginatedResponse<Entity>>('/entities', { params });
    return response.data;
  },

  async getBySlug(slug: string): Promise<Entity> {
    const response = await api.get<Entity>(`/entities/slug/${slug}`);
    return response.data;
  },

  async getById(id: string): Promise<Entity> {
    const response = await api.get<Entity>(`/entities/${id}`);
    return response.data;
  },

  async create(data: CreateEntityData): Promise<Entity> {
    const response = await api.post<Entity>('/entities', data);
    return response.data;
  },

  async update(id: string, data: UpdateEntityData): Promise<Entity> {
    const response = await api.patch<Entity>(`/entities/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/entities/${id}`);
  },

  async updateColumnConfig(id: string, visibleColumns: string[]): Promise<Entity> {
    const response = await api.patch<Entity>(`/entities/${id}/column-config`, { visibleColumns });
    return response.data;
  },

  async updateGlobalFilters(id: string, globalFilters: unknown[]): Promise<Entity> {
    const response = await api.patch<Entity>(`/entities/${id}/global-filters`, { globalFilters });
    return response.data;
  },

  async getRoleFilters(entityId: string): Promise<Record<string, DataFilter[]>> {
    const response = await api.get<Record<string, DataFilter[]>>(`/entities/${entityId}/role-filters`);
    return response.data;
  },

  async updateRoleFilters(entityId: string, roleId: string, filters: DataFilter[]): Promise<Entity> {
    const response = await api.patch<Entity>(`/entities/${entityId}/role-filters/${roleId}`, { filters });
    return response.data;
  },

  async deleteRoleFilters(entityId: string, roleId: string): Promise<Entity> {
    const response = await api.delete<Entity>(`/entities/${entityId}/role-filters/${roleId}`);
    return response.data;
  },
};
