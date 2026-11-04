'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/get-error-message';
import { securityApi, type MfaSetup } from './security-api';

/** Codigos de recuperacao: mostrados uma vez, com copiar. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const t = useTranslations('security.mfa');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
  };
  return (
    <div className="space-y-3" data-testid="recovery-codes">
      <p className="text-sm">{t('recoveryIntro')}</p>
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-3 font-mono text-sm">
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}
        {t('copyCodes')}
      </Button>
    </div>
  );
}

/** Ativar: QR -> codigo -> codigos de recuperacao. */
export function MfaSetupFlow({ onDone }: { onDone: () => void }) {
  const t = useTranslations('security.mfa');
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      setSetup(await securityApi.mfaSetup());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      setCodes((await securityApi.mfaEnable(code.trim())).recoveryCodes);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (codes) {
    return (
      <div className="space-y-4">
        <p className="font-medium text-green-700 dark:text-green-400">{t('enabledNow')}</p>
        <RecoveryCodes codes={codes} />
        <Button onClick={onDone} data-testid="mfa-done">{t('done')}</Button>
      </div>
    );
  }

  if (!setup) {
    return (
      <Button onClick={start} disabled={busy} data-testid="mfa-start">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('enable')}
      </Button>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-4" data-testid="mfa-setup">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>{t('step1')}</li>
        <li>{t('step2')}</li>
        <li>{t('step3')}</li>
      </ol>
      <div className="flex flex-wrap items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qrDataUrl} alt="QR code" className="h-44 w-44 rounded-lg border bg-white p-1" data-testid="mfa-qr" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">{t('manualKey')}</p>
          <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-sm" data-testid="mfa-secret">{setup.secret}</code>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mfa-confirm">{t('codeLabel')}</Label>
        <Input id="mfa-confirm" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[12rem] font-mono tracking-widest" placeholder="123456" />
      </div>
      <Button type="submit" disabled={busy || code.trim().length < 6} data-testid="mfa-confirm-submit">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('confirm')}
      </Button>
    </form>
  );
}
