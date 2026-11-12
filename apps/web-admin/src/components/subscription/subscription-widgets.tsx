'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Circle, Clock, Crown, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/tenant-navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscription } from '@/hooks/use-platform';
import { useUsers } from '@/hooks/use-users';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';
import { FEATURE_KEYS, type FeatureKey } from '@/types/platform';

function useTenantSlug() {
  const params = useParams();
  return typeof params?.tenant === 'string' ? params.tenant : undefined;
}

/** Funcoes do plano do tenant atual. Enquanto carrega, tudo liberado (a API e quem bloqueia). */
export function useTenantFeatures(): Record<FeatureKey, boolean> {
  const { data } = useSubscription(useTenantSlug());
  if (!data) return Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as Record<FeatureKey, boolean>;
  return data.features;
}

/** Faixa no topo durante o trial (e quando o pagamento esta pendente). */
export function TrialBanner() {
  const t = useTranslations('subscription.banner');
  const { data } = useSubscription(useTenantSlug());
  const { hasModulePermission } = usePermissions();

  if (!data) return null;
  if (data.lifecycle === 'PAST_DUE') {
    return (
      <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" data-testid="past-due-banner">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {t('pastDue')}
      </div>
    );
  }
  if (data.lifecycle !== 'TRIAL' || data.trialDaysLeft == null) return null;

  const urgent = data.trialDaysLeft <= 3;
  return (
    <div
      className={
        urgent
          ? 'flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'
          : 'flex flex-wrap items-center justify-center gap-2 border-b bg-nav-active/60 px-4 py-1.5 text-xs text-nav-active-foreground'
      }
      data-testid="trial-banner"
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span>{data.trialDaysLeft === 0 ? t('trialLastDay') : t('trial', { days: data.trialDaysLeft })}</span>
      {hasModulePermission('settings', 'canUpdate') && (
        <Link href="/gestao/plan" className="font-semibold underline-offset-2 hover:underline">{t('seePlan')} →</Link>
      )}
    </div>
  );
}

/** Aba "Plano" das configuracoes: plano, situacao, uso x limites e funcoes. */
export function SubscriptionPanel() {
  const t = useTranslations('subscription.panel');
  const tLife = useTranslations('platform.lifecycle');
  const tFeature = useTranslations('platform.features');
  const { data, isLoading } = useSubscription(useTenantSlug());

  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-lg bg-muted" />;

  const rows: Array<{ key: string; used: number; limit?: number | null }> = [
    { key: 'users', used: data.usage.users, limit: data.limits.maxUsers },
    { key: 'records', used: data.usage.records, limit: data.limits.maxRecords },
    { key: 'storage', used: data.usage.storageMb, limit: data.limits.maxStorageMb },
  ];

  return (
    <div className="space-y-4" data-testid="subscription-panel">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {data.plan?.name ?? t('noPlan')}
            <Badge variant={data.lifecycle === 'ACTIVE' ? 'success' : data.lifecycle === 'TRIAL' ? 'secondary' : 'warning'}>
              {tLife(data.lifecycle)}
            </Badge>
          </CardTitle>
          <CardDescription>
            {data.lifecycle === 'TRIAL' && data.trialDaysLeft != null
              ? t('trialLeft', { days: data.trialDaysLeft })
              : t('contact')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row) => {
            const pct = row.limit ? Math.min(100, Math.round((row.used / row.limit) * 100)) : 0;
            return (
              <div key={row.key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{t(`usage.${row.key}`)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.used.toLocaleString()}{row.key === 'storage' && ' MB'}
                    {row.limit == null ? ` · ${t('unlimited')}` : ` de ${row.limit.toLocaleString()}${row.key === 'storage' ? ' MB' : ''}`}
                  </span>
                </div>
                {row.limit != null && (
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={pct >= 90 ? 'h-full bg-destructive' : pct >= 75 ? 'h-full bg-amber-500' : 'h-full bg-primary'}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                {row.limit != null && pct >= 90 && <p className="text-xs text-destructive">{t('nearLimit')}</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('features')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {FEATURE_KEYS.map((key) => (
            <div key={key} className="flex items-start gap-2 text-sm">
              {data.features[key] ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className={data.features[key] ? '' : 'text-muted-foreground'}>
                {tFeature(`${key}.name`)}
                {!data.features[key] && <span className="block text-xs">{t('notIncluded')}</span>}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const ONBOARDING_DISMISSED_KEY = 'onboardingDismissed';

/** Primeiros passos para empresa nova (some quando tudo esta feito ou ao dispensar). */
export function OnboardingChecklist() {
  const t = useTranslations('subscription.onboarding');
  const slug = useTenantSlug();
  const { data } = useSubscription(slug);
  const { hasModulePermission, hasModuleAccess } = usePermissions();
  const [dismissed, setDismissed] = useState(true);

  const storageKey = `${ONBOARDING_DISMISSED_KEY}:${slug ?? ''}`;
  useEffect(() => {
    setDismissed(localStorage.getItem(storageKey) === '1');
  }, [storageKey]);

  // So para quem configura a empresa (nao para o usuario operacional).
  if (!data || dismissed || !hasModulePermission('entities', 'canCreate')) return null;

  const steps = [
    { key: 'table', done: data.usage.entities > 0, href: '/gestao/entities/new', show: true },
    { key: 'record', done: data.usage.records > 0, href: '/data', show: hasModuleAccess('data') },
    { key: 'team', done: data.usage.users > 1, href: '/gestao/users', show: hasModuleAccess('users') },
  ].filter((s) => s.show);

  if (steps.every((s) => s.done)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  return (
    <Card className="border-primary/40" data-testid="onboarding-checklist">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{t('title')}</CardTitle>
            <CardDescription>{t('progress', { done: doneCount, total: steps.length })}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={dismiss} title={t('dismiss')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className="flex items-start gap-3 rounded-md p-2 text-sm transition-colors hover:bg-muted"
          >
            {step.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <span>
              <span className={step.done ? 'block font-medium line-through opacity-60' : 'block font-medium'}>{t(`steps.${step.key}.title`)}</span>
              <span className="block text-muted-foreground">{t(`steps.${step.key}.description`)}</span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/** Dono da empresa (aba Plano). So o proprio dono transfere a propriedade. */
export function OwnershipCard() {
  const t = useTranslations('subscription.owner');
  const { tenant, refresh } = useTenant();
  const me = useAuthStore((st) => st.user);
  const iAmOwner = !!me && me.id === tenant?.ownerId;
  const { data } = useUsers();
  const [nextOwnerId, setNextOwnerId] = useState('');
  const [saving, setSaving] = useState(false);

  const members = (Array.isArray(data?.data) ? data.data : []).filter((u) => u.status === 'ACTIVE');
  const owner = members.find((u) => u.id === tenant?.ownerId);

  const transfer = async () => {
    setSaving(true);
    try {
      await api.patch('/tenants/me/owner', { userId: nextOwnerId });
      await refresh();
      setNextOwnerId('');
      toast.success(t('transferred'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="ownership-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Crown className="h-4 w-4" />
          {t('title')}
        </CardTitle>
        <CardDescription>
          {owner ? t('current', { name: owner.name || owner.email }) : t('none')}
        </CardDescription>
      </CardHeader>
      {iAmOwner && (
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('hint')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={nextOwnerId} onValueChange={setNextOwnerId}>
              <SelectTrigger className="sm:max-w-xs" data-testid="next-owner">
                <SelectValue placeholder={t('choose')} />
              </SelectTrigger>
              <SelectContent>
                {members.filter((u) => u.id !== me?.id).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email} · {u.customRole?.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={!nextOwnerId || saving} onClick={transfer} data-testid="transfer-owner">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('transfer')}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
