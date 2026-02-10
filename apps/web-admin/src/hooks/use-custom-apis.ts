import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  customApisService,
  CreateCustomApiData,
  UpdateCustomApiData,
  QueryCustomApisParams,
} from '@/services/custom-apis.service';

export const customApiKeys = {
  all: ['custom-apis'] as const,
  lists: () => [...customApiKeys.all, 'list'] as const,
  list: (params?: QueryCustomApisParams) => [...customApiKeys.lists(), params] as const,
  infinite: (params?: Omit<QueryCustomApisParams, 'page' | 'cursor'>) =>
    [...customApiKeys.lists(), 'infinite', params] as const,
  details: () => [...customApiKeys.all, 'detail'] as const,
  detail: (id: string) => [...customApiKeys.details(), id] as const,
};

export function useCustomApis(params?: QueryCustomApisParams) {
  return useQuery({
    queryKey: customApiKeys.list(params),
    queryFn: () => customApisService.getAll(params),
  });
}

/**
 * Hook com Infinite Query para listas grandes (infinite scroll)
 * Usa cursor-based pagination para melhor performance
 */
export function useInfiniteCustomApis(
  params?: Omit<QueryCustomApisParams, 'page' | 'cursor'>
) {
  const queryResult = useInfiniteQuery({
    queryKey: customApiKeys.infinite(params),
    queryFn: async ({ pageParam }) => {
      return customApisService.getAll({
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

export function useCustomApi(id: string) {
  return useQuery({
    queryKey: customApiKeys.detail(id),
    queryFn: () => customApisService.getById(id),
    enabled: !!id,
  });
}

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useCreateCustomApi(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCustomApiData) => customApisService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customApiKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useUpdateCustomApi(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomApiData }) =>
      customApisService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: customApiKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customApiKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useDeleteCustomApi(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customApisService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customApiKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useActivateCustomApi(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customApisService.activate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: customApiKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customApiKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useDeactivateCustomApi(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customApisService.deactivate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: customApiKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customApiKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useTestCustomApi(messages?: MutationMessages) {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: Record<string, unknown> }) =>
      customApisService.test(id, payload),
    onSuccess: () => {
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}
