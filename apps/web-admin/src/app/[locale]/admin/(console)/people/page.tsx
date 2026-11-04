'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Crown, Search, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/platform/platform-ui';
import { usePeopleSearch } from '@/components/platform/people-api';
import { useDebounce } from '@/hooks/use-debounce';

export default function PeoplePage() {
  const t = useTranslations('people');
  const locale = useLocale();
  const [q, setQ] = useState('');
  const query = useDebounce(q, 300);
  const { data, isFetching } = usePeopleSearch(query);
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : t('never'));

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus className="pl-9" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} data-testid="people-search" />
      </div>
      {query.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
      ) : data && data.length === 0 && !isFetching ? (
        <p className="text-sm text-muted-foreground" data-testid="people-empty">{t('none')}</p>
      ) : (
        <div className="space-y-2" data-testid="people-results">
          {data?.map((p) => (
            <Link key={p.id} href={`/admin/people/${p.id}`} className="block" data-testid={`person-${p.email}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {p.name}
                      {p.status !== 'ACTIVE' && <Badge variant="outline">{t(`status.${p.status}`)}</Badge>}
                      {p.mfaEnabled && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label={t('mfa')} />}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{p.email}</p>
                    <p className="text-xs text-muted-foreground">{t('lastLogin', { when: when(p.lastLoginAt) })} · {t('devices', { n: p.activeSessions })}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:max-w-md md:justify-end">
                    {p.memberships.map((m) => (
                      <span key={m.tenant.id} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs">
                        {m.isOwner && <Crown className="h-3 w-3 text-amber-600" />}
                        {m.tenant.name} · {m.role}
                        {m.status !== 'ACTIVE' && ` (${t(`membership.${m.status}`)})`}
                      </span>
                    ))}
                    {p.memberships.length === 0 && <span className="text-xs text-muted-foreground">{t('noCompany')}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
