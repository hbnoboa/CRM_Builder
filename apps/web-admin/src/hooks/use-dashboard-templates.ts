'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  dashboardTemplatesService,
  entityStatsService,
} from '@/services/dashboard-templates.service';
import type {
  CreateDashboardTemplateData,
  UpdateDashboardTemplateData,
} from '@crm-builder/shared';
import { getErrorMessage } from '@/lib/get-error-message';

// ═══════════════════════════════════════════════════════════════════════
// Dashboard Filter Params (passed to API)
// ═══════════════════════════════════════════════════════════════════════

export interface DashboardFilterParams {
  filters?: string;
  dateStart?: string;
  dateEnd?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Query Keys
// ═══════════════════════════════════════════════════════════════════════

export const dashboardTemplateKeys = {
  all: ['dashboard-templates'] as const,
  lists: () => [...dashboardTemplateKeys.all, 'list'] as const,
  details: () => [...dashboardTemplateKeys.all, 'detail'] as const,
  detail: (id: string) => [...dashboardTemplateKeys.details(), id] as const,
  my: (entitySlug: string) => [...dashboardTemplateKeys.all, 'my', entitySlug] as const,
};

export const entityStatsKeys = {
  all: ['entity-stats'] as const,
  recordCount: (slug: string, opts?: object) => [...entityStatsKeys.all, 'record-count', slug, opts] as const,
  recordsOverTime: (slug: string, days?: number, df?: object) => [...entityStatsKeys.all, 'records-over-time', slug, days, df] as const,
  fieldDistribution: (slug: string, fieldSlug: string, limit?: number, df?: object) => [...entityStatsKeys.all, 'field-distribution', slug, fieldSlug, limit, df] as const,
  fieldAggregation: (slug: string, fieldSlug: string, agg?: string, opts?: object) => [...entityStatsKeys.all, 'field-aggregation', slug, fieldSlug, agg, opts] as const,
  fieldTrend: (slug: string, fieldSlug: string, agg?: string, days?: number, df?: object) => [...entityStatsKeys.all, 'field-trend', slug, fieldSlug, agg, days, df] as const,
  recentActivity: (slug: string, limit?: number, df?: object) => [...entityStatsKeys.all, 'recent-activity', slug, limit, df] as const,
  topRecords: (slug: string, opts?: object) => [...entityStatsKeys.all, 'top-records', slug, opts] as const,
  funnel: (slug: string, fieldSlug: string, stages?: string[], df?: object) => [...entityStatsKeys.all, 'funnel', slug, fieldSlug, stages, df] as const,
};

// ═══════════════════════════════════════════════════════════════════════
// Dashboard Template Hooks
// ═══════════════════════════════════════════════════════════════════════

export function useDashboardTemplates() {
  return useQuery({
    queryKey: dashboardTemplateKeys.lists(),
    queryFn: () => dashboardTemplatesService.getAll(),
  });
}

export function useDashboardTemplate(id: string | undefined) {
  return useQuery({
    queryKey: dashboardTemplateKeys.detail(id || ''),
    queryFn: () => dashboardTemplatesService.getById(id!),
    enabled: !!id,
  });
}

export function useMyDashboardTemplate(entitySlug: string | undefined) {
  return useQuery({
    queryKey: dashboardTemplateKeys.my(entitySlug || ''),
    queryFn: () => dashboardTemplatesService.getMyTemplate(entitySlug!),
    enabled: !!entitySlug,
    staleTime: 30_000,
  });
}

export function useCreateDashboardTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDashboardTemplateData) => dashboardTemplatesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardTemplateKeys.lists() });
      toast.success('Template de dashboard criado!');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Erro ao criar template'));
    },
  });
}

export function useUpdateDashboardTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDashboardTemplateData }) =>
      dashboardTemplatesService.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: dashboardTemplateKeys.lists() });
      queryClient.setQueryData(dashboardTemplateKeys.detail(updated.id), updated);
      toast.success('Template atualizado!');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Erro ao atualizar template'));
    },
  });
}

export function useDeleteDashboardTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dashboardTemplatesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardTemplateKeys.lists() });
      toast.success('Template excluido!');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Erro ao excluir template'));
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Entity Stats Hooks (all accept dashboard filters)
// ═══════════════════════════════════════════════════════════════════════

export function useEntityRecordCount(
  entitySlug: string | undefined,
  options?: { comparePeriod?: boolean; days?: number } & DashboardFilterParams,
) {
  return useQuery({
    queryKey: entityStatsKeys.recordCount(entitySlug || '', options),
    queryFn: () => entityStatsService.recordCount(entitySlug!, options),
    enabled: !!entitySlug,
    staleTime: 30_000,
  });
}

export function useEntityRecordsOverTime(
  entitySlug: string | undefined,
  days?: number,
  dashFilters?: DashboardFilterParams,
) {
  return useQuery({
    queryKey: entityStatsKeys.recordsOverTime(entitySlug || '', days, dashFilters),
    queryFn: () => entityStatsService.recordsOverTime(entitySlug!, days, dashFilters),
    enabled: !!entitySlug,
    staleTime: 30_000,
  });
}

export function useFieldDistribution(
  entitySlug: string | undefined,
  fieldSlug: string | undefined,
  limit?: number,
  dashFilters?: DashboardFilterParams,
) {
  return useQuery({
    queryKey: entityStatsKeys.fieldDistribution(entitySlug || '', fieldSlug || '', limit, dashFilters),
    queryFn: () => entityStatsService.fieldDistribution(entitySlug!, fieldSlug!, limit, dashFilters),
    enabled: !!entitySlug && !!fieldSlug,
    staleTime: 30_000,
  });
}

export function useFieldAggregation(
  entitySlug: string | undefined,
  fieldSlug: string | undefined,
  aggregation?: string,
  options?: { comparePeriod?: boolean; days?: number } & DashboardFilterParams,
) {
  return useQuery({
    queryKey: entityStatsKeys.fieldAggregation(entitySlug || '', fieldSlug || '', aggregation, options),
    queryFn: () => entityStatsService.fieldAggregation(entitySlug!, fieldSlug!, aggregation, options),
    enabled: !!entitySlug && !!fieldSlug,
    staleTime: 30_000,
  });
}

export function useFieldTrend(
  entitySlug: string | undefined,
  fieldSlug: string | undefined,
  aggregation?: string,
  days?: number,
  dashFilters?: DashboardFilterParams,
) {
  return useQuery({
    queryKey: entityStatsKeys.fieldTrend(entitySlug || '', fieldSlug || '', aggregation, days, dashFilters),
    queryFn: () => entityStatsService.fieldTrend(entitySlug!, fieldSlug!, aggregation, days, dashFilters),
    enabled: !!entitySlug && !!fieldSlug,
    staleTime: 30_000,
  });
}

export function useEntityRecentActivity(
  entitySlug: string | undefined,
  limit?: number,
  dashFilters?: DashboardFilterParams,
) {
  return useQuery({
    queryKey: entityStatsKeys.recentActivity(entitySlug || '', limit, dashFilters),
    queryFn: () => entityStatsService.recentActivity(entitySlug!, limit, dashFilters),
    enabled: !!entitySlug,
    staleTime: 30_000,
  });
}

export function useEntityTopRecords(
  entitySlug: string | undefined,
  options?: { limit?: number; sortBy?: string; sortOrder?: string; fields?: string[] } & DashboardFilterParams,
) {
  return useQuery({
    queryKey: entityStatsKeys.topRecords(entitySlug || '', options),
    queryFn: () => entityStatsService.topRecords(entitySlug!, options),
    enabled: !!entitySlug,
    staleTime: 30_000,
  });
}

export function useEntityFunnel(
  entitySlug: string | undefined,
  fieldSlug: string | undefined,
  stages?: string[],
  dashFilters?: DashboardFilterParams,
) {
  return useQuery({
    queryKey: entityStatsKeys.funnel(entitySlug || '', fieldSlug || '', stages, dashFilters),
    queryFn: () => entityStatsService.funnel(entitySlug!, fieldSlug!, stages, dashFilters),
    enabled: !!entitySlug && !!fieldSlug,
    staleTime: 30_000,
  });
}
