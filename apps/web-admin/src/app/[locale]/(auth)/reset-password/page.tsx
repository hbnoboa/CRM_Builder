'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { KeyRound, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/language-switcher';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';

const NEW_PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

function ResetPasswordContent() {
  const t = useTranslations('resetPassword');
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!NEW_PASSWORD_RULE.test(password)) return setError(t('weakPassword'));
    if (password !== confirm) return setError(t('mismatch'));
    setSaving(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <KeyRound className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('title')}</CardTitle>
          <CardDescription>{done ? t('done') : t('subtitle')}</CardDescription>
        </CardHeader>
        {!done && (
          <form onSubmit={submit}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-password">{t('newPassword')}</Label>
                <Input id="reset-password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t('hint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-confirm">{t('confirmPassword')}</Label>
                <Input id="reset-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive" data-testid="reset-error">{error}</p>}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={saving || !token}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </CardFooter>
          </form>
        )}
        {done && (
          <CardFooter>
            <Button asChild className="w-full"><Link href="/login">{t('goToLogin')}</Link></Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
