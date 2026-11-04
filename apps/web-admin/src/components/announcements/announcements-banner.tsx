'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, Megaphone, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

interface ActiveAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  dismissible: boolean;
  linkUrl: string | null;
  linkLabel: string | null;
}

const KEY = ['announcements', 'active'] as const;

const STYLE = {
  INFO: { box: 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100', Icon: Megaphone },
  WARNING: { box: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100', Icon: AlertTriangle },
  CRITICAL: { box: 'border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100', Icon: AlertOctagon },
} as const;

/** Comunicados da plataforma ativos para a pessoa (faixas no topo). */
export function AnnouncementsBanner() {
  const t = useTranslations('announcements');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<ActiveAnnouncement[]>('/announcements/active')).data,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
  const dismiss = useMutation({
    mutationFn: async (id: string) => api.post(`/announcements/${id}/dismiss`),
    onMutate: (id) => qc.setQueryData<ActiveAnnouncement[]>(KEY, (prev) => prev?.filter((a) => a.id !== id)),
    onError: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  if (!data?.length) return null;
  return (
    <div data-testid="announcements">
      {data.map((a) => {
        const { box, Icon } = STYLE[a.severity];
        return (
          <div key={a.id} className={cn('flex items-start gap-3 border-b px-4 py-2 text-sm', box)} data-testid={`announcement-${a.severity}`} role={a.severity === 'CRITICAL' ? 'alert' : 'status'}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-semibold">{a.title}</span>
              <span className="mx-1">—</span>
              <span className="whitespace-pre-line">{a.body}</span>
              {a.linkUrl && (
                <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" className="ml-2 font-medium underline">
                  {a.linkLabel || t('more')}
                </a>
              )}
            </div>
            {a.dismissible && (
              <button type="button" onClick={() => dismiss.mutate(a.id)} className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100" aria-label={t('dismiss')} data-testid="announcement-dismiss">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
