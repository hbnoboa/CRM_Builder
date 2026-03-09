import api from '@/lib/api';
import type {
  DashboardTemplate,
  CreateDashboardTemplateData,
  UpdateDashboardTemplateData,
  EntityRecordCount,
  TimeSeriesPoint,
  FieldDistributionItem,
  FieldAggregation,
  FieldTrendPoint,
  RecentActivityItem,
  TopRecord,
  FunnelStage,
} from '@crm-builder/shared';

// ═══════════════════════════════════════════════════════════════════════
// Dashboard Templates CRUD
// ═══════════════════════════════════════════════════════════════════════

export const dashboardTemplatesService = {
  async getAll(): Promise<DashboardTemplate[]> {
    const response = await api.get('/dashboard-templates');
    return response.data;
  },

  async getById(id: string): Promise<DashboardTemplate> {
    const response = await api.get(`/dashboard-templates/${id}`);
    return response.data;
  },

  async getMyTemplate(entitySlug: string): Promise<DashboardTemplate | null> {
    const response = await api.get(`/dashboard-templates/my/${entitySlug}`);
    return response.data;
  },

  async create(data: CreateDashboardTemplateData): Promise<DashboardTemplate> {
    const response = await api.post('/dashboard-templates', data);
    return response.data;
  },

  async update(id: string, data: UpdateDashboardTemplateData): Promise<DashboardTemplate> {
    const response = await api.patch(`/dashboard-templates/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/dashboard-templates/${id}`);
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Dashboard Filter Params
// ═══════════════════════════════════════════════════════════════════════

interface DashboardFilterParams {
  filters?: string;
  dateStart?: string;
  dateEnd?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Entity Stats
// ═══════════════════════════════════════════════════════════════════════

export const entityStatsService = {
  async recordCount(
    entitySlug: string,
    options?: { comparePeriod?: boolean; days?: number } & DashboardFilterParams,
  ): Promise<EntityRecordCount> {
    const response = await api.get(`/stats/entity/${entitySlug}/record-count`, {
      params: {
        comparePeriod: options?.comparePeriod ? 'previous' : undefined,
        days: options?.days,
        filters: options?.filters,
        dateStart: options?.dateStart,
        dateEnd: options?.dateEnd,
      },
    });
    return response.data;
  },

  async recordsOverTime(
    entitySlug: string,
    days?: number,
    dashFilters?: DashboardFilterParams,
  ): Promise<TimeSeriesPoint[]> {
    const response = await api.get(`/stats/entity/${entitySlug}/records-over-time`, {
      params: { days, ...dashFilters },
    });
    return response.data;
  },

  async fieldDistribution(
    entitySlug: string,
    fieldSlug: string,
    limit?: number,
    dashFilters?: DashboardFilterParams,
  ): Promise<FieldDistributionItem[]> {
    const response = await api.get(`/stats/entity/${entitySlug}/field-distribution`, {
      params: { fieldSlug, limit, ...dashFilters },
    });
    return response.data;
  },

  async fieldAggregation(
    entitySlug: string,
    fieldSlug: string,
    aggregation?: string,
    options?: { comparePeriod?: boolean; days?: number } & DashboardFilterParams,
  ): Promise<FieldAggregation> {
    const response = await api.get(`/stats/entity/${entitySlug}/field-aggregation`, {
      params: {
        fieldSlug,
        aggregation,
        comparePeriod: options?.comparePeriod ? 'previous' : undefined,
        days: options?.days,
        filters: options?.filters,
        dateStart: options?.dateStart,
        dateEnd: options?.dateEnd,
      },
    });
    return response.data;
  },

  async fieldTrend(
    entitySlug: string,
    fieldSlug: string,
    aggregation?: string,
    days?: number,
    dashFilters?: DashboardFilterParams,
  ): Promise<FieldTrendPoint[]> {
    const response = await api.get(`/stats/entity/${entitySlug}/field-trend`, {
      params: { fieldSlug, aggregation, days, ...dashFilters },
    });
    return response.data;
  },

  async recentActivity(
    entitySlug: string,
    limit?: number,
    dashFilters?: DashboardFilterParams,
  ): Promise<RecentActivityItem[]> {
    const response = await api.get(`/stats/entity/${entitySlug}/recent-activity`, {
      params: { limit, ...dashFilters },
    });
    return response.data;
  },

  async topRecords(
    entitySlug: string,
    options?: { limit?: number; sortBy?: string; sortOrder?: string; fields?: string[] } & DashboardFilterParams,
  ): Promise<TopRecord[]> {
    const response = await api.get(`/stats/entity/${entitySlug}/top-records`, {
      params: {
        limit: options?.limit,
        sortBy: options?.sortBy,
        sortOrder: options?.sortOrder,
        fields: options?.fields?.join(','),
        filters: options?.filters,
        dateStart: options?.dateStart,
        dateEnd: options?.dateEnd,
      },
    });
    return response.data;
  },

  async funnel(
    entitySlug: string,
    fieldSlug: string,
    stages?: string[],
    dashFilters?: DashboardFilterParams,
  ): Promise<FunnelStage[]> {
    const response = await api.get(`/stats/entity/${entitySlug}/funnel`, {
      params: {
        fieldSlug,
        stages: stages?.join(','),
        ...dashFilters,
      },
    });
    return response.data;
  },
};
