'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LifeBuoy, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useRouter } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTicket, useMyTickets } from '@/components/support/support-api';
import { TicketPriorityBadge, TicketStatusBadge } from '@/components/support/ticket-badges';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, type TicketPriority } from '@/components/support/support-types';
import { getErrorMessage } from '@/lib/get-error-message';
import { HelpButton } from '@/components/help/help-button';

export default function SupportPage() {
  const t = useTranslations('support');
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const { data, isLoading } = useMyTickets(tab);
  const create = useCreateTicket();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'question', priority: 'NORMAL' as TicketPriority, body: '' });

  const submit = () => create.mutate(form, {
    onSuccess: (ticket) => {
      toast.success(t('created', { number: ticket.number }));
      setOpen(false);
      setForm({ subject: '', category: 'question', priority: 'NORMAL', body: '' });
      router.push(`/support/${ticket.id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl"><LifeBuoy className="h-6 w-6" /> {t('title')}<HelpButton topic="screen.support" /></h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">{data?.seesAll ? t('subtitleAll') : t('subtitle')}</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="ticket-new"><Plus className="mr-2 h-4 w-4" /> {t('new')}</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'open' | 'closed')}>
        <TabsList>
          <TabsTrigger value="open" data-testid="tickets-tab-open">{t('tabs.open')}</TabsTrigger>
          <TabsTrigger value="closed" data-testid="tickets-tab-closed">{t('tabs.closed')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : !data?.data.length ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground" data-testid="tickets-empty">{tab === 'open' ? t('emptyOpen') : t('emptyClosed')}</CardContent></Card>
      ) : (
        <div className="space-y-2" data-testid="tickets-list">
          {data.data.map((tk) => (
            <Link key={tk.id} href={`/support/${tk.id}`} className="block" data-testid={`ticket-${tk.number}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="text-muted-foreground">#{tk.number}</span>
                      <span className="truncate">{tk.subject}</span>
                      <TicketPriorityBadge priority={tk.priority} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`category.${tk.category}`)}
                      {data.seesAll && ` · ${tk.createdByName}`}
                      {' · '}{t('updated', { when: new Date(tk.lastMessageAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) })}
                      {tk.lastMessageBy === 'staff' && tk.status === 'WAITING_CUSTOMER' && ` · ${t('newReply')}`}
                    </p>
                  </div>
                  <TicketStatusBadge status={tk.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('new')}</DialogTitle>
            <DialogDescription>{t('newHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ticket-subject">{t('subject')}</Label>
              <Input id="ticket-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t('categoryLabel')}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="ticket-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`category.${c}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t('priorityLabel')}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}>
                  <SelectTrigger data-testid="ticket-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ticket-body">{t('message')}</Label>
              <Textarea id="ticket-body" rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={t('messagePlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button disabled={form.subject.trim().length < 3 || form.body.trim().length < 3 || create.isPending} onClick={submit} data-testid="ticket-submit">
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
