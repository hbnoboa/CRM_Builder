import api from '@/lib/api';

export interface CustomApi {
  id: string;
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description?: string;
  code?: string;
  isActive: boolean;
  entityId?: string;
  entity?: {
    id: string;
    name: string;
    slug: string;
  };
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomApiData {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description?: string;
  code?: string;
  entityId?: string; // Vinculado a uma entity especifica
}

export interface UpdateCustomApiData {
  name?: string;
  path?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description?: string;
  code?: string;
  isActive?: boolean;
}

export const customApisService = {
  async getAll(): Promise<CustomApi[]> {
    const response = await api.get<{ data: CustomApi[]; meta?: unknown } | CustomApi[]>('/custom-apis');
    // A API retorna { data: [...], meta: {...} } - extrair o array
    const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
    return data;
  },

  async getByEntityId(entityId: string): Promise<CustomApi[]> {
    const response = await api.get<{ data: CustomApi[]; meta?: unknown } | CustomApi[]>(`/custom-apis?entityId=${entityId}`);
    const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
    return data;
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
