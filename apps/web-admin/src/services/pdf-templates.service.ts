import api from '@/lib/api';

// ================= TYPES =================

export type FieldFormat =
  | 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time' | 'percentage'
  | 'cpf' | 'cnpj' | 'cep' | 'phone' | 'boolean'
  | 'uppercase' | 'lowercase' | 'titlecase';

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
  format?: FieldFormat;
  defaultValue?: string;
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

export interface VisibilityCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'not_empty' | 'has_items' | 'no_items';
  value?: string;
}

export interface BasePdfElement {
  id: string;
  type: PdfElementType;
  marginTop?: number;
  marginBottom?: number;
  visibility?: VisibilityCondition;
  repeatPerRecord?: boolean;
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
  labelFontSize?: number;
  valueFontSize?: number;
  lineSpacing?: number;
  fields: {
    label: string;
    binding: string;
    format?: FieldFormat;
    labelBold?: boolean;
    defaultValue?: string;
  }[];
}

export interface TableRowFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'not_empty' | 'has_items' | 'no_items';
  value: string;
}

export interface TableSortRule {
  field: string;
  direction: 'asc' | 'desc';
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
  filters?: TableRowFilter[];
  filterLogic?: 'and' | 'or';
  sorting?: TableSortRule[];
}

export interface ImageGridElement extends BasePdfElement {
  type: 'image-grid';
  title?: string;
  columns: number;
  dataSource: string;
  imageWidth?: number;
  imageHeight?: number;
  cellHeight?: number;
  showCaptions?: boolean;
  captionFields?: string[];
  captionFontSize?: number;
  captionDataFields?: string[];
  imageFields?: string[];
  parentImageFields?: string[];
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
  columnWidths?: number[];
  rowHeight?: number;
  headerFill?: string | null;
  metrics: {
    field: string;
    aggregation: 'count' | 'sum' | 'avg' | 'percentage' | 'min' | 'max';
    label: string;
    percentageFilter?: {
      field: string;
      operator: string;
      value: string;
    };
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

// =============== Computed Fields ===============

export interface ArithmeticConfig {
  operands: Array<{ type: 'field' | 'number'; value: string }>;
  operators: Array<'+' | '-' | '*' | '/'>;
}

export interface ConditionalConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'not_empty' | 'has_items' | 'no_items';
  compareValue: string;
  trueResult: { type: 'text' | 'field'; value: string };
  falseResult: { type: 'text' | 'field'; value: string };
}

export interface FilteredCountFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'contains' | 'not_empty' | 'has_items' | 'no_items';
  value: string;
}

export interface FilteredCountConfig {
  filters: FilteredCountFilter[];
}

export interface ConcatConfig {
  parts: Array<{ type: 'field' | 'text'; value: string }>;
  separator: string;
}

export interface MapConfig {
  field: string;
  mappings: Array<{ from: string; to: string }>;
  defaultMapping?: string;
}

export interface SubEntityAggregateConfig {
  subEntityField: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field?: string;
  filters?: FilteredCountFilter[];
}

export type ComputedFieldType = 'arithmetic' | 'conditional' | 'filtered-count' | 'concat' | 'map' | 'sub-entity-aggregate';

export interface ComputedField {
  id: string;
  slug: string;
  label: string;
  type: ComputedFieldType;
  config: ArithmeticConfig | ConditionalConfig | FilteredCountConfig | ConcatConfig | MapConfig | SubEntityAggregateConfig;
}

export interface PdfTemplateSettings {
  emptyFieldDefault?: string;
}

export interface PdfTemplateContent {
  header?: PdfHeader;
  body: PdfElement[];
  footer?: PdfFooter;
  computedFields?: ComputedField[];
  settings?: PdfTemplateSettings;
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
    options: {
      recordIds?: string[];
      useAllRecords?: boolean;
      filters?: string;
      search?: string;
      mergePdfs?: boolean;
    },
  ): Promise<Blob> {
    const response = await api.post(
      `/pdf-templates/${templateId}/generate-batch`,
      options,
      { responseType: 'blob', timeout: 600000 },
    );
    return response.data;
  },

  async preview(
    templateId: string,
    sampleData?: Record<string, unknown>,
    recordId?: string,
    content?: PdfTemplateContent,
  ): Promise<Blob> {
    const response = await api.post(
      `/pdf-templates/${templateId}/preview`,
      { sampleData, recordId, content },
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
