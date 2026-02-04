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

export function useCreateEntityData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entitySlug,
      data,
    }: {
      entitySlug: string;
      data: Record<string, unknown>;
    }) => dataService.create(entitySlug, data),
    onSuccess: (_, { entitySlug }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(entitySlug),
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
      entitySlug,
      id,
      data,
    }: {
      entitySlug: string;
      id: string;
      data: Record<string, unknown>;
    }) => dataService.update(entitySlug, id, data),
    onSuccess: (_, { entitySlug, id }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(entitySlug),
      });
      queryClient.invalidateQueries({
        queryKey: dataKeys.detail(entitySlug, id),
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
      toast.success('Registro excluido com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir registro');
    },
  });
}
