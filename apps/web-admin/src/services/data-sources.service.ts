import api from '@/lib/api';
import type { DataSourceDefinition, DataSourceResult } from '@crm-builder/shared';

export interface DataSourceItem {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  definition: DataSourceDefinition;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdById?: string;
}

export interface CreateDataSourceData {
  name: string;
  slug: string;
  description?: string;
  definition?: DataSourceDefinition;
}

export interface UpdateDataSourceData {
  name?: string;
  slug?: string;
  description?: string;
  definition?: DataSourceDefinition;
}

export interface RelatedEntity {
  entitySlug: string;
  fieldSlug: string;
  fieldLabel: string;
  type: 'relation' | 'sub-entity' | 'reverse-relation' | 'reverse-sub-entity';
}

export const dataSourcesService = {
  async getAll(search?: string): Promise<{ data: DataSourceItem[]; total: number }> {
    const response = await api.get<{ data: DataSourceItem[]; total: number }>('/data-sources', {
      params: search ? { search } : undefined,
    });
    return response.data;
  },

  async getById(id: string): Promise<DataSourceItem> {
    const response = await api.get<DataSourceItem>(`/data-sources/${id}`);
    return response.data;
  },

  async create(data: CreateDataSourceData): Promise<DataSourceItem> {
    const response = await api.post<DataSourceItem>('/data-sources', data);
    return response.data;
  },

  async update(id: string, data: UpdateDataSourceData): Promise<DataSourceItem> {
    const response = await api.patch<DataSourceItem>(`/data-sources/${id}`, data);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/data-sources/${id}`);
  },

  async execute(id: string, params?: { runtimeFilters?: unknown[]; page?: number; limit?: number }): Promise<DataSourceResult> {
    const response = await api.post<DataSourceResult>(`/data-sources/${id}/execute`, params || {});
    return response.data;
  },

  async preview(definition: DataSourceDefinition, limit?: number): Promise<DataSourceResult> {
    const response = await api.post<DataSourceResult>('/data-sources/preview', { definition, limit: limit || 10 });
    return response.data;
  },

  async getRelatedEntities(entitySlug: string): Promise<RelatedEntity[]> {
    const response = await api.get<RelatedEntity[]>(`/data-sources/related/${entitySlug}`);
    return response.data;
  },
};
