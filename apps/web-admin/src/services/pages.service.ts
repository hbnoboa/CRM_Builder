import api from '@/lib/api';

export interface Page {
  id: string;
  tenantId: string;
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
  async getAll(): Promise<Page[]> {
    const response = await api.get<Page[]>('/pages');
    return response.data;
  },

  async getBySlug(slug: string): Promise<Page> {
    const response = await api.get<Page>(`/pages/slug/${slug}`);
    return response.data;
  },

  async getById(id: string): Promise<Page> {
    const response = await api.get<Page>(`/pages/${id}`);
    return response.data;
  },

  async create(data: CreatePageData): Promise<Page> {
    const response = await api.post<Page>('/pages', data);
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
