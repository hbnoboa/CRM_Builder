'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TicketMessage } from './support-types';

/** Conversa do chamado. `viewer` decide de que lado ficam as mensagens. */
export function TicketThread({ messages, viewer }: { messages: TicketMessage[]; viewer: 'customer' | 'staff' }) {
  const t = useTranslations('support');
  const locale = useLocale();
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="space-y-3" data-testid="ticket-thread">
      {messages.map((m) => {
        if (m.authorType === 'system') {
          const [kind, value] = m.body.split(':');
          const statusLabel = viewer === 'staff' ? t(`console.statuses.${value}`) : t(`status.${value}`);
          const text = kind === 'status' ? t('system.status', { name: m.authorName, status: statusLabel })
            : kind === 'resolved_by_customer' ? t('system.resolvedByCustomer', { name: m.authorName })
              : kind === 'assigned' ? (value ? t('system.assigned', { name: m.authorName }) : t('system.unassigned', { name: m.authorName }))
                : m.body;
          return (
            <p key={m.id} className="text-center text-xs text-muted-foreground" data-testid="ticket-system">
              {text} · {when(m.createdAt)}
            </p>
          );
        }
        const mine = m.authorType === viewer;
        return (
          <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-lg border px-3 py-2 text-sm',
                m.internal ? 'border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100'
                  : mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
              data-testid={m.internal ? 'ticket-note' : `ticket-msg-${m.authorType}`}
            >
              <p className="mb-1 flex items-center gap-1 text-xs opacity-80">
                {m.internal && <Lock className="h-3 w-3" />}
                {m.authorType === 'staff' && viewer === 'customer' ? t('supportTeam', { name: m.authorName }) : m.authorName}
                {m.internal && ` · ${t('internalNote')}`} · {when(m.createdAt)}
              </p>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
