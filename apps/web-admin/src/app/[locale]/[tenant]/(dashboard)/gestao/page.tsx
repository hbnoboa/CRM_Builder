'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronRight, Clock, FileText, Link2, ScrollText,
  Mail, Shield, TableProperties, UserX, Users, Zap,
} from 'lucide-react';
import { Link } from '@/i18n/tenant-navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useSubscription } from '@/hooks/use-platform';
import { useGestaoOverview } from '@/hooks/use-gestao';
import { useTenantFeatures } from '@/components/subscription/subscription-widgets';
import { GestaoPageHeader, UsageMeter } from '@/components/gestao/gestao-ui';
import { useFormatDate } from '@/components/platform/platform-ui';

const SHORTCUTS = [
  { key: 'users', section: 'users', icon: Users },
  { key: 'roles', section: 'roles', icon: Shield },
  { key: 'entities', section: 'entities', icon: TableProperties },
  { key: 'pdfTemplates', section: 'pdf-templates', icon: FileText, featureKey: 'pdf' as const },
  { key: 'dashboardTemplates', section: 'dashboard-templates', icon: BarChart3 },
  { key: 'publicLinks', section: 'public-links', icon: Link2, featureKey: 'publicLinks' as const },
  { key: 'auditLogs', section: 'audit-logs', icon: ScrollText },
];

export default function GestaoHomePage() {
  const t = useTranslations('gestao.home');
  const tNav = useTranslations('gestao.nav');
  const tAudit = useTranslations('auditLogsPage');
  const formatDate = useFormatDate();
  const params = useParams();
  const slug = typeof params?.tenant === 'string' ? params.tenant : undefined;
  const user = useAuthStore((s) => s.user);
  const { tenant } = useTenant();
  const { canAccessAdminSection } = usePermissions();
  const features = useTenantFeatures();
  const { data: sub } = useSubscription(slug);
  const { data: overview, isLoading } = useGestaoOverview();

  const pending = overview?.pending;
  const items = pending
    ? [
        pending.neverLoggedIn.count > 0 && {
          key: 'never', icon: UserX, section: 'users',
          text: t('pending.neverLoggedIn', { count: pending.neverLoggedIn.count }),
          detail: pending.neverLoggedIn.sample.map((u) => u.name || u.email).join(', '),
        },
        pending.pendingInvites > 0 && { key: 'invites', icon: Mail, section: 'users', text: t('pending.invites', { count: pending.pendingInvites }) },
        pending.inactive30 > 0 && { key: 'inactive', icon: Clock, section: 'users', text: t('pending.inactive30', { count: pending.inactive30 }) },
        pending.unusedRoles > 0 && { key: 'roles', icon: Shield, section: 'roles', text: t('pending.unusedRoles', { count: pending.unusedRoles }) },
        pending.failedRuns7d > 0 && { key: 'failed', icon: Zap, section: 'execution-logs', text: t('pending.failedRuns', { count: pending.failedRuns7d }) },
        sub?.lifecycle === 'TRIAL' && sub.trialDaysLeft != null && {
          key: 'trial', icon: AlertTriangle, section: 'plan', text: t('pending.trial', { days: sub.trialDaysLeft }),
        },
      ].filter((i): i is Exclude<typeof i, false | null | undefined> => !!i && canAccessAdminSection(i.section))
    : [];

  const shortcuts = SHORTCUTS.filter((s) => (!s.featureKey || features[s.featureKey]) && canAccessAdminSection(s.section));
  const actionLabel = (a: string) => (tAudit.has(`actions.${a}`) ? tAudit(`actions.${a}`) : a);
  const resourceLabel = (r: string) => (tAudit.has(`resources.${r}`) ? tAudit(`resources.${r}`) : r);

  return (
    <div className="space-y-6" data-testid="gestao-home">
      <GestaoPageHeader
        help="screen.admin"
        title={t('title', { name: user?.name?.split(' ')[0] ?? '' })}
        subtitle={t('subtitle', { company: tenant?.name ?? '' })}
      />

      {sub && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="gestao-usage">
          <UsageMeter label={t('usage.users')} used={sub.usage.users} limit={sub.limits.maxUsers} unlimited={t('usage.unlimited')} />
          <UsageMeter label={t('usage.records')} used={sub.usage.records} limit={sub.limits.maxRecords} unlimited={t('usage.unlimited')} />
          <UsageMeter label={t('usage.storage')} used={sub.usage.storageMb} limit={sub.limits.maxStorageMb} unit="MB" unlimited={t('usage.unlimited')} />
          <UsageMeter label={t('usage.entities')} used={sub.usage.entities} unlimited={t('usage.unlimited')} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" data-testid="gestao-pending">
          <CardHeader>
            <CardTitle className="text-base">{t('pending.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {isLoading && <Skeleton className="h-16" />}
            {!isLoading && items.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {t('pending.none')}
              </p>
            )}
            {items.map((item) => (
              <Link
                key={item.key}
                href={`/gestao/${item.section}`}
                className="flex items-start gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-muted"
                data-testid={`pending-${item.key}`}
              >
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span className="flex-1">
                  <span className="block font-medium">{item.text}</span>
                  {'detail' in item && item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" data-testid="gestao-activity">
          <CardHeader>
            <CardTitle className="text-base">{t('activity.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview?.activity === null && <p className="text-sm text-muted-foreground">{t('activity.noAccess')}</p>}
            {overview?.activity?.length === 0 && <p className="text-sm text-muted-foreground">{t('activity.empty')}</p>}
            {overview?.activity?.map((row) => (
              <div key={row.id} className="text-sm">
                <p>
                  <span className="font-medium">{row.userName ?? t('activity.system')}</span>
                  {' · '}{actionLabel(row.action)} {resourceLabel(row.resource).toLowerCase()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(row.createdAt, true)}
                  {row.impersonatedByName && ` · ${t('activity.by', { name: row.impersonatedByName })}`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>


      {shortcuts.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">{t('shortcuts')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shortcuts.map((s) => (
              <Link
                key={s.key}
                href={`/gestao/${s.section}`}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-zinc-800">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="font-medium">{tNav(s.key)}</span>
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
