import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-api';

export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AudienceType = 'all' | 'plans' | 'lifecycles' | 'tenants';
export interface Audience { type: AudienceType; ids: string[] }

export interface ConsoleAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  audience: Audience;
  adminsOnly: boolean;
  dismissible: boolean;
  linkUrl: string | null;
  linkLabel: string | null;
  startsAt: string;
  endsAt: string | null;
  publishedAt: string | null;
  createdByName: string;
  dismissals: number;
  reach: number;
  state: 'draft' | 'scheduled' | 'active' | 'ended';
}

export type AnnouncementForm = Pick<ConsoleAnnouncement, 'title' | 'body' | 'severity' | 'audience' | 'adminsOnly' | 'dismissible' | 'linkUrl' | 'linkLabel' | 'startsAt' | 'endsAt'>;

const KEY = ['platform', 'announcements'] as const;

export function useConsoleAnnouncements() {
  return useQuery({ queryKey: KEY, queryFn: async () => (await platformApi.get<ConsoleAnnouncement[]>('/announcements')).data });
}

export function useAnnouncementReach(audience: Audience) {
  return useQuery({
    queryKey: [...KEY, 'reach', audience],
    queryFn: async () => (await platformApi.post<{ tenants: number }>('/announcements/reach', audience)).data,
    enabled: audience.type === 'all' || audience.ids.length > 0,
  });
}

export function useSaveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: AnnouncementForm & { id?: string }) =>
      (id ? await platformApi.patch(`/announcements/${id}`, body) : await platformApi.post('/announcements', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePublishAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => (await platformApi.post(`/announcements/${id}/publish`, { published })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await platformApi.delete(`/announcements/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
