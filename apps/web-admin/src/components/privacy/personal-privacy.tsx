'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Loader2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { securityApi } from '@/components/security/security-api';
import { downloadFromApi } from '@/lib/download';
import { getErrorMessage } from '@/lib/get-error-message';
import { useAuthStore } from '@/stores/auth-store';
import { privacyApi } from './privacy-api';

/** Configuracoes > Privacidade: baixar os proprios dados e excluir a propria conta. */
export function PersonalPrivacy() {
  const t = useTranslations('privacy.personal');
  const locale = useLocale();
  const logout = useAuthStore((s) => s.logout);
  const [downloading, setDownloading] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const { data: mfa } = useQuery({ queryKey: ['auth', 'mfa'], queryFn: securityApi.mfaStatus });

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFromApi('/privacy/me/export', 'meus-dados.json');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  const remove = useMutation({
    mutationFn: () => privacyApi.deleteMe({ password, code: code || undefined, confirm }),
    onSuccess: async () => {
      toast.success(t('deleted'));
      await logout();
      window.location.href = `/${locale}/login`;
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <Card data-testid="privacy-export-me">
        <CardHeader>
          <CardTitle className="text-base">{t('exportTitle')}</CardTitle>
          <CardDescription>{t('exportHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={download} disabled={downloading} data-testid="privacy-download-me">
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {t('exportButton')}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40" data-testid="privacy-delete-me">
        <CardHeader>
          <CardTitle className="text-base text-destructive">{t('deleteTitle')}</CardTitle>
          <CardDescription>{t('deleteHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)} data-testid="privacy-open-delete-me">
            <UserX className="mr-2 h-4 w-4" /> {t('deleteButton')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPassword(''); setCode(''); setConfirm(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteWarning')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="delete-me-password">{t('password')}</Label>
              <Input id="delete-me-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {mfa?.enabled && (
              <div className="space-y-1">
                <Label htmlFor="delete-me-code">{t('code')}</Label>
                <Input id="delete-me-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="delete-me-confirm">{t('typeToConfirm')}</Label>
              <Input id="delete-me-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="EXCLUIR" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button
              variant="destructive"
              disabled={!password || confirm.trim().toUpperCase() !== 'EXCLUIR' || remove.isPending}
              onClick={() => remove.mutate()}
              data-testid="delete-me-submit"
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('deleteButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
