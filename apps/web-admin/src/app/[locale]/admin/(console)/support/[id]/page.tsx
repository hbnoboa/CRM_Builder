'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, Lock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformCan, usePlatformMe } from '@/hooks/use-platform';
import { useConsoleReply, useConsoleTicket, useConsoleUpdateTicket } from '@/components/support/console-support-api';
import { TicketStatusBadge } from '@/components/support/ticket-badges';
import { TicketThread } from '@/components/support/ticket-thread';
import { TICKET_PRIORITIES, TICKET_STATUSES, type TicketPriority, type TicketStatus } from '@/components/support/support-types';
import { getErrorMessage } from '@/lib/get-error-message';

export default function ConsoleTicketPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('support');
  const tc = useTranslations('support.console');
  const can = usePlatformCan();
  const { data: me } = usePlatformMe();
  const { data: ticket, isLoading } = useConsoleTicket(id);
  const reply = useConsoleReply(id);
  const update = useConsoleUpdateTicket(id);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const canReply = can('support.reply');

  if (isLoading || !ticket) return <Skeleton className="h-96" />;
  const onErr = (e: unknown) => toast.error(getErrorMessage(e));

  return (
    <div className="space-y-4">
      <Link href="/admin/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> {tc('back')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">#{ticket.number} · {ticket.subject}</h1>
          <p className="text-sm text-muted-foreground">
            {t(`category.${ticket.category}`)} · {ticket.createdByName} ({ticket.createdByEmail})
          </p>
        </div>
        <TicketStatusBadge status={ticket.status} viewer="staff" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card><CardContent className="p-4"><TicketThread messages={ticket.messages} viewer="staff" /></CardContent></Card>
          {canReply && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <Textarea id="console-reply" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={internal ? tc('notePlaceholder') : tc('replyPlaceholder')} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch id="console-internal" checked={internal} onCheckedChange={setInternal} data-testid="console-internal" />
                    <Label htmlFor="console-internal" className="flex items-center gap-1 text-sm"><Lock className="h-3 w-3" /> {tc('internal')}</Label>
                  </div>
                  <Button
                    disabled={!body.trim() || reply.isPending}
                    onClick={() => reply.mutate({ body, internal }, { onSuccess: () => { setBody(''); toast.success(internal ? tc('noteSaved') : tc('replySent')); }, onError: onErr })}
                    data-testid="console-send"
                  >
                    {reply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {internal ? tc('saveNote') : tc('sendReply')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{tc('customer')}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {ticket.tenant && (
                <Link href={`/admin/tenants/${ticket.tenant.id}`} className="font-medium hover:underline" data-testid="console-ticket-tenant">{ticket.tenant.name}</Link>
              )}
              <p className="text-muted-foreground">{ticket.tenant?.plan?.name ?? tc('noPlan')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{tc('handling')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>{tc('status')}</Label>
                <Select value={ticket.status} disabled={!canReply} onValueChange={(v) => update.mutate({ status: v as TicketStatus }, { onError: onErr })}>
                  <SelectTrigger data-testid="console-set-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{tc(`statuses.${s}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{tc('priority')}</Label>
                <Select value={ticket.priority} disabled={!canReply} onValueChange={(v) => update.mutate({ priority: v as TicketPriority }, { onError: onErr })}>
                  <SelectTrigger data-testid="console-set-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {canReply && me && (
                ticket.assignedStaffId === me.id ? (
                  <Button variant="outline" className="w-full" onClick={() => update.mutate({ assignedStaffId: null }, { onError: onErr })} data-testid="console-unassign">{tc('release')}</Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => update.mutate({ assignedStaffId: me.id }, { onError: onErr })} data-testid="console-assign-me">{tc('takeIt')}</Button>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
