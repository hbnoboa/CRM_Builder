import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dataService, QueryDataParams } from '@/services/data.service';

export const dataKeys = {
  all: ['entityData'] as const,
  lists: () => [...dataKeys.all, 'list'] as const,
  list: (entitySlug: string, params?: QueryDataParams) =>
    [...dataKeys.lists(), entitySlug, params] as const,
  details: () => [...dataKeys.all, 'detail'] as const,
  detail: (entitySlug: string, id: string) =>
    [...dataKeys.details(), entitySlug, id] as const,
};

export function useEntityData(
  entitySlug: string,
  params?: QueryDataParams
) {
  return useQuery({
    queryKey: dataKeys.list(entitySlug, params),
    queryFn: () => dataService.getAll(entitySlug, params),
    enabled: !!entitySlug,
  });
}

export function useEntityDataItem(
  entitySlug: string,
  id: string
) {
  return useQuery({
    queryKey: dataKeys.detail(entitySlug, id),
    queryFn: () => dataService.getById(entitySlug, id),
    enabled: !!entitySlug && !!id,
  });
}

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useCreateEntityData(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entitySlug,
      data,
      parentRecordId,
      tenantId,
    }: {
      entitySlug: string;
      data: Record<string, unknown>;
      parentRecordId?: string;
      tenantId?: string;
    }) => dataService.create(entitySlug, data, parentRecordId, tenantId),
    onSuccess: (_, { entitySlug }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(entitySlug),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useUpdateEntityData(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entitySlug,
      id,
      data,
      tenantId,
    }: {
      entitySlug: string;
      id: string;
      data: Record<string, unknown>;
      tenantId?: string;
    }) => dataService.update(entitySlug, id, data, tenantId),
    onSuccess: (_, { entitySlug, id }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(entitySlug),
      });
      queryClient.invalidateQueries({
        queryKey: dataKeys.detail(entitySlug, id),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useDeleteEntityData(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entitySlug,
      id,
    }: {
      entitySlug: string;
      id: string;
    }) => dataService.delete(entitySlug, id),
    onSuccess: (_, { entitySlug }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(entitySlug),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}
