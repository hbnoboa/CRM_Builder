import api from '@/lib/api';
import { EntityData, PaginatedResponse, Entity } from '@/types';

export interface QueryDataParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EntityDataResponse extends PaginatedResponse<EntityData> {
  entity: Pick<Entity, 'id' | 'name' | 'namePlural' | 'slug' | 'fields' | 'settings'>;
}

export interface EntityDataDetailResponse extends EntityData {
  entity: Pick<Entity, 'id' | 'name' | 'slug' | 'fields'>;
}

export const dataService = {
  async getAll(
    entitySlug: string,
    params?: QueryDataParams
  ): Promise<EntityDataResponse> {
    const response = await api.get<EntityDataResponse>(
      `/data/${entitySlug}`,
      { params }
    );
    return response.data;
  },

  async getById(
    entitySlug: string,
    id: string
  ): Promise<EntityDataDetailResponse> {
    const response = await api.get<EntityDataDetailResponse>(
      `/data/${entitySlug}/${id}`
    );
    return response.data;
  },

  async create(
    entitySlug: string,
    data: Record<string, unknown>
  ): Promise<EntityData> {
    const response = await api.post<EntityData>(
      `/data/${entitySlug}`,
      { data }
    );
    return response.data;
  },

  async update(
    entitySlug: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<EntityData> {
    const response = await api.patch<EntityData>(
      `/data/${entitySlug}/${id}`,
      { data }
    );
    return response.data;
  },

  async delete(entitySlug: string, id: string): Promise<void> {
    await api.delete(`/data/${entitySlug}/${id}`);
  },
};
