import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { usersService, QueryUsersParams, CreateUserData, UpdateUserData } from '@/services/users.service';

// Helper para extrair mensagem de erro
function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || 'Erro desconhecido';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Erro desconhecido';
}

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params?: QueryUsersParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export function useUsers(params?: QueryUsersParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersService.getAll(params),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => usersService.getById(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserData) => usersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success('Usuario criado com sucesso');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) =>
      usersService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      toast.success('Usuario atualizado com sucesso');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success('Usuario excluido com sucesso');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
