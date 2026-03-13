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
  CrossFieldDistribution,
  FieldRatioResult,
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

  async getMyTemplates(entitySlug: string): Promise<{ id: string; name: string; description?: string; priority: number }[]> {
    const response = await api.get(`/dashboard-templates/my/${entitySlug}/all`);
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

  async fieldRatio(
    entitySlug: string,
    numeratorField: string,
    denominatorField: string,
    options?: { aggregation?: string; comparePeriod?: boolean; days?: number; denominatorEntitySlug?: string } & DashboardFilterParams,
  ): Promise<FieldRatioResult> {
    const response = await api.get(`/stats/entity/${entitySlug}/field-ratio`, {
      params: {
        numeratorField,
        denominatorField,
        denominatorEntitySlug: options?.denominatorEntitySlug,
        aggregation: options?.aggregation,
        comparePeriod: options?.comparePeriod ? 'previous' : undefined,
        days: options?.days,
        filters: options?.filters,
        dateStart: options?.dateStart,
        dateEnd: options?.dateEnd,
      },
    });
    return response.data;
  },

  async distinctCount(
    entitySlug: string,
    fields: string[],
    options?: { comparePeriod?: boolean; days?: number; filterField?: string; filterValue?: string } & DashboardFilterParams,
  ): Promise<EntityRecordCount & { totalDistinct?: number; filteredDistinct?: number }> {
    const response = await api.get(`/stats/entity/${entitySlug}/distinct-count`, {
      params: {
        fields: fields.join(','),
        comparePeriod: options?.comparePeriod ? 'previous' : undefined,
        days: options?.days,
        filterField: options?.filterField,
        filterValue: options?.filterValue,
        filters: options?.filters,
        dateStart: options?.dateStart,
        dateEnd: options?.dateEnd,
      },
    });
    return response.data;
  },

  async groupedData(
    entitySlug: string,
    groupBy: string[],
    options?: {
      aggregations?: Array<{ type: string; fieldSlug?: string; alias: string; distinctFields?: string[] }>;
      crossEntityCount?: { entitySlug: string; matchFields?: Array<{ source: string; target: string }>; matchBy?: 'fields' | 'children'; alias: string };
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    } & DashboardFilterParams,
  ): Promise<Array<Record<string, unknown>>> {
    const response = await api.get(`/stats/entity/${entitySlug}/grouped-data`, {
      params: {
        groupBy: groupBy.join(','),
        aggregations: options?.aggregations ? JSON.stringify(options.aggregations) : undefined,
        crossEntityCount: options?.crossEntityCount ? JSON.stringify(options.crossEntityCount) : undefined,
        limit: options?.limit,
        sortBy: options?.sortBy,
        sortOrder: options?.sortOrder,
        filters: options?.filters,
        dateStart: options?.dateStart,
        dateEnd: options?.dateEnd,
      },
    });
    return response.data;
  },

  async crossFieldDistribution(
    entitySlug: string,
    rowField: string,
    columnField: string,
    options?: { limit?: number } & DashboardFilterParams,
  ): Promise<CrossFieldDistribution> {
    const response = await api.get(`/stats/entity/${entitySlug}/cross-field-distribution`, {
      params: {
        rowField,
        columnField,
        limit: options?.limit,
        filters: options?.filters,
        dateStart: options?.dateStart,
        dateEnd: options?.dateEnd,
      },
    });
    return response.data;
  },
};
