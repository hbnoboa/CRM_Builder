'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Crown, Loader2, Search, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader, useFormatDate } from '@/components/platform/platform-ui';
import { usePeople, type PeopleParams } from '@/components/platform/people-api';
import { usePlatformTenants } from '@/hooks/use-platform';
import { useDebounce } from '@/hooks/use-debounce';

const ALL = '__all__';

/** Pessoas de todas as empresas: lista (mais recentes primeiro) com busca e filtros. */
export default function PeoplePage() {
  const t = useTranslations('people');
  const formatDate = useFormatDate();
  const [q, setQ] = useState('');
  const [tenantId, setTenantId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [mfa, setMfa] = useState(ALL);
  const [owner, setOwner] = useState(ALL);
  const [page, setPage] = useState(1);
  const query = useDebounce(q, 300);
  const { data: tenants } = usePlatformTenants({ limit: 100 });

  useEffect(() => setPage(1), [query, tenantId, status, mfa, owner]);

  const params: PeopleParams = {
    q: query.trim() || undefined,
    tenantId: tenantId === ALL ? undefined : tenantId,
    status: status === ALL ? undefined : (status as PeopleParams['status']),
    mfa: mfa === ALL ? undefined : (mfa as PeopleParams['mfa']),
    owner: owner === ALL ? undefined : 'true',
    page,
    limit: 20,
  };
  const { data, isLoading } = usePeople(params);

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} data-testid="people-search" />
        </div>
        <Select value={tenantId} onValueChange={setTenantId}>
          <SelectTrigger className="lg:w-52" data-testid="people-tenant-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allCompanies')}</SelectItem>
            {(tenants?.data ?? []).map((tn) => <SelectItem key={tn.id} value={tn.id}>{tn.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allStatus')}</SelectItem>
            {(['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const).map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mfa} onValueChange={setMfa}>
          <SelectTrigger className="lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allMfa')}</SelectItem>
            <SelectItem value="on">{t('mfaOnly')}</SelectItem>
            <SelectItem value="off">{t('mfaNone')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="lg:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('everyone')}</SelectItem>
            <SelectItem value="true">{t('ownersOnly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data && <p className="text-sm text-muted-foreground" data-testid="people-total">{t('total', { n: data.meta.total })}</p>}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.person')}</TableHead>
                <TableHead>{t('columns.companies')}</TableHead>
                <TableHead>{t('columns.lastLogin')}</TableHead>
                <TableHead>{t('columns.devices')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-testid="people-results">
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell>
                </TableRow>
              )}
              {!isLoading && data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground" data-testid="people-empty">{t('none')}</TableCell>
                </TableRow>
              )}
              {data?.data.map((p) => (
                <TableRow key={p.id} data-testid={`person-${p.email}`}>
                  <TableCell>
                    <Link href={`/admin/people/${p.id}`} className="flex items-center gap-1.5 font-medium hover:underline">
                      {p.name}
                      {p.mfaEnabled && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label={t('mfa')} />}
                    </Link>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-md flex-wrap gap-1.5">
                      {p.memberships.map((m) => (
                        <span key={m.tenant.id} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs">
                          {m.isOwner && <Crown className="h-3 w-3 text-amber-600" />}
                          {m.tenant.name} · {m.role}
                          {m.status !== 'ACTIVE' && ` (${t(`membership.${m.status}`)})`}
                        </span>
                      ))}
                      {p.memberships.length === 0 && <span className="text-xs text-muted-foreground">{t('noCompany')}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{p.lastLoginAt ? formatDate(p.lastLoginAt, true) : t('never')}</TableCell>
                  <TableCell className="text-sm">{p.activeSessions}</TableCell>
                  <TableCell>
                    {p.status === 'ACTIVE'
                      ? <span className="text-sm">{t('status.ACTIVE')}</span>
                      : <Badge variant="outline">{t(`status.${p.status}`)}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">{t('page', { page: data.meta.page, total: data.meta.totalPages })}</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>{t('previous')}</Button>
          <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((n) => n + 1)}>{t('next')}</Button>
        </div>
      )}
    </div>
  );
}
