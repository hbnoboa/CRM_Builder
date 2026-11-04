import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-api';
import type { TicketDetail, TicketPriority, TicketRow, TicketStatus } from './support-types';

export interface ConsoleTicketRow extends TicketRow {
  tenant: { id: string; name: string; slug: string };
  assignedStaffName: string | null;
}

const keys = { all: ['platform', 'support'] as const };

export function useConsoleTickets(params: { status?: string; priority?: string; assigned?: string; search?: string; page?: number }) {
  return useQuery({
    queryKey: [...keys.all, 'list', params],
    queryFn: async () => (await platformApi.get<{ data: ConsoleTicketRow[]; meta: { total: number; page: number; totalPages: number } }>('/support/tickets', { params })).data,
    placeholderData: (prev) => prev,
  });
}

export function useConsoleTicketCounts(enabled: boolean) {
  return useQuery({
    queryKey: [...keys.all, 'counts'],
    queryFn: async () => (await platformApi.get<{ open: number; mine: number; unassigned: number }>('/support/counts')).data,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useConsoleTicket(id: string) {
  return useQuery({
    queryKey: [...keys.all, 'ticket', id],
    queryFn: async () => (await platformApi.get<TicketDetail>(`/support/tickets/${id}`)).data,
    refetchInterval: 15_000,
  });
}

export function useConsoleReply(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { body: string; internal: boolean }) => (await platformApi.post<TicketDetail>(`/support/tickets/${id}/messages`, body)).data,
    onSuccess: (data) => { qc.setQueryData([...keys.all, 'ticket', id], data); qc.invalidateQueries({ queryKey: [...keys.all, 'list'] }); qc.invalidateQueries({ queryKey: [...keys.all, 'counts'] }); },
  });
}

export function useConsoleUpdateTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { status?: TicketStatus; priority?: TicketPriority; assignedStaffId?: string | null }) =>
      (await platformApi.patch<TicketDetail>(`/support/tickets/${id}`, body)).data,
    onSuccess: (data) => { qc.setQueryData([...keys.all, 'ticket', id], data); qc.invalidateQueries({ queryKey: [...keys.all, 'list'] }); qc.invalidateQueries({ queryKey: [...keys.all, 'counts'] }); },
  });
}
