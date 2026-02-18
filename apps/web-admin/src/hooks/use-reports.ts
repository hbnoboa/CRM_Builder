import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  reportsService,
  CreateReportData,
  UpdateReportData,
  QueryReportsParams,
  ExecuteReportParams,
} from '@/services/reports.service';
import { getErrorMessage } from '@/lib/get-error-message';

// ═══════════════════════════════════════════════════════════════════════════
// Query Keys
// ═══════════════════════════════════════════════════════════════════════════

export const reportKeys = {
  all: ['reports'] as const,
  lists: () => [...reportKeys.all, 'list'] as const,
  list: (params?: QueryReportsParams) => [...reportKeys.lists(), params] as const,
  myReports: (params?: QueryReportsParams) => [...reportKeys.all, 'my', params] as const,
  dashboard: () => [...reportKeys.all, 'dashboard'] as const,
  details: () => [...reportKeys.all, 'detail'] as const,
  detail: (id: string) => [...reportKeys.details(), id] as const,
  execute: (id: string, params?: ExecuteReportParams) => [...reportKeys.detail(id), 'execute', params] as const,
  analytics: () => [...reportKeys.all, 'analytics'] as const,
  tenantAnalytics: () => [...reportKeys.analytics(), 'tenants'] as const,
  entityDistribution: (tenantId?: string) => [...reportKeys.analytics(), 'entities', tenantId] as const,
  recordsOverTime: (tenantId?: string, days?: number) => [...reportKeys.analytics(), 'records', tenantId, days] as const,
};

// ═══════════════════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════════════════

export function useReports(params?: QueryReportsParams) {
  return useQuery({
    queryKey: reportKeys.list(params),
    queryFn: () => reportsService.getAll(params),
  });
}

export function useMyReports(params?: QueryReportsParams) {
  return useQuery({
    queryKey: reportKeys.myReports(params),
    queryFn: () => reportsService.getMyReports(params),
  });
}

export function useDashboardReports() {
  return useQuery({
    queryKey: reportKeys.dashboard(),
    queryFn: () => reportsService.getDashboardReports(),
    staleTime: 60000, // 1 minuto
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: reportKeys.detail(id),
    queryFn: () => reportsService.getById(id),
    enabled: !!id,
  });
}

export function useReportExecution(id: string, params?: ExecuteReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.execute(id, params),
    queryFn: () => reportsService.execute(id, params),
    enabled: !!id && enabled,
    staleTime: 30000, // 30 segundos
  });
}

// Analytics
export function useTenantAnalytics() {
  return useQuery({
    queryKey: reportKeys.tenantAnalytics(),
    queryFn: () => reportsService.getTenantAnalytics(),
    staleTime: 300000, // 5 minutos
  });
}

export function useEntityDistribution(tenantId?: string) {
  return useQuery({
    queryKey: reportKeys.entityDistribution(tenantId),
    queryFn: () => reportsService.getEntityDistribution(tenantId),
    staleTime: 300000,
  });
}

export function useRecordsOverTime(tenantId?: string, days?: number) {
  return useQuery({
    queryKey: reportKeys.recordsOverTime(tenantId, days),
    queryFn: () => reportsService.getRecordsOverTime(tenantId, days),
    staleTime: 300000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════════════════════════════════

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useCreateReport(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReportData) => reportsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.lists() });
      queryClient.invalidateQueries({ queryKey: reportKeys.dashboard() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useUpdateReport(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReportData }) =>
      reportsService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: reportKeys.lists() });
      queryClient.invalidateQueries({ queryKey: reportKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: reportKeys.dashboard() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useDeleteReport(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reportsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.lists() });
      queryClient.invalidateQueries({ queryKey: reportKeys.dashboard() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useDuplicateReport(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reportsService.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: ({ id, format }: { id: string; format: 'csv' | 'xlsx' | 'pdf' }) =>
      reportsService.export(id, format),
    onSuccess: (blob, { format }) => {
      // Download o arquivo
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Relatorio exportado com sucesso');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Erro ao exportar relatorio'));
    },
  });
}

export function useRefreshAnalytics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => reportsService.refreshAnalytics(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.analytics() });
      toast.success('Analytics atualizados');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Erro ao atualizar analytics'));
    },
  });
}
