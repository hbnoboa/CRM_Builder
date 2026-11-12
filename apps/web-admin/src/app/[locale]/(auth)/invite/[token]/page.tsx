'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MailOpen } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/language-switcher';
import { invitationsService } from '@/services/invitations.service';
import { useAuthStore } from '@/stores/auth-store';
import { getErrorMessage } from '@/lib/get-error-message';

const NEW_PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

export default function InvitePage() {
  const t = useTranslations('invite');
  const locale = useLocale();
  const { token } = useParams<{ token: string }>();
  const acceptInvitation = useAuthStore((s) => s.acceptInvitation);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => invitationsService.publicInfo(token),
    retry: false,
  });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isNew = data ? !data.accountExists : false;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (isNew) {
      if (!NEW_PASSWORD_RULE.test(password)) return setError(t('errors.weakPassword'));
      if (password !== confirm) return setError(t('errors.mismatch'));
    }
    setSaving(true);
    try {
      const user = await acceptInvitation(token, { name: isNew ? name.trim() || data?.name || undefined : undefined, password });
      const slug = user.tenant?.slug;
      window.location.href = slug ? `/${locale}/${slug}/home` : `/${locale}/login`;
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md" data-testid="invite-card">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MailOpen className="h-6 w-6" />
            </div>
          </div>
          {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
          {(isError || (data && data.status !== 'pending')) && (
            <>
              <CardTitle className="text-2xl font-bold">{t('unavailable.title')}</CardTitle>
              <CardDescription data-testid="invite-unavailable">
                {t(`unavailable.${isError ? 'invalid' : data!.status}`)}
              </CardDescription>
            </>
          )}
          {data?.status === 'pending' && (
            <>
              <CardTitle className="text-2xl font-bold">{t('title', { company: data.company })}</CardTitle>
              <CardDescription>
                {data.invitedBy
                  ? t('subtitleBy', { name: data.invitedBy, role: data.role })
                  : t('subtitle', { role: data.role })}
              </CardDescription>
            </>
          )}
        </CardHeader>

        {data?.status === 'pending' && (
          <form onSubmit={submit}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('email')}</Label>
                <Input value={data.email} readOnly />
              </div>
              {isNew ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-name">{t('name')}</Label>
                    <Input id="invite-name" required minLength={2} defaultValue={data.name ?? ''} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-password">{t('newPassword')}</Label>
                    <Input id="invite-password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-confirm">{t('confirmPassword')}</Label>
                    <Input id="invite-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-sm text-muted-foreground">{t('existingHint')}</p>
                  <Label htmlFor="invite-password">{t('currentPassword')}</Label>
                  <Input id="invite-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              {error && <p className="text-sm text-destructive" data-testid="invite-error">{error}</p>}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={saving} data-testid="invite-accept">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isNew ? t('createAndJoin') : t('join')}
              </Button>
              {!isNew && (
                <Link href="/forgot-password" className="text-sm text-primary underline">{t('forgot')}</Link>
              )}
            </CardFooter>
          </form>
        )}
        {(isError || (data && data.status !== 'pending')) && (
          <CardFooter>
            <Button asChild variant="outline" className="w-full"><Link href="/login">{t('goToLogin')}</Link></Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
