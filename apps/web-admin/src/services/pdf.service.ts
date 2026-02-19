import api from '@/lib/api';
import { PdfTemplate, PdfGeneration, PaginatedResponse } from '@/types';

export interface CreatePdfTemplateData {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  category?: string;
  entitySlug?: string;
  basePdf?: Record<string, unknown>;
  schemas?: Record<string, unknown>[];
  settings?: Record<string, unknown>;
  isPublished?: boolean;
}

export interface UpdatePdfTemplateData {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  category?: string;
  entitySlug?: string;
  basePdf?: Record<string, unknown>;
  schemas?: Record<string, unknown>[];
  settings?: Record<string, unknown>;
  isPublished?: boolean;
}

export interface QueryPdfTemplatesParams {
  page?: number;
  limit?: number;
  search?: string;
  entitySlug?: string;
  category?: string;
  isPublished?: boolean;
  includeGlobal?: boolean;
}

export interface GeneratePdfData {
  templateId: string;
  recordId?: string;
  inputData?: Record<string, unknown>;
}

export interface GenerateBatchPdfData {
  templateId: string;
  recordIds: string[];
}

export interface GenerationResponse {
  generationId: string;
  status: string;
  template: {
    id: string;
    name: string;
    slug: string;
  };
  message: string;
}

export interface BatchGenerationResponse {
  total: number;
  generationIds: string[];
  message: string;
}

export const pdfService = {
  // Templates
  async getTemplates(params?: QueryPdfTemplatesParams): Promise<PaginatedResponse<PdfTemplate>> {
    const response = await api.get<PaginatedResponse<PdfTemplate>>('/pdf/templates', { params });
    return response.data;
  },

  async getTemplateById(id: string): Promise<PdfTemplate> {
    const response = await api.get<PdfTemplate>(`/pdf/templates/${id}`);
    return response.data;
  },

  async getTemplateBySlug(slug: string): Promise<PdfTemplate> {
    const response = await api.get<PdfTemplate>(`/pdf/templates/slug/${slug}`);
    return response.data;
  },

  async getTemplatesByEntity(entitySlug: string): Promise<PdfTemplate[]> {
    const response = await api.get<PdfTemplate[]>(`/pdf/templates/entity/${entitySlug}`);
    return response.data;
  },

  async createTemplate(data: CreatePdfTemplateData): Promise<PdfTemplate> {
    const response = await api.post<PdfTemplate>('/pdf/templates', data);
    return response.data;
  },

  async updateTemplate(id: string, data: UpdatePdfTemplateData): Promise<PdfTemplate> {
    const response = await api.patch<PdfTemplate>(`/pdf/templates/${id}`, data);
    return response.data;
  },

  async publishTemplate(id: string): Promise<PdfTemplate> {
    const response = await api.patch<PdfTemplate>(`/pdf/templates/${id}/publish`);
    return response.data;
  },

  async unpublishTemplate(id: string): Promise<PdfTemplate> {
    const response = await api.patch<PdfTemplate>(`/pdf/templates/${id}/unpublish`);
    return response.data;
  },

  async duplicateTemplate(id: string): Promise<PdfTemplate> {
    const response = await api.post<PdfTemplate>(`/pdf/templates/${id}/duplicate`);
    return response.data;
  },

  async deleteTemplate(id: string): Promise<void> {
    await api.delete(`/pdf/templates/${id}`);
  },

  // Generation
  async generate(data: GeneratePdfData): Promise<GenerationResponse> {
    const response = await api.post<GenerationResponse>('/pdf/generate', data);
    return response.data;
  },

  async generateBatch(data: GenerateBatchPdfData): Promise<BatchGenerationResponse> {
    const response = await api.post<BatchGenerationResponse>('/pdf/generate-batch', data);
    return response.data;
  },

  async generateSync(data: GeneratePdfData): Promise<PdfGeneration> {
    const response = await api.post<PdfGeneration>('/pdf/generate-sync', data);
    return response.data;
  },

  async getGenerationStatus(id: string): Promise<PdfGeneration> {
    const response = await api.get<PdfGeneration>(`/pdf/generation/${id}`);
    return response.data;
  },

  async getGenerations(params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<PdfGeneration>> {
    const response = await api.get<PaginatedResponse<PdfGeneration>>('/pdf/generations', { params });
    return response.data;
  },

  async getDownloadInfo(id: string): Promise<{ downloadUrl: string; fileName: string; fileSize?: number }> {
    const response = await api.get<{ downloadUrl: string; fileName: string; fileSize?: number }>(`/pdf/generation/${id}/download`);
    return response.data;
  },
};
