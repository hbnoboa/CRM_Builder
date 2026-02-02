import api from '@/lib/api';
import { Organization } from '@/types';

export interface CreateOrganizationData {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
}

export interface UpdateOrganizationData {
  name?: string;
  description?: string;
  logo?: string;
}

export interface OrganizationWithCounts extends Organization {
  _count?: {
    users: number;
    workspaces: number;
  };
}

export const organizationsService = {
  async getAll(): Promise<OrganizationWithCounts[]> {
    const response = await api.get<OrganizationWithCounts[]>('/organizations');
    return response.data;
  },

  async getById(id: string): Promise<OrganizationWithCounts> {
    const response = await api.get<OrganizationWithCounts>(`/organizations/${id}`);
    return response.data;
  },

  async create(data: CreateOrganizationData): Promise<Organization> {
    const response = await api.post<Organization>('/organizations', data);
    return response.data;
  },

  async update(id: string, data: UpdateOrganizationData): Promise<Organization> {
    const response = await api.patch<Organization>(`/organizations/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/organizations/${id}`);
  },
};
