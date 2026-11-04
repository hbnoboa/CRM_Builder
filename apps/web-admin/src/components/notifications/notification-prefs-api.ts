import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface NotificationPrefs {
  events: { created: boolean; updated: boolean; deleted: boolean };
  mutedEntities: string[];
  ownActions: boolean;
  popups: boolean;
  push: boolean;
}

export const notificationPrefsKey = ['notifications', 'preferences'] as const;

export function useNotificationPrefs(enabled = true) {
  return useQuery({
    queryKey: notificationPrefsKey,
    queryFn: async () => (await api.get<NotificationPrefs>('/notifications/preferences')).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useSaveNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs) => (await api.put<NotificationPrefs>('/notifications/preferences', prefs)).data,
    onSuccess: (data) => qc.setQueryData(notificationPrefsKey, data),
  });
}
