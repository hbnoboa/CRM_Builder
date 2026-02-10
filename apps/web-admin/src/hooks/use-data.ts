import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { dataService, QueryDataParams, EntityDataResponse } from '@/services/data.service';

export const dataKeys = {
  all: ['entityData'] as const,
  lists: () => [...dataKeys.all, 'list'] as const,
  list: (entitySlug: string, params?: QueryDataParams) =>
    [...dataKeys.lists(), entitySlug, params] as const,
  infinite: (entitySlug: string, params?: Omit<QueryDataParams, 'page' | 'cursor'>) =>
    [...dataKeys.lists(), 'infinite', entitySlug, params] as const,
  details: () => [...dataKeys.all, 'detail'] as const,
  detail: (entitySlug: string, id: string) =>
    [...dataKeys.details(), entitySlug, id] as const,
};

/**
 * Hook tradicional com paginacao offset (para tabelas com navegacao por pagina)
 */
export function useEntityData(
  entitySlug: string,
  params?: QueryDataParams
) {
  return useQuery({
    queryKey: dataKeys.list(entitySlug, params),
    queryFn: () => dataService.getAll(entitySlug, params),
    enabled: !!entitySlug,
  });
}

/**
 * Hook com Infinite Query para listas grandes (infinite scroll)
 * Usa cursor-based pagination para melhor performance
 */
export function useInfiniteEntityData(
  entitySlug: string,
  params?: Omit<QueryDataParams, 'page' | 'cursor'>
) {
  const queryResult = useInfiniteQuery({
    queryKey: dataKeys.infinite(entitySlug, params),
    queryFn: async ({ pageParam }) => {
      return dataService.getAll(entitySlug, {
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
    enabled: !!entitySlug,
    staleTime: 30000, // 30 segundos - dados ficam fresh por mais tempo
  });

  // Flatten todos os itens de todas as paginas
  const allItems = useMemo(() => {
    if (!queryResult.data?.pages) return [];
    return queryResult.data.pages.flatMap(page => page.data);
  }, [queryResult.data?.pages]);

  // Entity info da primeira pagina
  const entity = queryResult.data?.pages[0]?.entity;

  // Total de itens (da ultima pagina carregada)
  const totalItems = queryResult.data?.pages[0]?.meta.total ?? 0;

  // Callback para carregar mais
  const loadMore = useCallback(() => {
    if (queryResult.hasNextPage && !queryResult.isFetchingNextPage) {
      queryResult.fetchNextPage();
    }
  }, [queryResult]);

  return {
    ...queryResult,
    items: allItems,
    entity,
    totalItems,
    loadMore,
    // Helpers para infinite scroll
    hasMore: queryResult.hasNextPage,
    isLoadingMore: queryResult.isFetchingNextPage,
  };
}

export function useEntityDataItem(
  entitySlug: string,
  id: string
) {
  return useQuery({
    queryKey: dataKeys.detail(entitySlug, id),
    queryFn: () => dataService.getById(entitySlug, id),
    enabled: !!entitySlug && !!id,
  });
}

interface MutationMessages {
  success?: string;
  error?: string;
}

export function useCreateEntityData(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entitySlug,
      data,
      parentRecordId,
      tenantId,
    }: {
      entitySlug: string;
      data: Record<string, unknown>;
      parentRecordId?: string;
      tenantId?: string;
    }) => dataService.create(entitySlug, data, parentRecordId, tenantId),
    onSuccess: (_, { entitySlug }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(entitySlug),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useUpdateEntityData(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entitySlug,
      id,
      data,
      tenantId,
    }: {
      entitySlug: string;
      id: string;
      data: Record<string, unknown>;
      tenantId?: string;
    }) => dataService.update(entitySlug, id, data, tenantId),
    onSuccess: (_, { entitySlug, id }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(entitySlug),
      });
      queryClient.invalidateQueries({
        queryKey: dataKeys.detail(entitySlug, id),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}

export function useDeleteEntityData(messages?: MutationMessages) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      entitySlug,
      id,
    }: {
      entitySlug: string;
      id: string;
    }) => dataService.delete(entitySlug, id),
    onSuccess: (_, { entitySlug }) => {
      queryClient.invalidateQueries({
        queryKey: dataKeys.list(entitySlug),
      });
      if (messages?.success) toast.success(messages.success);
    },
    onError: (error: Error) => {
      toast.error(messages?.error || error.message);
    },
  });
}
