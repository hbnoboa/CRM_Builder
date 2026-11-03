'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LifecycleBadge, PageHeader, useFormatDate } from '@/components/platform/platform-ui';
import { usePlatformOverview } from '@/hooks/use-platform';
import { TENANT_LIFECYCLES } from '@/types/platform';

export default function PlatformOverviewPage() {
  const t = useTranslations('platform.overview');
  const tLife = useTranslations('platform.lifecycle');
  const formatDate = useFormatDate();
  const { data, isLoading } = usePlatformOverview();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const stats = [
    { label: t('totalTenants'), value: data.tenants.total },
    { label: tLife('ACTIVE'), value: data.tenants.byLifecycle.ACTIVE },
    { label: tLife('TRIAL'), value: data.tenants.byLifecycle.TRIAL },
    { label: t('activeUsers'), value: data.activeMemberships },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="platform-stats">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{s.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-2 p-5 text-sm">
          {TENANT_LIFECYCLES.map((l) => (
            <Link key={l} href={`/admin/tenants?lifecycle=${l}`} className="flex items-center gap-2 hover:underline">
              <LifecycleBadge lifecycle={l} />
              <span className="tabular-nums">{data.tenants.byLifecycle[l]}</span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('trialsEnding')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.trialsEnding.length === 0 && <p className="text-sm text-muted-foreground">{t('none')}</p>}
            {data.trialsEnding.map((tenant) => (
              <Link key={tenant.id} href={`/admin/tenants/${tenant.id}`} className="flex items-center justify-between rounded-md p-2 text-sm hover:bg-muted">
                <span className="font-medium">{tenant.name}</span>
                <span className="text-muted-foreground">{formatDate(tenant.trialEndsAt)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('recentSignups')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentSignups.length === 0 && <p className="text-sm text-muted-foreground">{t('none')}</p>}
            {data.recentSignups.map((tenant) => (
              <Link key={tenant.id} href={`/admin/tenants/${tenant.id}`} className="flex items-center justify-between gap-2 rounded-md p-2 text-sm hover:bg-muted">
                <span className="truncate font-medium">{tenant.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <LifecycleBadge lifecycle={tenant.lifecycle} />
                  <span className="text-muted-foreground">{formatDate(tenant.createdAt)}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
