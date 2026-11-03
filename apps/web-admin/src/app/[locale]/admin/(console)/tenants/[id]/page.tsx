'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LifecycleBadge, UsageLine, useFormatDate } from '@/components/platform/platform-ui';
import {
  useImpersonateTenantUser,
  useRecomputeTenantStorage,
  usePlatformAudit,
  usePlatformCan,
  usePlatformPlans,
  usePlatformTenant,
  usePlatformTenantMembers,
  useSetTenantFeatures,
  useSetTenantLifecycle,
  useSetTenantPlan,
  useUpdatePlatformTenant,
} from '@/hooks/use-platform';
import { getErrorMessage } from '@/lib/get-error-message';
import { startPlatformImpersonation } from '@/lib/platform-impersonation';
import { FEATURE_KEYS, TENANT_LIFECYCLES, type FeatureKey, type PlatformTenantDetail, type TenantLifecycle } from '@/types/platform';

const NO_PLAN = 'none';

export default function PlatformTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('platform.tenant');
  const formatDate = useFormatDate();
  const { data: tenant, isLoading } = usePlatformTenant(id);

  if (isLoading || !tenant) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/tenants" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold md:text-3xl">{tenant.name}</h1>
          <LifecycleBadge lifecycle={tenant.lifecycle} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {tenant.slug} · {t('since', { date: formatDate(tenant.createdAt) })}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <UsageCard tenant={tenant} />
        <LifecycleCard tenant={tenant} />
        <PlanCard tenant={tenant} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FeaturesCard tenant={tenant} />
        <DetailsCard tenant={tenant} />
      </div>

      <MembersCard tenantId={tenant.id} active={tenant.status === 'ACTIVE'} />
      <TenantAuditCard tenantId={tenant.id} />
    </div>
  );
}

function UsageCard({ tenant }: { tenant: PlatformTenantDetail }) {
  const t = useTranslations('platform.tenant.usage');
  const formatDate = useFormatDate();
  const can = usePlatformCan();
  const recompute = useRecomputeTenantStorage(tenant.id);

  const runRecompute = async () => {
    try {
      const result = await recompute.mutateAsync(undefined);
      toast.success(t('recomputed', { mb: result.storageMb }));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">{t('users')}</div>
          <UsageLine used={tenant.usage.users} limit={tenant.limits.maxUsers} />
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">{t('records')}</div>
          <UsageLine used={tenant.usage.records} limit={tenant.limits.maxRecords} />
        </div>
        <div data-testid="usage-storage">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('storage')}</span>
            {can('tenants.update') && (
              <button type="button" className="underline" onClick={runRecompute} disabled={recompute.isPending} data-testid="recompute-storage">
                {recompute.isPending ? t('recomputing') : t('recompute')}
              </button>
            )}
          </div>
          <UsageLine used={tenant.usage.storageMb ?? 0} limit={tenant.limits.maxStorageMb} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">{t('entities')}</div>
            <div className="tabular-nums">{tenant.usage.entities ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('lastAccess')}</div>
            <div>{formatDate(tenant.usage.lastLoginAt, true)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function LifecycleCard({ tenant }: { tenant: PlatformTenantDetail }) {
  const t = useTranslations('platform.tenant.lifecycle');
  const tLife = useTranslations('platform.lifecycle');
  const can = usePlatformCan();
  const save = useSetTenantLifecycle(tenant.id);
  const [lifecycle, setLifecycle] = useState<TenantLifecycle>(tenant.lifecycle);
  const [trialEnd, setTrialEnd] = useState(toDateInput(tenant.trialEndsAt));

  useEffect(() => {
    setLifecycle(tenant.lifecycle);
    setTrialEnd(toDateInput(tenant.trialEndsAt));
  }, [tenant.lifecycle, tenant.trialEndsAt]);

  const editable = can('tenants.lifecycle');
  const dirty = lifecycle !== tenant.lifecycle || (lifecycle === 'TRIAL' && trialEnd !== toDateInput(tenant.trialEndsAt));

  const submit = async () => {
    try {
      await save.mutateAsync({
        lifecycle,
        // Fim do dia escolhido, no fuso do navegador.
        ...(lifecycle === 'TRIAL' && trialEnd ? { trialEndsAt: new Date(`${trialEnd}T23:59:59`).toISOString() } : {}),
      });
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t(`hint.${lifecycle}`)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={lifecycle} onValueChange={(v) => setLifecycle(v as TenantLifecycle)} disabled={!editable}>
          <SelectTrigger data-testid="tenant-lifecycle-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TENANT_LIFECYCLES.map((l) => (
              <SelectItem key={l} value={l}>{tLife(l)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {lifecycle === 'TRIAL' && (
          <div className="space-y-1">
            <Label htmlFor="trial-end">{t('trialEnd')}</Label>
            <Input id="trial-end" type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} disabled={!editable} />
          </div>
        )}
        {editable && (
          <Button className="w-full" disabled={!dirty || save.isPending} onClick={submit} data-testid="tenant-lifecycle-save">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PlanCard({ tenant }: { tenant: PlatformTenantDetail }) {
  const t = useTranslations('platform.tenant.plan');
  const tLimits = useTranslations('platform.limits');
  const can = usePlatformCan();
  const { data: plans } = usePlatformPlans();
  const save = useSetTenantPlan(tenant.id);
  const [planId, setPlanId] = useState(tenant.plan?.id ?? NO_PLAN);

  useEffect(() => setPlanId(tenant.plan?.id ?? NO_PLAN), [tenant.plan?.id]);

  const editable = can('tenants.plan');
  const submit = async () => {
    try {
      await save.mutateAsync(planId === NO_PLAN ? null : planId);
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const limitText = (value?: number | null) => (value == null ? tLimits('unlimited') : value.toLocaleString());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>
          {tLimits('maxUsers')}: {limitText(tenant.limits.maxUsers)} · {tLimits('maxRecords')}: {limitText(tenant.limits.maxRecords)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={planId} onValueChange={setPlanId} disabled={!editable}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PLAN}>{t('none')}</SelectItem>
            {plans
              ?.filter((p) => p.isActive || p.id === tenant.plan?.id)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        {planId === NO_PLAN && <p className="text-xs text-muted-foreground">{t('noneHint')}</p>}
        {editable && (
          <Button className="w-full" disabled={planId === (tenant.plan?.id ?? NO_PLAN) || save.isPending} onClick={submit}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function FeaturesCard({ tenant }: { tenant: PlatformTenantDetail }) {
  const t = useTranslations('platform.tenant.features');
  const tFeature = useTranslations('platform.features');
  const can = usePlatformCan();
  const save = useSetTenantFeatures(tenant.id);
  const editable = can('tenants.features');

  const apply = async (feature: FeatureKey, value: boolean | null) => {
    try {
      await save.mutateAsync({ [feature]: value });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {FEATURE_KEYS.map((feature) => {
          const overridden = typeof tenant.featureOverrides?.[feature] === 'boolean';
          return (
            <div key={feature} className="flex items-center justify-between gap-3 py-2.5" data-testid={`feature-${feature}`}>
              <div className="min-w-0">
                <div className="text-sm font-medium">{tFeature(`${feature}.name`)}</div>
                <div className="text-xs text-muted-foreground">
                  {overridden ? (
                    <span className="inline-flex items-center gap-2">
                      <Badge variant="outline">{t('custom')}</Badge>
                      {editable && (
                        <button type="button" className="underline" onClick={() => apply(feature, null)} disabled={save.isPending}>
                          {t('reset')}
                        </button>
                      )}
                    </span>
                  ) : (
                    t('fromPlan')
                  )}
                </div>
              </div>
              <Switch
                checked={tenant.features[feature]}
                disabled={!editable || save.isPending}
                onCheckedChange={(checked) => apply(feature, checked)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function DetailsCard({ tenant }: { tenant: PlatformTenantDetail }) {
  const t = useTranslations('platform.tenant.details');
  const can = usePlatformCan();
  const save = useUpdatePlatformTenant(tenant.id);
  const [name, setName] = useState(tenant.name);
  const [domain, setDomain] = useState(tenant.domain ?? '');
  const editable = can('tenants.update');

  useEffect(() => {
    setName(tenant.name);
    setDomain(tenant.domain ?? '');
  }, [tenant.name, tenant.domain]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await save.mutateAsync({ name, domain: domain.trim() || null });
      toast.success(t('saved'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="tenant-name">{t('name')}</Label>
            <Input id="tenant-name" required value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tenant-domain">{t('domain')}</Label>
            <Input id="tenant-domain" placeholder="crm.cliente.com.br" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={!editable} />
          </div>
          <div className="space-y-1">
            <Label>{t('slug')}</Label>
            <Input value={tenant.slug} disabled />
            <p className="text-xs text-muted-foreground">{t('slugHint')}</p>
          </div>
          {editable && (
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function MembersCard({ tenantId, active }: { tenantId: string; active: boolean }) {
  const t = useTranslations('platform.tenant.members');
  const locale = useLocale();
  const formatDate = useFormatDate();
  const can = usePlatformCan();
  const { data: members, isLoading } = usePlatformTenantMembers(tenantId);
  const impersonate = useImpersonateTenantUser(tenantId);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const enterAs = async (userId: string) => {
    setPendingId(userId);
    try {
      const session = await impersonate.mutateAsync(userId);
      startPlatformImpersonation(session, locale);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setPendingId(null);
    }
  };

  const canEnter = can('tenants.impersonate') && active;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        {can('tenants.impersonate') && !active && <CardDescription>{t('inactiveHint')}</CardDescription>}
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('role')}</TableHead>
              <TableHead>{t('lastAccess')}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {members?.map((m) => {
              const usable = m.membershipStatus === 'ACTIVE' && m.status === 'ACTIVE';
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {m.role.name}
                    {!usable && <Badge variant="outline" className="ml-2">{t('inactive')}</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(m.lastLoginAt, true)}</TableCell>
                  <TableCell>
                    {canEnter && usable && (
                      <Button size="sm" variant="outline" disabled={pendingId !== null} onClick={() => enterAs(m.id)} data-testid={`impersonate-${m.email}`}>
                        {pendingId === m.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                        {t('enterAs')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function TenantAuditCard({ tenantId }: { tenantId: string }) {
  const t = useTranslations('platform.audit');
  const formatDate = useFormatDate();
  const { data } = usePlatformAudit({ tenantId, limit: 10 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('tenantTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data?.data.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
        {data?.data.map((row) => (
          <div key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span>
              <span className="font-medium">{row.staffName}</span> · {t.has(`actions.${row.action}`) ? t(`actions.${row.action}`) : row.action}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(row.createdAt, true)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
