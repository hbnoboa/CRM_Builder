import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { TicketDetail, TicketPriority, TicketRow } from './support-types';

const keys = { all: ['support'] as const };

export function useMyTickets(status: 'open' | 'closed' | 'all') {
  return useQuery({
    queryKey: [...keys.all, 'list', status],
    queryFn: async () => (await api.get<{ seesAll: boolean; data: TicketRow[] }>('/support/tickets', { params: { status } })).data,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: [...keys.all, 'ticket', id],
    queryFn: async () => (await api.get<TicketDetail>(`/support/tickets/${id}`)).data,
    refetchInterval: 15_000,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { subject: string; category: string; priority: TicketPriority; body: string }) =>
      (await api.post<TicketRow>('/support/tickets', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useReplyTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => (await api.post<TicketDetail>(`/support/tickets/${id}/messages`, { body })).data,
    onSuccess: (data) => { qc.setQueryData([...keys.all, 'ticket', id], data); qc.invalidateQueries({ queryKey: [...keys.all, 'list'] }); },
  });
}

export function useResolveTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<TicketDetail>(`/support/tickets/${id}/resolve`)).data,
    onSuccess: (data) => { qc.setQueryData([...keys.all, 'ticket', id], data); qc.invalidateQueries({ queryKey: [...keys.all, 'list'] }); },
  });
}
