import api from '@/lib/api';

export interface PublicLink {
  id: string;
  tenantId: string;
  slug: string;
  entitySlug: string;
  entityId: string;
  customRoleId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  expiresAt?: string | null;
  maxUsers?: number | null;
  registrationCount: number;
  settings: Record<string, unknown>;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  entity?: { name: string; slug: string };
  customRole?: { id: string; name: string; roleType?: string };
}

export interface CreatePublicLinkPayload {
  name: string;
  entitySlug: string;
  customRoleId?: string;
  description?: string;
  expiresAt?: string;
  maxUsers?: number;
}

export interface UpdatePublicLinkPayload {
  name?: string;
  entitySlug?: string;
  customRoleId?: string;
  description?: string;
  isActive?: boolean;
  expiresAt?: string | null;
  maxUsers?: number | null;
}

export const publicLinkService = {
  findAll: async (params?: { page?: number; limit?: number; search?: string; entitySlug?: string }) => {
    const { data } = await api.get('/public-links', { params });
    return data;
  },

  findOne: async (id: string) => {
    const { data } = await api.get(`/public-links/${id}`);
    return data;
  },

  create: async (payload: CreatePublicLinkPayload) => {
    const { data } = await api.post('/public-links', payload);
    return data;
  },

  update: async (id: string, payload: UpdatePublicLinkPayload) => {
    const { data } = await api.patch(`/public-links/${id}`, payload);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await api.delete(`/public-links/${id}`);
    return data;
  },
};
