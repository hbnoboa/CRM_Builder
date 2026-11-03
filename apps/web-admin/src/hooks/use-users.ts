import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { usersService, QueryUsersParams, CreateUserData, UpdateUserData } from '@/services/users.service';
import { getErrorMessage } from '@/lib/get-error-message';

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params?: QueryUsersParams) => [...userKeys.lists(), params] as const,
  infinite: (params?: Omit<QueryUsersParams, 'page' | 'cursor'>) =>
    [...userKeys.lists(), 'infinite', params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export function useUsers(params?: QueryUsersParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersService.getAll(params),
  });
}

/**
 * Hook com Infinite Query para listas grandes (infinite scroll)
 * Usa cursor-based pagination para melhor performance
 */
export function useInfiniteUsers(
  params?: Omit<QueryUsersParams, 'page' | 'cursor'>
) {
  const queryResult = useInfiniteQuery({
    queryKey: userKeys.infinite(params),
    queryFn: async ({ pageParam }) => {
      return usersService.getAll({
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

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => usersService.getById(id),
    enabled: !!id,
  });
}

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useCreateUser(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserData) => usersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useUpdateUser(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) =>
      usersService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}

export function useDeleteUser(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, messages?.error));
    },
  });
}
