import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

export interface GestaoOverview {
  pending: {
    neverLoggedIn: { count: number; sample: Array<{ id: string; name: string; email: string }> };
    inactive30: number;
    unusedRoles: number;
    failedRuns7d: number;
  };
  /** null = o cargo nao ve os logs da empresa */
  activity: Array<{
    id: string;
    action: string;
    resource: string;
    userName: string | null;
    impersonatedByName: string | null;
    createdAt: string;
  }> | null;
}

/** Painel da administracao (GET /tenants/me/overview). */
export function useGestaoOverview() {
  const params = useParams();
  const slug = typeof params?.tenant === 'string' ? params.tenant : '';
  return useQuery({
    queryKey: ['gestao-overview', slug],
    queryFn: async () => (await api.get<GestaoOverview>('/tenants/me/overview')).data,
    staleTime: 30_000,
  });
}
