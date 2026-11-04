import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trashService } from '@/services/trash.service';
import { entityKeys } from '@/hooks/use-entities';
import { dataKeys } from '@/hooks/use-data';

export const trashKeys = {
  all: ['trash'] as const,
  list: (params: object) => [...trashKeys.all, 'list', params] as const,
  tables: () => [...trashKeys.all, 'tables'] as const,
};

export function useTrash(params: { entitySlug?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: trashKeys.list(params),
    queryFn: () => trashService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useTrashTables() {
  return useQuery({ queryKey: trashKeys.tables(), queryFn: trashService.tables });
}

/** Depois de restaurar/apagar: lixeira, listas da tabela e contadores do menu. */
function useInvalidateAfter() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: trashKeys.all });
    queryClient.invalidateQueries({ queryKey: entityKeys.grouped() });
    queryClient.invalidateQueries({ queryKey: dataKeys.lists() });
  };
}

export function useRestoreFromTrash() {
  const after = useInvalidateAfter();
  return useMutation({
    mutationFn: ({ entitySlug, id }: { entitySlug: string; id: string }) => trashService.restore(entitySlug, id),
    onSuccess: () => after(),
  });
}

export function usePurgeFromTrash() {
  const after = useInvalidateAfter();
  return useMutation({
    mutationFn: ({ entitySlug, id }: { entitySlug: string; id: string }) => trashService.purge(entitySlug, id),
    onSuccess: () => after(),
  });
}

export function useEmptyTrash() {
  const after = useInvalidateAfter();
  return useMutation({ mutationFn: (entitySlug?: string) => trashService.empty(entitySlug), onSuccess: () => after() });
}

export function useUpdateTrashSettings() {
  const after = useInvalidateAfter();
  return useMutation({ mutationFn: trashService.updateSettings, onSuccess: () => after() });
}
