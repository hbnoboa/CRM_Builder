import api from '@/lib/api';
import { CustomRole, EntityPermission, ModulePermissions, PaginatedResponse } from '@/types';

export interface QueryCustomRolesParams {
  page?: number;
  limit?: number;
  search?: string;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  tenantId?: string;
}

export interface CreateCustomRoleData {
  name: string;
  description?: string;
  color?: string;
  permissions: EntityPermission[];
  modulePermissions?: ModulePermissions;
  isDefault?: boolean;
  tenantId?: string;
}

export interface UpdateCustomRoleData {
  name?: string;
  description?: string;
  color?: string;
  permissions?: EntityPermission[];
  modulePermissions?: ModulePermissions;
  isDefault?: boolean;
  tenantId?: string;
}

export const customRolesService = {
  async getAll(params?: QueryCustomRolesParams): Promise<PaginatedResponse<CustomRole>> {
    const response = await api.get<PaginatedResponse<CustomRole>>('/custom-roles', { params });
    return response.data;
  },

  async getById(id: string): Promise<CustomRole> {
    const response = await api.get<CustomRole>(`/custom-roles/${id}`);
    return response.data;
  },

  async create(data: CreateCustomRoleData): Promise<CustomRole> {
    const response = await api.post<CustomRole>('/custom-roles', data);
    return response.data;
  },

  async update(id: string, data: UpdateCustomRoleData): Promise<CustomRole> {
    const response = await api.patch<CustomRole>(`/custom-roles/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/custom-roles/${id}`);
  },

  async assignToUser(roleId: string, userId: string): Promise<void> {
    await api.post(`/custom-roles/${roleId}/assign/${userId}`);
  },

  async removeFromUser(userId: string): Promise<void> {
    await api.delete(`/custom-roles/user/${userId}`);
  },

  async getMyPermissions(): Promise<{ entities: string[]; modules: Record<string, boolean> }> {
    const response = await api.get('/custom-roles/my-permissions');
    return response.data;
  },
};
