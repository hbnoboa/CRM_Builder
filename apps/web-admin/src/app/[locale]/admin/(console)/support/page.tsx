'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/platform/platform-ui';
import { useConsoleTicketCounts, useConsoleTickets } from '@/components/support/console-support-api';
import { TicketPriorityBadge, TicketStatusBadge } from '@/components/support/ticket-badges';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '@/components/support/support-types';
import { useDebounce } from '@/hooks/use-debounce';

const ALL = '__all__';

export default function ConsoleSupportPage() {
  const t = useTranslations('support');
  const tc = useTranslations('support.console');
  const locale = useLocale();
  const [status, setStatus] = useState('active');
  const [priority, setPriority] = useState(ALL);
  const [assigned, setAssigned] = useState(ALL);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search, 300);
  useEffect(() => setPage(1), [status, priority, assigned, q]);
  const { data } = useConsoleTickets({
    status: status === ALL ? undefined : status,
    priority: priority === ALL ? undefined : priority,
    assigned: assigned === ALL ? undefined : assigned,
    search: q || undefined,
    page,
  });
  const { data: counts } = useConsoleTicketCounts(true);
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="space-y-6">
      <PageHeader title={tc('title')} subtitle={counts ? tc('subtitle', { open: counts.open, unassigned: counts.unassigned }) : undefined} />
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={tc('search')} value={search} onChange={(e) => setSearch(e.target.value)} data-testid="console-ticket-search" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="lg:w-52" data-testid="console-ticket-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{tc('active')}</SelectItem>
            {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{tc(`statuses.${s}`)}</SelectItem>)}
            <SelectItem value={ALL}>{tc('allStatuses')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{tc('allPriorities')}</SelectItem>
            {TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assigned} onValueChange={setAssigned}>
          <SelectTrigger className="lg:w-44" data-testid="console-ticket-assigned"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{tc('anyone')}</SelectItem>
            <SelectItem value="me">{tc('mine')}</SelectItem>
            <SelectItem value="none">{tc('unassigned')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc('ticket')}</TableHead>
                <TableHead>{tc('customer')}</TableHead>
                <TableHead>{tc('status')}</TableHead>
                <TableHead>{tc('assignee')}</TableHead>
                <TableHead>{tc('lastActivity')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="console-tickets">
              {data?.data.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{tc('empty')}</TableCell></TableRow>
              )}
              {data?.data.map((tk) => (
                <TableRow key={tk.id} data-testid={`console-ticket-${tk.number}`}>
                  <TableCell className="min-w-56">
                    <Link href={`/admin/support/${tk.id}`} className="font-medium hover:underline">#{tk.number} · {tk.subject}</Link>
                    <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                      {t(`category.${tk.category}`)} <TicketPriorityBadge priority={tk.priority} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{tk.tenant.name}</div>
                    <div className="text-xs text-muted-foreground">{tk.createdByName}</div>
                  </TableCell>
                  <TableCell><TicketStatusBadge status={tk.status} viewer="staff" /></TableCell>
                  <TableCell className="text-sm">{tk.assignedStaffName ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {when(tk.lastMessageAt)}
                    <div className="text-xs text-muted-foreground">{tk.lastMessageBy === 'customer' ? tc('byCustomer') : tc('byStaff')}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      {(data?.meta.totalPages ?? 1) > 1 && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{tc('prev')}</Button>
          <Button size="sm" variant="outline" disabled={page >= (data?.meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>{tc('next')}</Button>
        </div>
      )}
    </div>
  );
}
