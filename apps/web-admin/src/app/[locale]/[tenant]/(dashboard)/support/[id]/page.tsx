'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useReplyTicket, useResolveTicket, useTicket } from '@/components/support/support-api';
import { TicketPriorityBadge, TicketStatusBadge } from '@/components/support/ticket-badges';
import { TicketThread } from '@/components/support/ticket-thread';
import { getErrorMessage } from '@/lib/get-error-message';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('support');
  const { data: ticket, isLoading } = useTicket(id);
  const reply = useReplyTicket(id);
  const resolve = useResolveTicket(id);
  const [body, setBody] = useState('');

  if (isLoading || !ticket) return <Skeleton className="h-96" />;
  const closed = ticket.status === 'CLOSED';
  const finished = closed || ticket.status === 'RESOLVED';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">#{ticket.number} · {ticket.subject}</h1>
          <p className="text-sm text-muted-foreground">{t(`category.${ticket.category}`)} · {ticket.createdByName}</p>
        </div>
        <div className="flex items-center gap-2">
          <TicketPriorityBadge priority={ticket.priority} />
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      <Card><CardContent className="p-4"><TicketThread messages={ticket.messages} viewer="customer" /></CardContent></Card>

      {closed ? (
        <p className="text-center text-sm text-muted-foreground" data-testid="ticket-closed">{t('closedHint')}</p>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-4">
            {finished && <p className="text-sm text-muted-foreground">{t('reopenHint')}</p>}
            <Textarea id="ticket-reply" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('replyPlaceholder')} />
            <div className="flex flex-wrap justify-between gap-2">
              {!finished ? (
                <Button variant="outline" onClick={() => resolve.mutate(undefined, { onSuccess: () => toast.success(t('resolved')), onError: (e) => toast.error(getErrorMessage(e)) })} disabled={resolve.isPending} data-testid="ticket-resolve">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> {t('markResolved')}
                </Button>
              ) : <span />}
              <Button
                disabled={!body.trim() || reply.isPending}
                onClick={() => reply.mutate(body, { onSuccess: () => setBody(''), onError: (e) => toast.error(getErrorMessage(e)) })}
                data-testid="ticket-send"
              >
                {reply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{t('send')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
