import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { entitiesService, CreateEntityData, UpdateEntityData } from '@/services/entities.service';

export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: () => [...entityKeys.lists()] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (id: string) => [...entityKeys.details(), id] as const,
  bySlug: (slug: string) => [...entityKeys.all, 'slug', slug] as const,
};

export function useEntities() {
  return useQuery({
    queryKey: entityKeys.list(),
    queryFn: () => entitiesService.getAll(),
  });
}

export function useEntity(id: string) {
  return useQuery({
    queryKey: entityKeys.detail(id),
    queryFn: () => entitiesService.getById(id),
    enabled: !!id,
  });
}

export function useEntityBySlug(slug: string) {
  return useQuery({
    queryKey: entityKeys.bySlug(slug),
    queryFn: () => entitiesService.getBySlug(slug),
    enabled: !!slug,
  });
}

export function useCreateEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEntityData) => entitiesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityKeys.list() });
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
