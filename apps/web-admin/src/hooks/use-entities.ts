import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { entitiesService, CreateEntityData, UpdateEntityData, QueryEntitiesParams } from '@/services/entities.service';

export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (params?: QueryEntitiesParams) => [...entityKeys.lists(), params] as const,
  infinite: (params?: Omit<QueryEntitiesParams, 'page' | 'cursor'>) =>
    [...entityKeys.lists(), 'infinite', params] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (id: string) => [...entityKeys.details(), id] as const,
  bySlug: (slug: string) => [...entityKeys.all, 'slug', slug] as const,
};

export function useEntities(params?: QueryEntitiesParams) {
  return useQuery({
    queryKey: entityKeys.list(params),
    queryFn: () => entitiesService.getAll(params),
  });
}

/**
 * Hook com Infinite Query para listas grandes (infinite scroll)
 * Usa cursor-based pagination para melhor performance
 */
export function useInfiniteEntities(
  params?: Omit<QueryEntitiesParams, 'page' | 'cursor'>
) {
  const queryResult = useInfiniteQuery({
    queryKey: entityKeys.infinite(params),
    queryFn: async ({ pageParam }) => {
      return entitiesService.getAll({
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

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useCreateEntity(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEntityData) => entitiesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityKeys.list() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useUpdateEntity(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEntityData }) =>
      entitiesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(id) });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useDeleteEntity(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => entitiesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}
