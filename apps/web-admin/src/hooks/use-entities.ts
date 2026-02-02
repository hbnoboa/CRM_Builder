import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { entitiesService, CreateEntityData, UpdateEntityData } from '@/services/entities.service';

export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...entityKeys.lists(), workspaceId] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (id: string) => [...entityKeys.details(), id] as const,
  bySlug: (workspaceId: string, slug: string) => [...entityKeys.all, 'slug', workspaceId, slug] as const,
};

export function useEntities(workspaceId: string) {
  return useQuery({
    queryKey: entityKeys.list(workspaceId),
    queryFn: () => entitiesService.getAll(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useEntity(id: string) {
  return useQuery({
    queryKey: entityKeys.detail(id),
    queryFn: () => entitiesService.getById(id),
    enabled: !!id,
  });
}

export function useEntityBySlug(workspaceId: string, slug: string) {
  return useQuery({
    queryKey: entityKeys.bySlug(workspaceId, slug),
    queryFn: () => entitiesService.getBySlug(workspaceId, slug),
    enabled: !!workspaceId && !!slug,
  });
}

export function useCreateEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, data }: { workspaceId: string; data: CreateEntityData }) =>
      entitiesService.create(workspaceId, data),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: entityKeys.list(workspaceId) });
      toast.success('Entidade criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar entidade');
    },
  });
}

export function useUpdateEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEntityData }) =>
      entitiesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(id) });
      toast.success('Entidade atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar entidade');
    },
  });
}

export function useDeleteEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => entitiesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
      toast.success('Entidade excluida com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir entidade');
    },
  });
}
