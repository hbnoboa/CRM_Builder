import api from '@/lib/api';

// ================= TYPES =================

export interface PdfMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PdfHeader {
  logo?: {
    url: string;
    width?: number;
    height?: number;
    position?: 'left' | 'center' | 'right';
  };
  title?: {
    text: string;
    fontSize?: number;
    bold?: boolean;
  };
  subtitle?: {
    text: string;
    binding?: string;
  };
  showOnAllPages?: boolean;
}

export interface PdfFooter {
  text?: string;
  showPageNumbers?: boolean;
  position?: 'left' | 'center' | 'right';
}

export interface TableColumn {
  field: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'percentage';
}

export type PdfElementType =
  | 'text'
  | 'field-group'
  | 'table'
  | 'image'
  | 'image-grid'
  | 'divider'
  | 'spacer'
  | 'statistics';

export interface BasePdfElement {
  id: string;
  type: PdfElementType;
  marginTop?: number;
  marginBottom?: number;
}

export interface TextElement extends BasePdfElement {
  type: 'text';
  content: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export interface FieldGroupElement extends BasePdfElement {
  type: 'field-group';
  title?: string;
  layout: 'horizontal' | 'vertical' | 'grid';
  columns?: number;
  fields: {
    label: string;
    binding: string;
    format?: string;
    labelBold?: boolean;
  }[];
}

export interface TableElement extends BasePdfElement {
  type: 'table';
  title?: string;
  dataSource?: string;
  columns: TableColumn[];
  showHeader?: boolean;
  headerStyle?: {
    bold?: boolean;
    fontSize?: number;
    bgColor?: string;
  };
  cellStyle?: {
    fontSize?: number;
  };
  emptyMessage?: string;
}

export interface ImageGridElement extends BasePdfElement {
  type: 'image-grid';
  title?: string;
  columns: number;
  dataSource: string;
  imageWidth?: number;
  imageHeight?: number;
  showCaptions?: boolean;
  captionFields?: string[];
}

export interface DividerElement extends BasePdfElement {
  type: 'divider';
  color?: string;
  thickness?: number;
}

export interface SpacerElement extends BasePdfElement {
  type: 'spacer';
  height: number;
}

export interface StatisticsElement extends BasePdfElement {
  type: 'statistics';
  title: string;
  groupBy: string[];
  metrics: {
    field: string;
    aggregation: 'count' | 'sum' | 'avg' | 'percentage';
    label: string;
  }[];
}

export type PdfElement =
  | TextElement
  | FieldGroupElement
  | TableElement
  | ImageGridElement
  | DividerElement
  | SpacerElement
  | StatisticsElement;

export interface PdfTemplateContent {
  header?: PdfHeader;
  body: PdfElement[];
  footer?: PdfFooter;
}

export interface PdfTemplate {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  pageSize: 'A4' | 'LETTER' | 'LEGAL';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  margins: PdfMargins;
  content: PdfTemplateContent;
  sourceEntityId?: string;
  sourceEntity?: {
    id: string;
    name: string;
    slug: string;
    fields?: Array<{ slug: string; name: string; label?: string; type: string; subEntityId?: string; subEntitySlug?: string }>;
  };
  subEntities?: Record<string, {
    id: string;
    name: string;
    slug: string;
    fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
  }>;
  selectedFields: string[];
  logoUrl?: string;
  templateType: 'single' | 'batch';
  isPublished: boolean;
  publishedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    generations: number;
  };
}

export interface PdfGeneration {
  id: string;
  tenantId: string;
  templateId: string;
  template?: {
    id: string;
    name: string;
    slug: string;
  };
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  recordIds: string[];
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  pageCount?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  requestedById?: string;
  requestedBy?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  completedAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    nextCursor: string | null;
  };
}

export interface QueryPdfTemplateParams {
  search?: string;
  sourceEntityId?: string;
  templateType?: 'single' | 'batch';
  isPublished?: boolean;
  limit?: number;
  cursor?: string;
}

export interface CreatePdfTemplateData {
  tenantId?: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  pageSize?: 'A4' | 'LETTER' | 'LEGAL';
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  margins?: PdfMargins;
  content?: PdfTemplateContent;
  sourceEntityId?: string;
  selectedFields?: string[];
  logoUrl?: string;
  templateType?: 'single' | 'batch';
}

export interface UpdatePdfTemplateData extends Partial<CreatePdfTemplateData> {}

// ================= SERVICE =================

export const pdfTemplatesService = {
  // Templates CRUD
  async getAll(params?: QueryPdfTemplateParams): Promise<PaginatedResponse<PdfTemplate>> {
    const response = await api.get('/pdf-templates', { params });
    return response.data;
  },

  async getById(id: string): Promise<PdfTemplate> {
    const response = await api.get(`/pdf-templates/${id}`);
    return response.data;
  },

  async getBySlug(slug: string): Promise<PdfTemplate> {
    const response = await api.get(`/pdf-templates/slug/${slug}`);
    return response.data;
  },

  async create(data: CreatePdfTemplateData): Promise<PdfTemplate> {
    const response = await api.post('/pdf-templates', data);
    return response.data;
  },

  async update(id: string, data: UpdatePdfTemplateData): Promise<PdfTemplate> {
    const response = await api.patch(`/pdf-templates/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/pdf-templates/${id}`);
  },

  async duplicate(id: string): Promise<PdfTemplate> {
    const response = await api.post(`/pdf-templates/${id}/duplicate`);
    return response.data;
  },

  async publish(id: string): Promise<PdfTemplate> {
    const response = await api.post(`/pdf-templates/${id}/publish`);
    return response.data;
  },

  async unpublish(id: string): Promise<PdfTemplate> {
    const response = await api.post(`/pdf-templates/${id}/unpublish`);
    return response.data;
  },

  // PDF Generation
  async generateSingle(
    templateId: string,
    recordId: string,
    overrideData?: Record<string, unknown>,
  ): Promise<Blob> {
    const response = await api.post(
      `/pdf-templates/${templateId}/generate`,
      { recordId, overrideData },
      { responseType: 'blob' },
    );
    return response.data;
  },

  async generateBatch(
    templateId: string,
    recordIds: string[],
    mergePdfs?: boolean,
  ): Promise<PdfGeneration> {
    const response = await api.post(`/pdf-templates/${templateId}/generate-batch`, {
      recordIds,
      mergePdfs,
    });
    return response.data;
  },

  async preview(
    templateId: string,
    sampleData?: Record<string, unknown>,
    recordId?: string,
  ): Promise<Blob> {
    const response = await api.post(
      `/pdf-templates/${templateId}/preview`,
      { sampleData, recordId },
      { responseType: 'blob' },
    );
    return response.data;
  },

  // Generations history
  async getGenerations(params?: {
    templateId?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResponse<PdfGeneration>> {
    const response = await api.get('/pdf-templates/generations', { params });
    return response.data;
  },

  async getGeneration(id: string): Promise<PdfGeneration> {
    const response = await api.get(`/pdf-templates/generations/${id}`);
    return response.data;
  },

  async downloadGeneration(id: string): Promise<void> {
    // Redireciona para URL de download
    window.location.href = `${api.defaults.baseURL}/pdf-templates/generations/${id}/download`;
  },
};
