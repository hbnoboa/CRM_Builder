import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  customApisService,
  CreateCustomApiData,
  UpdateCustomApiData,
} from '@/services/custom-apis.service';

export const customApiKeys = {
  all: ['custom-apis'] as const,
  lists: () => [...customApiKeys.all, 'list'] as const,
  list: () => [...customApiKeys.lists()] as const,
  details: () => [...customApiKeys.all, 'detail'] as const,
  detail: (id: string) => [...customApiKeys.details(), id] as const,
};

export function useCustomApis() {
  return useQuery({
    queryKey: customApiKeys.list(),
    queryFn: () => customApisService.getAll(),
  });
}

export function useCustomApi(id: string) {
  return useQuery({
    queryKey: customApiKeys.detail(id),
    queryFn: () => customApisService.getById(id),
    enabled: !!id,
  });
}

export function useCreateCustomApi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCustomApiData) => customApisService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customApiKeys.lists() });
      toast.success('API criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar API');
    },
  });
}

export function useUpdateCustomApi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomApiData }) =>
      customApisService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: customApiKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customApiKeys.detail(id) });
      toast.success('API atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar API');
    },
  });
}

export function useDeleteCustomApi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customApisService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customApiKeys.lists() });
      toast.success('API excluida com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir API');
    },
  });
}

export function useActivateCustomApi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customApisService.activate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: customApiKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customApiKeys.detail(id) });
      toast.success('API ativada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao ativar API');
    },
  });
}

export function useDeactivateCustomApi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customApisService.deactivate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: customApiKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customApiKeys.detail(id) });
      toast.success('API desativada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao desativar API');
    },
  });
}

export function useTestCustomApi() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: Record<string, unknown> }) =>
      customApisService.test(id, payload),
    onSuccess: () => {
      toast.success('Teste executado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao testar API');
    },
  });
}
