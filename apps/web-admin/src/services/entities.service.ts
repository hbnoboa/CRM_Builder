import api from '@/lib/api';
import { Entity, EntityField, PaginatedResponse } from '@/types';

export interface CreateEntityData {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  fields?: EntityField[];
  settings?: Record<string, unknown>;
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
};
