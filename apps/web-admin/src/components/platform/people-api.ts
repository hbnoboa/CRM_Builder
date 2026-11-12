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

export function usePeopleSearch(q: string) {
  return useQuery({
    queryKey: [...KEY, 'search', q],
    queryFn: async () => (await platformApi.get<Person[]>('/users', { params: { q } })).data,
    enabled: q.trim().length >= 2,
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
