'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/platform/platform-ui';
import { usePlatformCan, usePlatformPlans, useSavePlan } from '@/hooks/use-platform';
import { getErrorMessage } from '@/lib/get-error-message';
import { FEATURE_KEYS, LIMIT_KEYS, type FeatureKey, type LimitKey, type Plan } from '@/types/platform';

export default function PlatformPlansPage() {
  const t = useTranslations('platform.plans');
  const tFeature = useTranslations('platform.features');
  const tLimits = useTranslations('platform.limits');
  const can = usePlatformCan();
  const { data: plans, isLoading } = usePlatformPlans();
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);

  const limitText = (value?: number | null) => (value == null ? tLimits('unlimited') : value.toLocaleString());

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          can('plans.manage') && (
            <Button onClick={() => setEditing('new')} data-testid="platform-new-plan">
              <Plus className="mr-2 h-4 w-4" />
              {t('new')}
            </Button>
          )
        }
      />

      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {plans?.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans?.map((plan) => (
          <Card key={plan.id} className={plan.isActive ? '' : 'opacity-60'} data-testid={`plan-${plan.slug}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription>{plan.description || plan.slug}</CardDescription>
                </div>
                {can('plans.manage') && (
                  <Button variant="ghost" size="icon" onClick={() => setEditing(plan)} title={t('edit')}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {plan.isDefault && <Badge>{t('default')}</Badge>}
                {!plan.isActive && <Badge variant="outline">{t('inactive')}</Badge>}
                <Badge variant="secondary">{t('tenantsCount', { count: plan._count?.tenants ?? 0 })}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1">
                {LIMIT_KEYS.map((key) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{tLimits(key)}</span>
                    <span className="tabular-nums">{limitText(plan.limits[key])}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FEATURE_KEYS.map((key) => (
                  <Badge key={key} variant={plan.features[key] === false ? 'outline' : 'success'} className={plan.features[key] === false ? 'line-through' : ''}>
                    {tFeature(`${key}.name`)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PlanDialog plan={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

interface PlanForm {
  name: string;
  slug: string;
  description: string;
  limits: Record<LimitKey, string>;
  features: Record<FeatureKey, boolean>;
  isDefault: boolean;
  isActive: boolean;
}

function toForm(plan: Plan | null): PlanForm {
  return {
    name: plan?.name ?? '',
    slug: plan?.slug ?? '',
    description: plan?.description ?? '',
    limits: Object.fromEntries(LIMIT_KEYS.map((k) => [k, plan?.limits[k] != null ? String(plan.limits[k]) : ''])) as Record<LimitKey, string>,
    features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, plan?.features[k] !== false])) as Record<FeatureKey, boolean>,
    isDefault: plan?.isDefault ?? false,
    isActive: plan?.isActive ?? true,
  };
}

function PlanDialog({ plan, onClose }: { plan: Plan | 'new' | null; onClose: () => void }) {
  const t = useTranslations('platform.plans.form');
  const tFeature = useTranslations('platform.features');
  const tLimits = useTranslations('platform.limits');
  const save = useSavePlan();
  const existing = plan && plan !== 'new' ? plan : null;
  const [form, setForm] = useState<PlanForm>(toForm(existing));

  useEffect(() => setForm(toForm(existing)), [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const limits = Object.fromEntries(
      LIMIT_KEYS.map((k) => [k, form.limits[k].trim() === '' ? null : Number(form.limits[k])]),
    );
    try {
      await save.mutateAsync({
        ...(existing ? { id: existing.id } : { slug: form.slug }),
        name: form.name,
        description: form.description || undefined,
        limits,
        features: form.features,
        isDefault: form.isDefault,
        isActive: form.isActive,
      });
      toast.success(t('saved'));
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={plan !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{existing ? t('editTitle') : t('newTitle')}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="plan-name">{t('name')}</Label>
              <Input id="plan-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-slug">{t('slug')}</Label>
              <Input
                id="plan-slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                disabled={!!existing}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan-description">{t('description')}</Label>
            <Textarea id="plan-description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{t('limits')}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {LIMIT_KEYS.map((key) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`limit-${key}`}>{tLimits(key)}</Label>
                  <Input
                    id={`limit-${key}`}
                    type="number"
                    min={0}
                    step={1}
                    placeholder={tLimits('unlimited')}
                    value={form.limits[key]}
                    onChange={(e) => setForm({ ...form, limits: { ...form.limits, [key]: e.target.value } })}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('limitsHint')}</p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{t('features')}</div>
            <div className="divide-y rounded-lg border">
              {FEATURE_KEYS.map((key) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2">
                  <span>
                    <span className="block text-sm">{tFeature(`${key}.name`)}</span>
                    <span className="block text-xs text-muted-foreground">{tFeature(`${key}.description`)}</span>
                  </span>
                  <Switch
                    checked={form.features[key]}
                    onCheckedChange={(checked) => setForm({ ...form, features: { ...form.features, [key]: checked } })}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm">{t('isDefault')}</span>
                <span className="block text-xs text-muted-foreground">{t('isDefaultHint')}</span>
              </span>
              <Switch checked={form.isDefault} onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })} />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm">{t('isActive')}</span>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
            </label>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
