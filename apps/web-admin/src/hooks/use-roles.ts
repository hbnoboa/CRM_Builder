import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { rolesService, CreateRoleData, UpdateRoleData } from '@/services/roles.service';
import { CACHE_TIMES } from '@/providers/query-provider';

export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: () => [...roleKeys.lists()] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
  userRoles: (userId: string) => [...roleKeys.all, 'user', userId] as const,
};

export function useRoles() {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: () => rolesService.getAll(),
    // Roles rarely change, use longer cache
    ...CACHE_TIMES.STATIC,
  });
}

export function useRole(id: string) {
  return useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: () => rolesService.getById(id),
    enabled: !!id,
    ...CACHE_TIMES.STATIC,
  });
}

export function useUserRoles(userId: string) {
  return useQuery({
    queryKey: roleKeys.userRoles(userId),
    queryFn: () => rolesService.getUserRoles(userId),
    enabled: !!userId,
  });
}

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useCreateRole(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoleData) => rolesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useUpdateRole(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleData }) =>
      rolesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useDeleteRole(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => rolesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useAssignRoleToUser(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesService.assignToUser(userId, roleId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.userRoles(userId) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useRemoveRoleFromUser(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      rolesService.removeFromUser(userId, roleId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.userRoles(userId) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}
