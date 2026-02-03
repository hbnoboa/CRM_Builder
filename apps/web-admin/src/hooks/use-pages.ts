import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pagesService, CreatePageData, UpdatePageData } from '@/services/pages.service';

export const pageKeys = {
  all: ['pages'] as const,
  lists: () => [...pageKeys.all, 'list'] as const,
  list: (organizationId: string) => [...pageKeys.lists(), organizationId] as const,
  details: () => [...pageKeys.all, 'detail'] as const,
  detail: (id: string) => [...pageKeys.details(), id] as const,
  bySlug: (organizationId: string, slug: string) => [...pageKeys.all, 'slug', organizationId, slug] as const,
};

export function usePages(organizationId: string) {
  return useQuery({
    queryKey: pageKeys.list(organizationId),
    queryFn: () => pagesService.getAll(organizationId),
    enabled: !!organizationId,
  });
}

export function usePage(id: string) {
  return useQuery({
    queryKey: pageKeys.detail(id),
    queryFn: () => pagesService.getById(id),
    enabled: !!id,
  });
}

export function usePageBySlug(organizationId: string, slug: string) {
  return useQuery({
    queryKey: pageKeys.bySlug(organizationId, slug),
    queryFn: () => pagesService.getBySlug(organizationId, slug),
    enabled: !!organizationId && !!slug,
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: CreatePageData }) =>
      pagesService.create(organizationId, data),
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.list(organizationId) });
      toast.success('Pagina criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar pagina');
    },
  });
}

export function useUpdatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePageData }) =>
      pagesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(id) });
      toast.success('Pagina atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar pagina');
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pagesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      toast.success('Pagina excluida com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir pagina');
    },
  });
}

export function usePublishPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pagesService.publish(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(id) });
      toast.success('Pagina publicada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao publicar pagina');
    },
  });
}

export function useUnpublishPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => pagesService.unpublish(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(id) });
      toast.success('Pagina despublicada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao despublicar pagina');
    },
  });
}
