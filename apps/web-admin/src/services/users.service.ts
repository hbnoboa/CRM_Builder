import api from '@/lib/api';
import { User, UserRole, Status, PaginatedResponse } from '@/types';

export interface QueryUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: Status;
  tenantId?: string;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  avatar?: string;
}

export interface UpdateUserData {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
  status?: Status;
  avatar?: string;
}

export const usersService = {
  async getAll(params?: QueryUsersParams): Promise<PaginatedResponse<User>> {
    const response = await api.get<PaginatedResponse<User>>('/users', { params });
    return response.data;
  },

  async getById(id: string): Promise<User> {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  async create(data: CreateUserData): Promise<User> {
    const response = await api.post<User>('/users', data);
    return response.data;
  },

  async update(id: string, data: UpdateUserData): Promise<User> {
    const response = await api.patch<User>(`/users/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  // Tenant Access
  async getUserTenantAccess(userId: string): Promise<TenantAccessItem[]> {
    const response = await api.get<TenantAccessItem[]>(`/users/${userId}/tenant-access`);
    return response.data;
  },

  async grantTenantAccess(userId: string, data: GrantTenantAccessData): Promise<TenantAccessItem> {
    const response = await api.post<TenantAccessItem>(`/users/${userId}/tenant-access`, data);
    return response.data;
  },

  async revokeTenantAccess(accessId: string): Promise<void> {
    await api.delete(`/users/tenant-access/${accessId}`);
  },
};

export interface TenantAccessItem {
  id: string;
  userId: string;
  tenantId: string;
  customRoleId: string;
  status: string;
  grantedAt: string;
  expiresAt: string | null;
  tenant: { id: string; name: string; slug: string };
  customRole: { id: string; name: string; roleType: string; color?: string };
}

export interface GrantTenantAccessData {
  tenantId: string;
  customRoleId: string;
  expiresAt?: string;
}
