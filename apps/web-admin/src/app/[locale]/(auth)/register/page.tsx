'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { getDefaultRouteForUser } from '@/hooks/use-permissions';
import { LanguageSwitcher } from '@/components/language-switcher';

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  tenantName: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations('auth.register');
  const tValidation = useTranslations('validation');
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();

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

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser(data);
      const user = useAuthStore.getState().user;
      router.push(getDefaultRouteForUser(user));
    } catch (err) {
      // handled by store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">C</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
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
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  {t('creatingAccount')}
                </>
              ) : (
                t('createAccount')
              )}
            </Button>
            <div className="text-sm text-center">
              {t('hasAccount')}{' '}
              <Link href="/login" className="text-primary underline">
                {t('signIn')}
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
