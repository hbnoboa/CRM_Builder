'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MfaSetupFlow } from '@/components/security/mfa-setup';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';

/** A empresa exige duas etapas: a pessoa ativa aqui antes de usar o sistema. */
export default function SecuritySetupPage() {
  const t = useTranslations('security.setup');
  const locale = useLocale();
  const logout = useAuthStore((s) => s.logout);

  const finish = async () => {
    const { data } = await api.get<{ tenant?: { slug?: string } }>('/auth/me');
    window.location.href = data.tenant?.slug ? `/${locale}/${data.tenant.slug}/home` : `/${locale}/login`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-lg" data-testid="security-setup">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MfaSetupFlow onDone={finish} />
          <Button variant="ghost" className="w-full" onClick={async () => { await logout(); window.location.href = `/${locale}/login`; }}>
            {t('logout')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
