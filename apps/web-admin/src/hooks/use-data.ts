import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dataService, QueryDataParams } from '@/services/data.service';

export const dataKeys = {
  all: ['entityData'] as const,
  lists: () => [...dataKeys.all, 'list'] as const,
  list: (workspaceId: string, entitySlug: string, params?: QueryDataParams) =>
    [...dataKeys.lists(), workspaceId, entitySlug, params] as const,
  details: () => [...dataKeys.all, 'detail'] as const,
  detail: (workspaceId: string, entitySlug: string, id: string) =>
    [...dataKeys.details(), workspaceId, entitySlug, id] as const,
};

export function useEntityData(
  workspaceId: string,
  entitySlug: string,
  params?: QueryDataParams
) {
  return useQuery({
    queryKey: dataKeys.list(workspaceId, entitySlug, params),
    queryFn: () => dataService.getAll(workspaceId, entitySlug, params),
    enabled: !!workspaceId && !!entitySlug,
  });
}

export function useEntityDataItem(
  workspaceId: string,
  entitySlug: string,
  id: string
) {
  return useQuery({
    queryKey: dataKeys.detail(workspaceId, entitySlug, id),
    queryFn: () => dataService.getById(workspaceId, entitySlug, id),
    enabled: !!workspaceId && !!entitySlug && !!id,
  });
}

export function useCreateEntityData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      entitySlug,
      data,
    }: {
      workspaceId: string;
      entitySlug: string;
      data: Record<string, unknown>;
    }) => dataService.create(workspaceId, entitySlug, data),
    onSuccess: (_, { workspaceId, entitySlug }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(workspaceId, entitySlug),
      });
      toast.success('Registro criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar registro');
    },
  });
}

export function useUpdateEntityData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      entitySlug,
      id,
      data,
    }: {
      workspaceId: string;
      entitySlug: string;
      id: string;
      data: Record<string, unknown>;
    }) => dataService.update(workspaceId, entitySlug, id, data),
    onSuccess: (_, { workspaceId, entitySlug, id }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(workspaceId, entitySlug),
      });
      queryClient.invalidateQueries({
        queryKey: dataKeys.detail(workspaceId, entitySlug, id),
      });
      toast.success('Registro atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar registro');
    },
  });
}

export function useDeleteEntityData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      entitySlug,
      id,
    }: {
      workspaceId: string;
      entitySlug: string;
      id: string;
    }) => dataService.delete(workspaceId, entitySlug, id),
    onSuccess: (_, { workspaceId, entitySlug }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(workspaceId, entitySlug),
      });
      toast.success('Registro excluido com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir registro');
    },
  });
}
