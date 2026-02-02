import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  tenantsService,
  QueryTenantsParams,
  CreateTenantData,
  UpdateTenantData,
} from '@/services/tenants.service';
import { CACHE_TIMES } from '@/providers/query-provider';

export const tenantKeys = {
  all: ['tenants'] as const,
  lists: () => [...tenantKeys.all, 'list'] as const,
  list: (params?: QueryTenantsParams) => [...tenantKeys.lists(), params] as const,
  details: () => [...tenantKeys.all, 'detail'] as const,
  detail: (id: string) => [...tenantKeys.details(), id] as const,
  stats: () => [...tenantKeys.all, 'stats'] as const,
};

export function useTenants(params?: QueryTenantsParams) {
  return useQuery({
    queryKey: tenantKeys.list(params),
    queryFn: () => tenantsService.getAll(params),
    // Tenants rarely change
    ...CACHE_TIMES.STATIC,
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: tenantKeys.detail(id),
    queryFn: () => tenantsService.getById(id),
    enabled: !!id,
    ...CACHE_TIMES.STATIC,
  });
}

export function useTenantStats() {
  return useQuery({
    queryKey: tenantKeys.stats(),
    queryFn: () => tenantsService.getStats(),
    // Stats can change more often
    ...CACHE_TIMES.DYNAMIC,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTenantData) => tenantsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.lists() });
      queryClient.invalidateQueries({ queryKey: tenantKeys.stats() });
      toast.success('Tenant criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar tenant');
    },
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTenantData }) =>
      tenantsService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.lists() });
      queryClient.invalidateQueries({ queryKey: tenantKeys.detail(id) });
      toast.success('Tenant atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar tenant');
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tenantsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.lists() });
      queryClient.invalidateQueries({ queryKey: tenantKeys.stats() });
      toast.success('Tenant excluido com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir tenant');
    },
  });
}

export function useSuspendTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tenantsService.suspend(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.lists() });
      queryClient.invalidateQueries({ queryKey: tenantKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: tenantKeys.stats() });
      toast.success('Tenant suspenso com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao suspender tenant');
    },
  });
}

export function useActivateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tenantsService.activate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.lists() });
      queryClient.invalidateQueries({ queryKey: tenantKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: tenantKeys.stats() });
      toast.success('Tenant ativado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao ativar tenant');
    },
  });
}
