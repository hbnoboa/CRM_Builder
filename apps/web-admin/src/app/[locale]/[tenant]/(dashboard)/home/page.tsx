'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, Database, Plus, ShieldCheck, TableProperties } from 'lucide-react';
import { Link } from '@/i18n/tenant-navigation';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OptionBadge } from '@/components/ui/option-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { OnboardingChecklist } from '@/components/subscription/subscription-widgets';
import { api } from '@/lib/api';

interface HomeTable {
  slug: string;
  name: string;
  namePlural: string | null;
  color: string | null;
  count: number;
  isSub: boolean;
}

interface HomeRecent {
  id: string;
  entitySlug: string;
  entityName: string;
  color: string | null;
  title: string | null;
  status: { label: string; color: string | null } | null;
  updatedAt: string;
}

/** "ha 5 min", "ontem"... no idioma da pessoa. */
function useRelativeTime() {
  const locale = useLocale();
  return useMemo(() => {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    return (iso: string) => {
      const diff = (new Date(iso).getTime() - Date.now()) / 1000;
      const abs = Math.abs(diff);
      if (abs < 60) return rtf.format(Math.round(diff), 'second');
      if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
      if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
      if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
      return new Date(iso).toLocaleDateString(locale);
    };
  }, [locale]);
}

/** Inicio da pessoa: lancar agora, registros recentes dela, tabelas e (admin) administracao. */
export default function HomePage() {
  const t = useTranslations('home');
  const locale = useLocale();
  const params = useParams();
  const tenantSlug = typeof params?.tenant === 'string' ? params.tenant : '';
  const { user } = useAuthStore();
  const { hasEntityPermission, hasModulePermission, canAccessAdminArea } = usePermissions();
  const relative = useRelativeTime();

  const { data, isLoading } = useQuery({
    queryKey: ['my-home', tenantSlug, user?.id],
    queryFn: async () => (await api.get<{ tables: HomeTable[]; recent: HomeRecent[] }>('/stats/my-home')).data,
    staleTime: 30_000,
  });

  const firstName = (user?.name || '').split(' ')[0] || user?.name || '';
  const today = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const tables = data?.tables ?? [];
  // Lancar agora: tabelas principais em que a pessoa pode criar (sub-tabelas nascem pelo registro pai)
  const quick = tables.filter((tb) => !tb.isSub && hasEntityPermission(tb.slug, 'canCreate')).slice(0, 4);
  const canCreateTable = hasModulePermission('entities', 'canCreate');

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground first-letter:uppercase">{today}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t('greeting', { name: firstName })}</h1>
      </div>

      <OnboardingChecklist />

      {quick.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t('quickTitle')}</h2>
          <div className="flex flex-wrap gap-2" data-testid="home-quick">
            {quick.map((tb) => (
              <Button key={tb.slug} asChild variant="outline" className="h-10 bg-card">
                <Link href={`/data?entity=${tb.slug}&novo=1`}>
                  <Plus className="mr-1.5 h-4 w-4 text-primary" />
                  {t('newIn', { name: tb.name })}
                </Link>
              </Button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Registros recentes da pessoa */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t('recentTitle')}</h2>
          <Card>
            {isLoading ? (
              <CardContent className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </CardContent>
            ) : data && data.recent.length > 0 ? (
              <ul className="divide-y" data-testid="home-recent">
                {data.recent.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/data?entity=${r.entitySlug}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" style={r.color ? { backgroundColor: r.color } : undefined} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title ?? r.entityName}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.entityName}</span>
                      </span>
                      {r.status && <OptionBadge label={r.status.label} color={r.status.color} className="hidden sm:inline-flex" />}
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {relative(r.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Clock className="h-5 w-5" />}
                title={t('recentTitle')}
                description={t('recentEmpty')}
                className="py-10"
              />
            )}
          </Card>
        </section>

        {/* Tabelas que a pessoa ve */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t('tablesTitle')}</h2>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : tables.length === 0 ? (
            <Card>
              <EmptyState
                icon={<TableProperties className="h-5 w-5" />}
                title={t('noTablesTitle')}
                description={canCreateTable ? t('noTablesAdmin') : t('noTablesUser')}
                action={canCreateTable ? (
                  <Button asChild size="sm"><Link href="/gestao/entities/new"><Plus className="mr-1.5 h-4 w-4" />{t('createTable')}</Link></Button>
                ) : undefined}
                className="py-10"
              />
            </Card>
          ) : (
            <div className="space-y-2" data-testid="home-tables">
              {tables.map((tb) => (
                <Link
                  key={tb.slug}
                  href={`/data?entity=${tb.slug}`}
                  className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/40"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-nav-active text-nav-active-foreground"
                    style={tb.color ? { backgroundColor: `color-mix(in srgb, ${tb.color} 14%, transparent)`, color: tb.color } : undefined}
                  >
                    <Database className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{tb.namePlural || tb.name}</span>
                    <span className="block text-xs text-muted-foreground">{t('recordsCount', { count: tb.count })}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {canAccessAdminArea && (
        <Link
          href="/gestao"
          className="group flex items-center gap-4 rounded-xl border border-dashed bg-card/50 px-5 py-4 transition-colors hover:border-primary/40 hover:bg-card"
          data-testid="home-admin"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-nav-active text-nav-active-foreground">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t('adminTitle')}</span>
            <span className="block text-xs text-muted-foreground">{t('adminDesc')}</span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
