import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-api';
import type { TenantLifecycle } from '@/types/platform';

export interface PersonMembership {
  tenant: { id: string; name: string; slug: string; lifecycle: TenantLifecycle };
  role: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'REMOVED';
  isOwner: boolean;
  since: string;
}

export interface Person {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  mfaEnabled: boolean;
  activeSessions: number;
  memberships: PersonMembership[];
}

export interface PersonDetail extends Person {
  sessions: Array<{ id: string; ip: string | null; userAgent: string | null; label: string | null; createdAt: string; lastUsedAt: string }>;
  recentActions: Array<{ createdAt: string; action: string; resource: string; resourceId: string | null; tenantId: string }>;
}

const KEY = ['platform', 'people'] as const;

export interface PeopleParams {
  q?: string;
  tenantId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  mfa?: 'on' | 'off';
  owner?: 'true';
  page?: number;
  limit?: number;
}

/** Pessoas de todas as empresas (mais recentes primeiro), com busca e filtros. */
export function usePeople(params: PeopleParams) {
  return useQuery({
    queryKey: [...KEY, 'list', params],
    queryFn: async () => (await platformApi.get<{ data: Person[]; meta: { total: number; page: number; limit: number; totalPages: number } }>('/users', { params })).data,
    placeholderData: (prev) => prev,
  });
}

export function usePerson(id: string) {
  return useQuery({ queryKey: [...KEY, id], queryFn: async () => (await platformApi.get<PersonDetail>(`/users/${id}`)).data });
}

export function usePersonAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: 'password-reset' | 'logout' | 'mfa-reset') => (await platformApi.post(`/users/${id}/${action}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
