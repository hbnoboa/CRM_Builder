import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import {
  customRolesService,
  QueryCustomRolesParams,
  CreateCustomRoleData,
  UpdateCustomRoleData,
} from '@/services/custom-roles.service';

function getErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof AxiosError)
    return error.response?.data?.message || error.message || fallback || 'Error';
  if (error instanceof Error) return error.message || fallback || 'Error';
  return fallback || 'Error';
}

export const customRoleKeys = {
  all: ['custom-roles'] as const,
  lists: () => [...customRoleKeys.all, 'list'] as const,
  list: (params?: QueryCustomRolesParams) => [...customRoleKeys.lists(), params] as const,
  details: () => [...customRoleKeys.all, 'detail'] as const,
  detail: (id: string) => [...customRoleKeys.details(), id] as const,
  myPermissions: () => [...customRoleKeys.all, 'my-permissions'] as const,
};

export function useCustomRoles(params?: QueryCustomRolesParams) {
  return useQuery({
    queryKey: customRoleKeys.list(params),
    queryFn: () => customRolesService.getAll(params),
  });
}

export function useCustomRole(id: string) {
  return useQuery({
    queryKey: customRoleKeys.detail(id),
    queryFn: () => customRolesService.getById(id),
    enabled: !!id,
  });
}

export function useMyPermissions() {
  return useQuery({
    queryKey: customRoleKeys.myPermissions(),
    queryFn: () => customRolesService.getMyPermissions(),
  });
}

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useCreateCustomRole(messages?: MutationMessages) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomRoleData) => customRolesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customRoleKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useUpdateCustomRole(messages?: MutationMessages) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomRoleData }) =>
      customRolesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: customRoleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customRoleKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useDeleteCustomRole(messages?: MutationMessages) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customRolesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customRoleKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useAssignRole(messages?: MutationMessages) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      customRolesService.assignToUser(roleId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: customRoleKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}
