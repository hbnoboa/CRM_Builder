import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dataService, QueryDataParams } from '@/services/data.service';

export const dataKeys = {
  all: ['entityData'] as const,
  lists: () => [...dataKeys.all, 'list'] as const,
  list: (organizationId: string, entitySlug: string, params?: QueryDataParams) =>
    [...dataKeys.lists(), organizationId, entitySlug, params] as const,
  details: () => [...dataKeys.all, 'detail'] as const,
  detail: (organizationId: string, entitySlug: string, id: string) =>
    [...dataKeys.details(), organizationId, entitySlug, id] as const,
};

export function useEntityData(
  organizationId: string,
  entitySlug: string,
  params?: QueryDataParams
) {
  return useQuery({
    queryKey: dataKeys.list(organizationId, entitySlug, params),
    queryFn: () => dataService.getAll(organizationId, entitySlug, params),
    enabled: !!organizationId && !!entitySlug,
  });
}

export function useEntityDataItem(
  organizationId: string,
  entitySlug: string,
  id: string
) {
  return useQuery({
    queryKey: dataKeys.detail(organizationId, entitySlug, id),
    queryFn: () => dataService.getById(organizationId, entitySlug, id),
    enabled: !!organizationId && !!entitySlug && !!id,
  });
}

export function useCreateEntityData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      organizationId,
      entitySlug,
      data,
    }: {
      organizationId: string;
      entitySlug: string;
      data: Record<string, unknown>;
    }) => dataService.create(organizationId, entitySlug, data),
    onSuccess: (_, { organizationId, entitySlug }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(organizationId, entitySlug),
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
      organizationId,
      entitySlug,
      id,
      data,
    }: {
      organizationId: string;
      entitySlug: string;
      id: string;
      data: Record<string, unknown>;
    }) => dataService.update(organizationId, entitySlug, id, data),
    onSuccess: (_, { organizationId, entitySlug, id }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(organizationId, entitySlug),
      });
      queryClient.invalidateQueries({
        queryKey: dataKeys.detail(organizationId, entitySlug, id),
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
      organizationId,
      entitySlug,
      id,
    }: {
      organizationId: string;
      entitySlug: string;
      id: string;
    }) => dataService.delete(organizationId, entitySlug, id),
    onSuccess: (_, { organizationId, entitySlug }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(organizationId, entitySlug),
      });
      toast.success('Registro excluido com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir registro');
    },
  });
}
