import api from '@/lib/api';

export interface Permission {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionGroup {
  category: string;
  permissions: Permission[];
}

export interface UserPermissions {
  baseRole: string;
  permissions: string[];
  customRoles: {
    id: string;
    name: string;
    permissions: string[];
  }[];
}

export const permissionsService = {
  async getAll(): Promise<Permission[]> {
    const response = await api.get<Permission[]>('/permissions');
    return response.data;
  },

  async getGrouped(): Promise<PermissionGroup[]> {
    const response = await api.get<PermissionGroup[]>('/permissions/grouped');
    return response.data;
  },

  async getMyPermissions(): Promise<UserPermissions> {
    const response = await api.get<UserPermissions>('/permissions/me');
    return response.data;
  },
};
