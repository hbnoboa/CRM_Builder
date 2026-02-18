import api from '@/lib/api';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type ReportVisibility = 'PRIVATE' | 'TEAM' | 'ORGANIZATION' | 'PUBLIC';
export type TenantScope = 'CURRENT' | 'ALL' | 'SELECTED';
export type ComponentType =
  | 'bar-chart'
  | 'line-chart'
  | 'area-chart'
  | 'pie-chart'
  | 'stats-card'
  | 'kpi'
  | 'table'
  | 'trend'
  | 'gauge';
export type ComponentWidth = 'full' | 'half' | 'third';
export type Aggregation = 'sum' | 'count' | 'avg' | 'min' | 'max';

export interface DateRange {
  field?: string;
  preset: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface Filter {
  fieldSlug: string;
  operator: string;
  value?: string;
  value2?: string;
}

export interface DataSource {
  entity: string;
  filters?: Filter[];
  dateRange?: DateRange;
}

export interface ChartConfig {
  measure?: string;
  aggregation?: Aggregation;
  dimension?: string;
  colors?: string[];
  showLegend?: boolean;
  stacked?: boolean;
  compareWithPrevious?: boolean;
  columns?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  target?: number;
  icon?: string;
  format?: string;
}

export interface ReportComponent {
  id: string;
  type: ComponentType;
  order: number;
  width: ComponentWidth;
  title: string;
  description?: string;
  dataSource: DataSource;
  config: ChartConfig;
}

export interface LayoutConfig {
  columns?: number;
  gaps?: number;
}

export interface SharedWith {
  canView?: string[];
  canEdit?: string[];
}

export interface Report {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  components: ReportComponent[];
  layoutConfig?: LayoutConfig;
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  visibility: ReportVisibility;
  sharedWith?: SharedWith;
  tenantScope: TenantScope;
  selectedTenants: string[];
  showInDashboard: boolean;
  dashboardOrder: number;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CreateReportData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  components?: ReportComponent[];
  layoutConfig?: LayoutConfig;
  visibility?: ReportVisibility;
  sharedWith?: SharedWith;
  tenantScope?: TenantScope;
  selectedTenants?: string[];
  showInDashboard?: boolean;
  dashboardOrder?: number;
}

export interface UpdateReportData extends Partial<CreateReportData> {}

export interface QueryReportsParams {
  page?: number;
  limit?: number;
  search?: string;
  visibility?: ReportVisibility;
  createdById?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ExecuteReportParams {
  tenantId?: string;
  overrideFilters?: Record<string, Filter[]>;
  overrideDateRange?: DateRange;
}

export interface ReportExecuteResult {
  report: {
    id: string;
    name: string;
    description?: string;
    layoutConfig?: LayoutConfig;
  };
  components: Array<{
    id: string;
    type: ComponentType;
    title: string;
    data: unknown;
    error?: string;
  }>;
  generatedAt: string;
  tenantScope: TenantScope;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════════

export const reportsService = {
  // CRUD
  async getAll(params?: QueryReportsParams): Promise<PaginatedResponse<Report>> {
    const response = await api.get<PaginatedResponse<Report>>('/reports', { params });
    return response.data;
  },

  async getMyReports(params?: QueryReportsParams): Promise<PaginatedResponse<Report>> {
    const response = await api.get<PaginatedResponse<Report>>('/reports/my', { params });
    return response.data;
  },

  async getDashboardReports(): Promise<Report[]> {
    const response = await api.get<Report[]>('/reports/dashboard');
    return response.data;
  },

  async getById(id: string): Promise<Report> {
    const response = await api.get<Report>(`/reports/${id}`);
    return response.data;
  },

  async create(data: CreateReportData): Promise<Report> {
    const response = await api.post<Report>('/reports', data);
    return response.data;
  },

  async update(id: string, data: UpdateReportData): Promise<Report> {
    const response = await api.patch<Report>(`/reports/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/reports/${id}`);
  },

  async duplicate(id: string): Promise<Report> {
    const response = await api.post<Report>(`/reports/${id}/duplicate`);
    return response.data;
  },

  // Execute & Export
  async execute(id: string, params?: ExecuteReportParams): Promise<ReportExecuteResult> {
    const response = await api.post<ReportExecuteResult>(`/reports/${id}/execute`, params || {});
    return response.data;
  },

  async export(id: string, format: 'csv' | 'xlsx' | 'pdf'): Promise<Blob> {
    const response = await api.get(`/reports/${id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  // Analytics
  async getTenantAnalytics(): Promise<unknown[]> {
    const response = await api.get('/reports/analytics/tenants');
    return response.data;
  },

  async getEntityDistribution(tenantId?: string): Promise<unknown[]> {
    const response = await api.get('/reports/analytics/entities', {
      params: tenantId ? { tenantId } : undefined,
    });
    return response.data;
  },

  async getRecordsOverTime(tenantId?: string, days?: number): Promise<unknown[]> {
    const response = await api.get('/reports/analytics/records-over-time', {
      params: { tenantId, days },
    });
    return response.data;
  },

  async refreshAnalytics(): Promise<{ refreshed: boolean; at: string }> {
    const response = await api.post('/reports/analytics/refresh');
    return response.data;
  },
};
