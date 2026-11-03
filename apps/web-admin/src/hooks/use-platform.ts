import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getPlatformToken, platformApi } from '@/lib/platform-api';
import type {
  Paginated,
  Plan,
  PlanLimits,
  PlatformAuditRow,
  PlatformOverview,
  PlatformStaff,
  PlatformStaffRole,
  PlatformStaffRow,
  PlatformTenantDetail,
  PlatformTenantMember,
  PlatformTenantRow,
  TenantFeatures,
  TenantLifecycle,
  TenantSubscription,
} from '@/types/platform';

export const platformKeys = {
  all: ['platform'] as const,
  me: () => [...platformKeys.all, 'me'] as const,
  overview: () => [...platformKeys.all, 'overview'] as const,
  tenants: (params?: object) => [...platformKeys.all, 'tenants', params ?? {}] as const,
  tenant: (id: string) => [...platformKeys.all, 'tenant', id] as const,
  members: (id: string) => [...platformKeys.all, 'tenant', id, 'members'] as const,
  plans: () => [...platformKeys.all, 'plans'] as const,
  staff: () => [...platformKeys.all, 'staff'] as const,
  audit: (params?: object) => [...platformKeys.all, 'audit', params ?? {}] as const,
};

// ── Sessao da equipe ────────────────────────────────────────────────────────

export function usePlatformMe() {
  return useQuery({
    queryKey: platformKeys.me(),
    queryFn: async () => (await platformApi.get<PlatformStaff>('/auth/me')).data,
    enabled: typeof window !== 'undefined' && !!getPlatformToken(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlatformCan() {
  const { data } = usePlatformMe();
  return (permission: string) => !!data?.permissions.includes(permission);
}

export function usePlatformChangePassword() {
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) =>
      (await platformApi.post('/auth/change-password', body)).data,
  });
}

// ── Leitura ─────────────────────────────────────────────────────────────────

export function usePlatformOverview() {
  return useQuery({
    queryKey: platformKeys.overview(),
    queryFn: async () => (await platformApi.get<PlatformOverview>('/overview')).data,
  });
}

export interface PlatformTenantsParams {
  search?: string;
  lifecycle?: TenantLifecycle;
  planId?: string;
  page?: number;
  limit?: number;
}

export function usePlatformTenants(params: PlatformTenantsParams) {
  return useQuery({
    queryKey: platformKeys.tenants(params),
    queryFn: async () =>
      (await platformApi.get<Paginated<PlatformTenantRow>>('/tenants', { params })).data,
    placeholderData: (prev) => prev,
  });
}

export function usePlatformTenant(id: string) {
  return useQuery({
    queryKey: platformKeys.tenant(id),
    queryFn: async () => (await platformApi.get<PlatformTenantDetail>(`/tenants/${id}`)).data,
    enabled: !!id,
  });
}

export function usePlatformTenantMembers(id: string) {
  return useQuery({
    queryKey: platformKeys.members(id),
    queryFn: async () => (await platformApi.get<PlatformTenantMember[]>(`/tenants/${id}/members`)).data,
    enabled: !!id,
  });
}

export function usePlatformPlans() {
  return useQuery({
    queryKey: platformKeys.plans(),
    queryFn: async () => (await platformApi.get<Plan[]>('/plans')).data,
  });
}

export function usePlatformStaff(enabled = true) {
  return useQuery({
    queryKey: platformKeys.staff(),
    queryFn: async () => (await platformApi.get<PlatformStaffRow[]>('/staff')).data,
    enabled,
  });
}

export function usePlatformAudit(params: { tenantId?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: platformKeys.audit(params),
    queryFn: async () =>
      (await platformApi.get<Paginated<PlatformAuditRow>>('/audit-logs', { params })).data,
    placeholderData: (prev) => prev,
  });
}

// ── Escrita ─────────────────────────────────────────────────────────────────

function useInvalidatingMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      // Console pequeno: invalidar tudo da plataforma mantem as telas coerentes.
      queryClient.invalidateQueries({ queryKey: platformKeys.all });
    },
  });
}

export interface CreatePlatformTenantBody {
  name: string;
  slug: string;
  planId?: string;
  lifecycle?: TenantLifecycle;
  trialEndsAt?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export function useCreatePlatformTenant() {
  return useInvalidatingMutation(async (body: CreatePlatformTenantBody) =>
    (await platformApi.post<{ id: string }>('/tenants', body)).data,
  );
}

export function useUpdatePlatformTenant(id: string) {
  return useInvalidatingMutation(async (body: { name?: string; domain?: string | null }) =>
    (await platformApi.patch(`/tenants/${id}`, body)).data,
  );
}

export function useSetTenantLifecycle(id: string) {
  return useInvalidatingMutation(async (body: { lifecycle: TenantLifecycle; trialEndsAt?: string }) =>
    (await platformApi.patch(`/tenants/${id}/lifecycle`, body)).data,
  );
}

export function useSetTenantPlan(id: string) {
  return useInvalidatingMutation(async (planId: string | null) =>
    (await platformApi.patch(`/tenants/${id}/plan`, { planId })).data,
  );
}

export function useSetTenantFeatures(id: string) {
  return useInvalidatingMutation(async (overrides: Partial<Record<keyof TenantFeatures, boolean | null>>) =>
    (await platformApi.patch(`/tenants/${id}/features`, { overrides })).data,
  );
}

export interface PlatformImpersonation {
  user: { id: string; tenantId: string; tenant: { slug: string } };
  impersonatedBy: { id: string; name: string };
  accessToken: string;
  refreshToken: string;
}

export function useImpersonateTenantUser(tenantId: string) {
  return useMutation({
    mutationFn: async (userId: string) =>
      (await platformApi.post<PlatformImpersonation>(`/tenants/${tenantId}/users/${userId}/impersonate`)).data,
  });
}

export interface PlanBody {
  name?: string;
  slug?: string;
  description?: string;
  limits?: PlanLimits;
  features?: Partial<TenantFeatures>;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export function useSavePlan() {
  return useInvalidatingMutation(async ({ id, ...body }: PlanBody & { id?: string }) =>
    id
      ? (await platformApi.patch<Plan>(`/plans/${id}`, body)).data
      : (await platformApi.post<Plan>('/plans', body)).data,
  );
}

export function useCreateStaff() {
  return useInvalidatingMutation(
    async (body: { email: string; name: string; role: PlatformStaffRole; password: string }) =>
      (await platformApi.post('/staff', body)).data,
  );
}

export function useUpdateStaff() {
  return useInvalidatingMutation(
    async ({ id, ...body }: { id: string; name?: string; role?: PlatformStaffRole; status?: string; password?: string }) =>
      (await platformApi.patch(`/staff/${id}`, body)).data,
  );
}

export function useRemoveStaff() {
  return useInvalidatingMutation(async (id: string) => (await platformApi.delete(`/staff/${id}`)).data);
}

// ── Lado do tenant ──────────────────────────────────────────────────────────

/** Plano, funcoes, limites e trial do tenant atual (API de tenant, nao do console). */
export function useSubscription(tenantKey?: string) {
  return useQuery({
    queryKey: ['subscription', tenantKey ?? 'current'],
    queryFn: async () => (await api.get<TenantSubscription>('/subscription')).data,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
