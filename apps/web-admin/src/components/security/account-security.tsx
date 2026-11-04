'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, Loader2, LogOut, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFormatDate } from '@/components/platform/platform-ui';
import { getErrorMessage } from '@/lib/get-error-message';
import { MfaSetupFlow, RecoveryCodes } from './mfa-setup';
import { describeDevice, securityApi } from './security-api';

/** Cartao "Verificacao em duas etapas" da propria conta. */
export function MfaCard() {
  const t = useTranslations('security.mfa');
  const qc = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: ['security', 'mfa'], queryFn: securityApi.mfaStatus });
  const [setupOpen, setSetupOpen] = useState(false);
  const [dialog, setDialog] = useState<'disable' | 'codes' | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['security', 'mfa'] });

  const disable = useMutation({
    mutationFn: () => securityApi.mfaDisable({ password, code: code.trim() }),
    onSuccess: () => { toast.success(t('disabled')); closeDialog(); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const regen = useMutation({
    mutationFn: () => securityApi.recoveryCodes(code.trim()),
    onSuccess: (r) => { setNewCodes(r.recoveryCodes); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const closeDialog = () => { setDialog(null); setPassword(''); setCode(''); setNewCodes(null); };

  return (
    <Card data-testid="mfa-card">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {t('title')}
          {status && (status.enabled
            ? <Badge variant="success" className="gap-1"><ShieldCheck className="h-3 w-3" />{t('on')}</Badge>
            : <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3 w-3" />{t('off')}</Badge>)}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {status?.requiredByCompany && !status.enabled && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t('requiredHint')}</p>
        )}
        {status && !status.enabled && (setupOpen
          ? <MfaSetupFlow onDone={() => { setSetupOpen(false); refresh(); }} />
          : <Button onClick={() => setSetupOpen(true)} data-testid="mfa-open-setup">{t('enable')}</Button>)}
        {status?.enabled && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="w-full text-sm text-muted-foreground">{t('codesLeft', { count: status.recoveryCodesLeft })}</p>
            <Button variant="outline" size="sm" onClick={() => setDialog('codes')}>{t('newCodes')}</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDialog('disable')} data-testid="mfa-disable">{t('disable')}</Button>
          </div>
        )}
      </CardContent>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === 'disable' ? t('disableTitle') : t('newCodesTitle')}</DialogTitle>
            <DialogDescription>{dialog === 'disable' ? t('disableHint') : t('newCodesHint')}</DialogDescription>
          </DialogHeader>
          {newCodes ? (
            <>
              <RecoveryCodes codes={newCodes} />
              <DialogFooter><Button onClick={closeDialog}>{t('done')}</Button></DialogFooter>
            </>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); if (dialog === 'disable') disable.mutate(); else regen.mutate(); }}
            >
              {dialog === 'disable' && (
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-password">{t('password')}</Label>
                  <Input id="mfa-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="mfa-code-dialog">{t('codeLabel')}</Label>
                <Input id="mfa-code-dialog" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono tracking-widest" />
              </div>
              <DialogFooter>
                <Button type="submit" variant={dialog === 'disable' ? 'destructive' : 'default'} disabled={disable.isPending || regen.isPending || code.trim().length < 6} data-testid="mfa-dialog-submit">
                  {(disable.isPending || regen.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {dialog === 'disable' ? t('disable') : t('generate')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Cartao "Aparelhos conectados". */
export function SessionsCard() {
  const t = useTranslations('security.sessions');
  const formatDate = useFormatDate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['security', 'sessions'], queryFn: securityApi.sessions });
  const refresh = () => qc.invalidateQueries({ queryKey: ['security', 'sessions'] });
  const revoke = useMutation({
    mutationFn: securityApi.revokeSession,
    onSuccess: () => { toast.success(t('revoked')); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const others = useMutation({
    mutationFn: securityApi.revokeOthers,
    onSuccess: (r) => { toast.success(t('revokedOthers', { count: r.revoked })); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const otherCount = data?.filter((s) => !s.current).length ?? 0;

  return (
    <Card data-testid="sessions-card">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </div>
        {otherCount > 0 && (
          <Button variant="outline" size="sm" disabled={others.isPending} onClick={() => others.mutate()} data-testid="revoke-others">
            <LogOut className="mr-2 h-4 w-4" />
            {t('revokeOthers')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {data?.map((s) => {
          const device = describeDevice(s.userAgent);
          const Icon = device.os === 'Android' || device.os === 'iOS' || device.browser === 'App' ? Smartphone : Laptop;
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3" data-testid={s.current ? 'session-current' : 'session-other'}>
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {device.browser === 'App' ? t('app') : device.os ? t('device', { browser: device.browser, os: device.os }) : device.browser}
                  {s.current && <Badge variant="secondary">{t('current')}</Badge>}
                  {s.label && <Badge variant="outline">{t('support', { name: s.label })}</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.ip ?? '—'} · {t('lastActive', { date: formatDate(s.lastUsedAt, true) })} · {t('since', { date: formatDate(s.createdAt) })}
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="ghost" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id)} data-testid="revoke-session">
                  {t('revoke')}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
