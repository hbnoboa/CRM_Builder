import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
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
  infinite: (params?: Omit<QueryCustomRolesParams, 'page' | 'cursor'>) =>
    [...customRoleKeys.lists(), 'infinite', params] as const,
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

/**
 * Hook com Infinite Query para listas grandes (infinite scroll)
 * Usa cursor-based pagination para melhor performance
 */
export function useInfiniteCustomRoles(
  params?: Omit<QueryCustomRolesParams, 'page' | 'cursor'>
) {
  const queryResult = useInfiniteQuery({
    queryKey: customRoleKeys.infinite(params),
    queryFn: async ({ pageParam }) => {
      return customRolesService.getAll({
        ...params,
        cursor: pageParam as string | undefined,
        limit: params?.limit || 20,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta.hasNextPage) return undefined;
      return lastPage.meta.nextCursor;
    },
    getPreviousPageParam: (firstPage) => {
      if (!firstPage.meta.hasPreviousPage) return undefined;
      return firstPage.meta.previousCursor;
    },
    staleTime: 30000,
  });

  const allItems = useMemo(() => {
    if (!queryResult.data?.pages) return [];
    return queryResult.data.pages.flatMap(page => page.data);
  }, [queryResult.data?.pages]);

  const totalItems = queryResult.data?.pages[0]?.meta.total ?? 0;

  const loadMore = useCallback(() => {
    if (queryResult.hasNextPage && !queryResult.isFetchingNextPage) {
      queryResult.fetchNextPage();
    }
  }, [queryResult]);

  return {
    ...queryResult,
    items: allItems,
    totalItems,
    loadMore,
    hasMore: queryResult.hasNextPage,
    isLoadingMore: queryResult.isFetchingNextPage,
  };
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
    mutationFn: ({ id, tenantId }: { id: string; tenantId?: string }) =>
      customRolesService.delete(id, tenantId),
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
