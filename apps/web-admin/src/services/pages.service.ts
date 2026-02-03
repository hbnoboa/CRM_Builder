import api from '@/lib/api';

export interface Page {
  id: string;
  organizationId: string;
  title: string;
  slug: string;
  content: Record<string, unknown>;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePageData {
  title: string;
  slug: string;
  content?: Record<string, unknown>;
  isPublished?: boolean;
}

export interface UpdatePageData {
  title?: string;
  slug?: string;
  content?: Record<string, unknown>;
  isPublished?: boolean;
}

export const pagesService = {
  async getAll(organizationId: string): Promise<Page[]> {
    const response = await api.get<Page[]>(`/organizations/${organizationId}/pages`);
    return response.data;
  },

  async getBySlug(organizationId: string, slug: string): Promise<Page> {
    const response = await api.get<Page>(`/organizations/${organizationId}/pages/${slug}`);
    return response.data;
  },

  async getById(id: string): Promise<Page> {
    const response = await api.get<Page>(`/pages/${id}`);
    return response.data;
  },

  async create(organizationId: string, data: CreatePageData): Promise<Page> {
    const response = await api.post<Page>(`/organizations/${organizationId}/pages`, data);
    return response.data;
  },

  async update(id: string, data: UpdatePageData): Promise<Page> {
    const response = await api.patch<Page>(`/pages/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/pages/${id}`);
  },

  async publish(id: string): Promise<Page> {
    const response = await api.patch<Page>(`/pages/${id}/publish`);
    return response.data;
  },

  async unpublish(id: string): Promise<Page> {
    const response = await api.patch<Page>(`/pages/${id}/unpublish`);
    return response.data;
  },
};
