import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  dataSourcesService,
  CreateDataSourceData,
  UpdateDataSourceData,
} from '@/services/data-sources.service';
import { getErrorMessage } from '@/lib/get-error-message';
import type { DataSourceDefinition } from '@crm-builder/shared';

export const dataSourceKeys = {
  all: ['data-sources'] as const,
  lists: () => [...dataSourceKeys.all, 'list'] as const,
  list: (search?: string) => [...dataSourceKeys.lists(), search] as const,
  details: () => [...dataSourceKeys.all, 'detail'] as const,
  detail: (id: string) => [...dataSourceKeys.details(), id] as const,
  related: (entitySlug: string) => [...dataSourceKeys.all, 'related', entitySlug] as const,
};

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useDataSources(search?: string) {
  return useQuery({
    queryKey: dataSourceKeys.list(search),
    queryFn: () => dataSourcesService.getAll(search),
  });
}

export function useDataSource(id: string) {
  return useQuery({
    queryKey: dataSourceKeys.detail(id),
    queryFn: () => dataSourcesService.getById(id),
    enabled: !!id,
  });
}

export function useRelatedEntities(entitySlug: string) {
  return useQuery({
    queryKey: dataSourceKeys.related(entitySlug),
    queryFn: () => dataSourcesService.getRelatedEntities(entitySlug),
    enabled: !!entitySlug,
  });
}

export function useCreateDataSource(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDataSourceData) => dataSourcesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dataSourceKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useUpdateDataSource(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDataSourceData }) =>
      dataSourcesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: dataSourceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dataSourceKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useDeleteDataSource(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => dataSourcesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dataSourceKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useExecuteDataSource() {
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params?: { runtimeFilters?: unknown[]; page?: number; limit?: number } }) =>
      dataSourcesService.execute(id, params),
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function usePreviewDataSource() {
  return useMutation({
    mutationFn: ({ definition, limit }: { definition: DataSourceDefinition; limit?: number }) =>
      dataSourcesService.preview(definition, limit),
  });
}
