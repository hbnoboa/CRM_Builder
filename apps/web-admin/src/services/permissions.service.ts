import api from '@/lib/api';

// Formato retornado pelo backend em GET /permissions
export interface Permission {
  key: string;
  description: string;
  category: string;
}

// Formato retornado pelo backend em GET /permissions/grouped
// { entities: Permission[], data: Permission[], ... }
export type PermissionsByCategory = Record<string, Permission[]>;

// Formato retornado pelo backend em GET /permissions/me
// Array de strings com as chaves das permissoes
export type UserPermissions = string[];

export const permissionsService = {
  // GET /permissions - retorna array de permissoes
  async getAll(): Promise<Permission[]> {
    const response = await api.get<Permission[]>('/permissions');
    return response.data;
  },

  // GET /permissions/grouped - retorna objeto agrupado por categoria
  async getGrouped(): Promise<PermissionsByCategory> {
    const response = await api.get<PermissionsByCategory>('/permissions/grouped');
    return response.data;
  },

  // GET /permissions/me - retorna array de strings com permissoes do usuario
  async getMyPermissions(): Promise<UserPermissions> {
    const response = await api.get<UserPermissions>('/permissions/me');
    return response.data;
  },
};
