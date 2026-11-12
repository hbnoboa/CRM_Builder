import api from '@/lib/api';
import { User, Status, PaginatedResponse } from '@/types';

export interface QueryUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: Status;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: string;
  avatar?: string;
}

export interface UpdateUserData {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
  status?: Status;
  avatar?: string;
}

export const usersService = {
  async getAll(params?: QueryUsersParams): Promise<PaginatedResponse<User>> {
    const response = await api.get<PaginatedResponse<User>>('/users', { params });
    return response.data;
  },

  /** Todas as pessoas da empresa (a API pagina de 100 em 100). */
  async getAllPages(params?: Omit<QueryUsersParams, 'page' | 'limit'>): Promise<PaginatedResponse<User>> {
    const limit = 100;
    const first = await this.getAll({ ...params, page: 1, limit });
    const all = [...(first.data ?? [])];
    const totalPages = first.meta?.totalPages ?? 1;
    for (let page = 2; page <= totalPages; page++) {
      const next = await this.getAll({ ...params, page, limit });
      all.push(...(next.data ?? []));
    }
    return { ...first, data: all };
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
};
