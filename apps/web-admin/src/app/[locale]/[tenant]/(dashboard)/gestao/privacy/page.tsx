'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, Loader2, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { privacyApi } from '@/components/privacy/privacy-api';
import { securityApi } from '@/components/security/security-api';
import { downloadFromApi } from '@/lib/download';
import { getErrorMessage } from '@/lib/get-error-message';
import { useAuthStore } from '@/stores/auth-store';
import { HelpButton } from '@/components/help/help-button';

export default function CompanyPrivacyPage() {
  const t = useTranslations('gestao.privacy');
  const locale = useLocale();
  const logout = useAuthStore((s) => s.logout);
  const { data, isLoading } = useQuery({ queryKey: ['privacy', 'company'], queryFn: privacyApi.company });
  const { data: mfa } = useQuery({ queryKey: ['auth', 'mfa'], queryFn: securityApi.mfaStatus });
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ password: '', code: '', confirmName: '', reason: '' });

  const doExport = async () => {
    setExporting(true);
    try {
      await downloadFromApi('/privacy/company/export', 'dados.zip');
      toast.success(t('export.done'));
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const close = useMutation({
    mutationFn: () => privacyApi.close({
      password: form.password, code: form.code || undefined, confirmName: form.confirmName, reason: form.reason || undefined,
    }),
    onSuccess: async (r) => {
      toast.success(t('close.done', { date: new Date(r.closure.deleteAfter).toLocaleDateString(locale) }));
      await logout();
      window.location.href = `/${locale}/login`;
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading || !data) return <Skeleton className="h-64" />;
  const nameMatches = form.confirmName.trim().toLowerCase() === data.tenantName.trim().toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl flex items-center gap-2">{t('title')}<HelpButton topic="module.privacy" /></h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">{t('subtitle')}</p>
      </div>

      <Card data-testid="privacy-export">
        <CardHeader>
          <CardTitle className="text-base">{t('export.title')}</CardTitle>
          <CardDescription>{t('export.hint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {(['records', 'people', 'structure', 'settings', 'files', 'audit'] as const).map((k) => <li key={k}>{t(`export.items.${k}`)}</li>)}
          </ul>
          {data.canExport ? (
            <Button onClick={doExport} disabled={exporting} data-testid="privacy-export-button">
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting ? t('export.preparing') : t('export.button')}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="privacy-export-denied">{t('export.onlyAdmins')}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40" data-testid="privacy-close">
        <CardHeader>
          <CardTitle className="text-base text-destructive">{t('close.title')}</CardTitle>
          <CardDescription>{t('close.hint', { days: data.graceDays })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('close.beforeTitle')}</AlertTitle>
            <AlertDescription>{t('close.before')}</AlertDescription>
          </Alert>
          {data.isOwner ? (
            <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)} data-testid="privacy-close-open">
              <PowerOff className="mr-2 h-4 w-4" /> {t('close.button')}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="privacy-close-denied">{t('close.onlyOwner')}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm({ password: '', code: '', confirmName: '', reason: '' }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('close.dialogTitle', { name: data.tenantName })}</DialogTitle>
            <DialogDescription>{t('close.dialogHint', { days: data.graceDays })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="close-name">{t('close.typeName', { name: data.tenantName })}</Label>
              <Input id="close-name" value={form.confirmName} onChange={(e) => setForm({ ...form, confirmName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="close-reason">{t('close.reason')}</Label>
              <Textarea id="close-reason" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="close-password">{t('close.password')}</Label>
              <Input id="close-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            {mfa?.enabled && (
              <div className="space-y-1">
                <Label htmlFor="close-code">{t('close.code')}</Label>
                <Input id="close-code" inputMode="numeric" className="font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('close.cancel')}</Button>
            <Button variant="destructive" disabled={!nameMatches || !form.password || close.isPending} onClick={() => close.mutate()} data-testid="privacy-close-submit">
              {close.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('close.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
