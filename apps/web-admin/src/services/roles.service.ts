import api from '@/lib/api';
import { Role, PaginatedResponse } from '@/types';

export interface CreateRoleData {
  name: string;
  slug?: string;
  description?: string;
  permissions?: string[];
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface QueryRolesParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface RoleWithCounts extends Role {
  _count?: {
    users: number;
  };
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  role: Role;
}

export interface EntityPermission {
  id: string;
  roleId: string;
  entityId: string;
  tenantId: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  entity?: {
    id: string;
    name: string;
    slug: string;
    icon?: string;
  };
}

export interface EntityPermissionInput {
  entityId: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export const rolesService = {
  async getAll(params?: QueryRolesParams): Promise<PaginatedResponse<RoleWithCounts>> {
    const response = await api.get<PaginatedResponse<RoleWithCounts>>('/roles', { params });
    return response.data;
  },

  async getById(id: string): Promise<Role> {
    const response = await api.get<Role>(`/roles/${id}`);
    return response.data;
  },

  async create(data: CreateRoleData): Promise<Role> {
    const response = await api.post<Role>('/roles', data);
    return response.data;
  },

  async update(id: string, data: UpdateRoleData): Promise<Role> {
    const response = await api.patch<Role>(`/roles/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/roles/${id}`);
  },

  async assignToUser(userId: string, roleId: string): Promise<UserRole> {
    const response = await api.post<UserRole>('/roles/assign', { userId, roleId });
    return response.data;
  },

  async removeFromUser(userId: string, roleId: string): Promise<void> {
    await api.delete(`/roles/user/${userId}/role/${roleId}`);
  },

  async getUserRoles(userId: string): Promise<UserRole[]> {
    const response = await api.get<UserRole[]>(`/roles/user/${userId}`);
    return response.data;
  },

  // ========== ENTITY PERMISSIONS ==========

  async getEntityPermissions(roleId: string): Promise<EntityPermission[]> {
    const response = await api.get<EntityPermission[]>(`/roles/${roleId}/entity-permissions`);
    return response.data;
  },

  async setEntityPermission(
    roleId: string,
    data: EntityPermissionInput,
  ): Promise<EntityPermission> {
    const response = await api.post<EntityPermission>(`/roles/${roleId}/entity-permissions`, data);
    return response.data;
  },

  async removeEntityPermission(roleId: string, entityId: string): Promise<void> {
    await api.delete(`/roles/${roleId}/entity-permissions/${entityId}`);
  },

  async bulkSetEntityPermissions(
    roleId: string,
    entityPermissions: EntityPermissionInput[],
  ): Promise<EntityPermission[]> {
    const response = await api.post<EntityPermission[]>(
      `/roles/${roleId}/entity-permissions/bulk`,
      { entityPermissions },
    );
    return response.data;
  },
};
