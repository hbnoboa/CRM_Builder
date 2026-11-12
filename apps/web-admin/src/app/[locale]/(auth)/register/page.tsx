'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, LayoutTemplate, Loader2 } from 'lucide-react';
import { SOLUTION_CATALOG, type SolutionCatalogItem } from '@crm-builder/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { SolutionIcon } from '@/components/marketing/solution-icon';
import { useAuthStore } from '@/stores/auth-store';
import { getDefaultRouteForUser } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  tenantName: string;
};

const BLANK = '';

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.register');
  // Dias de teste vêm da API (SIGNUP_TRIAL_DAYS); 14 enquanto carrega.
  const [trialDays, setTrialDays] = useState(14);
  // Modelos montados neste ambiente (os outros não aparecem para escolha).
  const [available, setAvailable] = useState<SolutionCatalogItem[]>([]);
  const requested = searchParams.get('modelo') ?? BLANK;
  const [modelo, setModelo] = useState<string>(requested);
  const [includeSamples, setIncludeSamples] = useState(true);

  useEffect(() => {
    api.get<{ trialDays: number }>('/auth/signup-info')
      .then((res) => { if (res.data?.trialDays) setTrialDays(res.data.trialDays); })
      .catch(() => undefined);
    api.get<Array<SolutionCatalogItem & { available: boolean }>>('/solutions')
      .then((res) => {
        const list = (res.data || []).filter((s) => s.available);
        setAvailable(list);
        // ?modelo= de um modelo que nao existe aqui: comeca em branco
        if (requested && !list.some((s) => s.slug === requested)) setModelo(BLANK);
      })
      .catch(() => setModelo(BLANK));
  }, [requested]);

  const tValidation = useTranslations('validation');
  const { register: registerUser, isLoading, error } = useAuthStore();

  const registerSchema = useMemo(() => z.object({
    name: z.string().min(2, tValidation('nameMin', { min: 2 })),
    email: z.string().min(1, tValidation('emailRequired')).email(tValidation('emailInvalid')),
    password: z.string().min(8, tValidation('passwordMin', { min: 8 })),
    tenantName: z.string().min(2, tValidation('companyRequired')),
  }), [tValidation]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const chosen = SOLUTION_CATALOG.find((s) => s.slug === modelo);

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser({ ...data, ...(chosen ? { modelo: chosen.slug, includeSamples } : {}) });
      const user = useAuthStore.getState().user;
      // Empresa nova criada no cadastro: entra direto no tenant (slug na URL), como o login.
      const slug = (user as { tenant?: { slug?: string } } | null)?.tenant?.slug;
      // Com modelo, abre no painel do modelo; sem, na pagina inicial do sistema.
      const route = chosen ? `/data?entity=${chosen.rootEntity}` : getDefaultRouteForUser(user);
      router.push(slug ? `/${slug}${route}` : route);
    } catch (err) {
      // handled by store
    }
  };

  return (
    <AuthShell>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle', { days: trialDays })}</p>
      </div>

      {available.length > 0 && (
        <fieldset className="mt-6" data-testid="register-modelo">
          <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
            <LayoutTemplate className="h-4 w-4 text-orange-600" />
            Começar com um modelo
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {available.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => setModelo(s.slug)}
                aria-pressed={modelo === s.slug}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  modelo === s.slug ? 'border-orange-600 bg-orange-50 text-orange-900' : 'hover:bg-muted',
                )}
              >
                <SolutionIcon name={s.icon} className="h-4 w-4 shrink-0" style={{ color: s.color }} />
                <span className="truncate">{s.name}</span>
                {modelo === s.slug && <Check className="ml-auto h-4 w-4 text-orange-600" />}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setModelo(BLANK)}
              aria-pressed={modelo === BLANK}
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-sm transition-colors sm:col-span-2',
                modelo === BLANK ? 'border-orange-600 bg-orange-50 text-orange-900' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              Começar em branco
            </button>
          </div>
          {chosen && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300"
                checked={includeSamples}
                onChange={(e) => setIncludeSamples(e.target.checked)}
              />
              <span>
                Trazer dados de exemplo
                <span className="block text-xs text-muted-foreground">
                  Registros fictícios para testar os painéis; você pode apagar depois.
                </span>
              </span>
            </label>
          )}
        </fieldset>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">{t('name')}</Label>
          <Input id="name" placeholder={t('namePlaceholder')} {...register('name')} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="tenantName">{t('company')}</Label>
          <Input id="tenantName" placeholder={t('companyPlaceholder')} {...register('tenantName')} />
          {errors.tenantName && <p className="text-red-500 text-xs mt-1">{errors.tenantName.message}</p>}
        </div>
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" type="email" placeholder={t('emailPlaceholder')} {...register('email')} />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="password">{t('password')}</Label>
          <Input id="password" type="password" placeholder={t('passwordPlaceholder')} {...register('password')} />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        <Button type="submit" className="w-full bg-orange-600 text-white hover:bg-orange-700" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="animate-spin w-4 h-4 mr-2" />
              {chosen ? 'Preparando seu sistema…' : t('creatingAccount')}
            </>
          ) : (
            t('createAccount')
          )}
        </Button>
        <div className="text-sm text-center">
          {t('hasAccount')}{' '}
          <Link href="/login" className="font-medium text-orange-600 hover:underline">
            {t('signIn')}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
