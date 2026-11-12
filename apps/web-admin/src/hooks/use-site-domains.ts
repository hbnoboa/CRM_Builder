import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';

export type DomainStatus = 'pending_dns' | 'active' | 'error';
export type DomainOrderStatus = 'awaiting_payment' | 'registering' | 'registered' | 'failed' | 'cancelled';

export interface SiteDomain {
  id: string;
  hostname: string;
  kind: 'connected' | 'purchased';
  status: DomainStatus;
  isPrimary: boolean;
  apex: boolean;
  verifiedAt: string | null;
  lastCheckAt: string | null;
  lastError: string | null;
  found?: string[];
}

export interface SiteDomainOrder {
  id: string;
  hostname: string;
  years: number;
  priceCents: number;
  currency: string;
  status: DomainOrderStatus;
  expiresAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface SiteDomainsInfo {
  domains: SiteDomain[];
  orders: SiteDomainOrder[];
  dns: { cname: string; ips: string[] };
  purchase: { enabled: boolean; testMode: boolean; tlds: string[] };
}

export interface DomainQuote { hostname: string; available: boolean; priceCents: number; currency: string }

const KEY = ['site-domains'];

export function useSiteDomains() {
  return useQuery({ queryKey: KEY, queryFn: async () => (await api.get<SiteDomainsInfo>('/site-domains')).data });
}

function useDomainMutation<T>(fn: (arg: T) => Promise<unknown>, success?: string, fallback = 'Não foi possível concluir.') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['site-pages'] });
      if (success) toast.success(success);
    },
    onError: (e) => toast.error(getErrorMessage(e, fallback)),
  });
}

export const useConnectDomain = () => useDomainMutation((hostname: string) => api.post<SiteDomain>('/site-domains', { hostname }).then((r) => r.data));
export const useVerifyDomain = () => useDomainMutation((id: string) => api.post<SiteDomain>(`/site-domains/${id}/verify`).then((r) => r.data));
export const usePrimaryDomain = () => useDomainMutation((id: string) => api.patch(`/site-domains/${id}`, { isPrimary: true }), 'Domínio principal atualizado.');
export const useRemoveDomain = () => useDomainMutation((id: string) => api.delete(`/site-domains/${id}`), 'Domínio desligado do site.');
export const useCancelDomainOrder = () => useDomainMutation((id: string) => api.post(`/site-domains/orders/${id}/cancel`), 'Pedido cancelado.');
export const useCreateDomainOrder = () => useDomainMutation(
  (body: { hostname: string; years: number; registrant: { name: string; document: string; email: string; phone: string } }) =>
    api.post<SiteDomainOrder>('/site-domains/orders', body).then((r) => r.data),
  'Pedido enviado! A equipe IOS System vai entrar em contato para o pagamento.',
);

export async function searchDomains(q: string) {
  return (await api.get<{ testMode: boolean; results: DomainQuote[] }>('/site-domains/search', { params: { q } })).data;
}
