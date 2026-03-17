import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicLinkService, CreatePublicLinkPayload, UpdatePublicLinkPayload } from '@/services/public-link.service';
import { toast } from 'sonner';

export function usePublicLinks(params?: { page?: number; limit?: number; search?: string; entitySlug?: string }) {
  return useQuery({
    queryKey: ['public-links', params],
    queryFn: () => publicLinkService.findAll(params),
  });
}

export function usePublicLink(id: string) {
  return useQuery({
    queryKey: ['public-links', id],
    queryFn: () => publicLinkService.findOne(id),
    enabled: !!id,
  });
}

export function useCreatePublicLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePublicLinkPayload) => publicLinkService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-links'] });
      toast.success('Link publico criado');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao criar link');
    },
  });
}

export function useUpdatePublicLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePublicLinkPayload }) =>
      publicLinkService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-links'] });
      toast.success('Link atualizado');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao atualizar link');
    },
  });
}

export function useDeletePublicLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publicLinkService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-links'] });
      toast.success('Link removido');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Erro ao remover link');
    },
  });
}
