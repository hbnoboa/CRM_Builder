'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { platformApi } from '@/lib/platform-api';
import { platformKeys, usePlatformPlans } from '@/hooks/use-platform';
import { getErrorMessage } from '@/lib/get-error-message';
import { TENANT_LIFECYCLES, type TenantLifecycle } from '@/types/platform';

export type BulkAction = 'plan' | 'trial' | 'lifecycle';
interface BulkItem { id: string; name: string; from: string | null; to: string | null; reason?: string }
interface BulkResult { dryRun: boolean; total: number; change: BulkItem[]; skipped: BulkItem[]; failed: BulkItem[] }

const NO_PLAN = '__none__';

/**
 * Acao em massa do console: escolher o parametro, ver a previa (o que muda e o que
 * fica de fora) e so entao aplicar. `target`: empresas escolhidas ou todas de um plano.
 */
export function BulkDialog({ action, target, onClose, onDone }: {
  action: BulkAction;
  target: { tenantIds: string[] } | { fromPlanId: string; planName: string };
  onClose: () => void;
  onDone?: () => void;
}) {
  const t = useTranslations('platform.bulk');
  const tLife = useTranslations('platform.lifecycle');
  const locale = useLocale();
  const qc = useQueryClient();
  const { data: plans } = usePlatformPlans();
  const [planId, setPlanId] = useState<string>('');
  const [days, setDays] = useState(7);
  const [lifecycle, setLifecycle] = useState<TenantLifecycle | ''>('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [preview, setPreview] = useState<BulkResult | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  const body = (dryRun: boolean) => ({
    action, dryRun, ...target,
    ...(action === 'plan' ? { planId: planId === NO_PLAN ? null : planId } : {}),
    ...(action === 'trial' ? { days } : {}),
    ...(action === 'lifecycle' ? { lifecycle, ...(lifecycle === 'TRIAL' && trialEndsAt ? { trialEndsAt: new Date(trialEndsAt).toISOString() } : {}) } : {}),
  });
  const call = useMutation({
    mutationFn: async (dryRun: boolean) => (await platformApi.post<BulkResult>('/tenants/bulk', body(dryRun))).data,
  });
  const ready = action === 'plan' ? !!planId : action === 'trial' ? days >= 1 && days <= 365 : !!lifecycle && (lifecycle !== 'TRIAL' || !!trialEndsAt);
  const fmt = (v: string | null) => {
    if (!v) return '—';
    if (action === 'trial') return new Date(v).toLocaleDateString(locale);
    if (action === 'lifecycle') return tLife(v as TenantLifecycle);
    return v;
  };
  const reset = () => { setPreview(null); };

  const runPreview = () => call.mutate(true, { onSuccess: setPreview, onError: (e) => toast.error(getErrorMessage(e)) });
  const apply = () => call.mutate(false, {
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: platformKeys.all });
      onDone?.();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const scope = 'tenantIds' in target ? t('scopeSelected', { n: target.tenantIds.length }) : t('scopePlan', { plan: target.planName });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(`title.${action}`)}</DialogTitle>
          <DialogDescription>{scope}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-2 text-sm" data-testid="bulk-result">
            <p className="font-medium">{t('applied', { n: result.change.length })}</p>
            {result.skipped.length > 0 && <p className="text-muted-foreground">{t('skippedN', { n: result.skipped.length })}</p>}
            {result.failed.length > 0 && (
              <div className="space-y-1 text-destructive">
                <p>{t('failedN', { n: result.failed.length })}</p>
                {result.failed.map((f) => <p key={f.id} className="text-xs">{f.name}: {f.reason}</p>)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {action === 'plan' && (
              <div className="space-y-1">
                <Label>{t('toPlan')}</Label>
                <Select value={planId} onValueChange={(v) => { setPlanId(v); reset(); }}>
                  <SelectTrigger data-testid="bulk-plan"><SelectValue placeholder={t('choose')} /></SelectTrigger>
                  <SelectContent>
                    {(plans ?? []).filter((p) => p.isActive).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    <SelectItem value={NO_PLAN}>{t('noPlan')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {action === 'trial' && (
              <div className="space-y-1">
                <Label htmlFor="bulk-days">{t('days')}</Label>
                <Input id="bulk-days" type="number" min={1} max={365} value={days} onChange={(e) => { setDays(Number(e.target.value)); reset(); }} />
                <p className="text-xs text-muted-foreground">{t('daysHint')}</p>
              </div>
            )}
            {action === 'lifecycle' && (
              <>
                <div className="space-y-1">
                  <Label>{t('toLifecycle')}</Label>
                  <Select value={lifecycle} onValueChange={(v) => { setLifecycle(v as TenantLifecycle); reset(); }}>
                    <SelectTrigger data-testid="bulk-lifecycle"><SelectValue placeholder={t('choose')} /></SelectTrigger>
                    <SelectContent>{TENANT_LIFECYCLES.map((l) => <SelectItem key={l} value={l}>{tLife(l)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {lifecycle === 'TRIAL' && (
                  <div className="space-y-1">
                    <Label htmlFor="bulk-trial-end">{t('trialEnd')}</Label>
                    <Input id="bulk-trial-end" type="date" value={trialEndsAt} onChange={(e) => { setTrialEndsAt(e.target.value); reset(); }} />
                  </div>
                )}
                {(lifecycle === 'SUSPENDED' || lifecycle === 'CANCELED') && <p className="text-xs text-destructive">{t('blocksAccess')}</p>}
              </>
            )}

            {preview && (
              <div className="space-y-2 rounded-lg border p-3 text-sm" data-testid="bulk-preview">
                <p className="font-medium">{t('willChange', { n: preview.change.length })}</p>
                <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
                  {preview.change.map((c) => <li key={c.id}>{c.name}: {fmt(c.from)} → {fmt(c.to)}</li>)}
                </ul>
                {preview.skipped.length > 0 && (
                  <>
                    <p className="text-muted-foreground">{t('skippedN', { n: preview.skipped.length })}</p>
                    <ul className="max-h-24 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                      {preview.skipped.map((c) => <li key={c.id}>{c.name}: {t(`reason.${c.reason}`)}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={onClose} data-testid="bulk-close">{t('close')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
              {!preview ? (
                <Button disabled={!ready || call.isPending} onClick={runPreview} data-testid="bulk-preview-btn">
                  {call.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('preview')}
                </Button>
              ) : (
                <Button disabled={preview.change.length === 0 || call.isPending} onClick={apply} data-testid="bulk-apply"
                  variant={lifecycle === 'SUSPENDED' || lifecycle === 'CANCELED' ? 'destructive' : 'default'}>
                  {call.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('apply', { n: preview.change.length })}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
