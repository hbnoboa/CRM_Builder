'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, User, Mail, Phone, CreditCard, Lock, Building2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePublicAuthStore } from '@/stores/public-auth-store';
import { maskCpf, maskCnpj, maskPhone, unmask } from '@/lib/masks';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface LinkInfo {
  name: string;
  description?: string | null;
  entityName: string;
  entitySlug: string;
  tenantName: string;
  tenantLogo?: string | null;
  settings: Record<string, unknown>;
}

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email invalido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Informe email, CPF ou telefone'),
  password: z.string().min(1, 'Informe a senha'),
});

type RegisterForm = z.infer<typeof registerSchema>;
type LoginForm = z.infer<typeof loginSchema>;

export default function PublicLinkPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { register: publicRegister, login: publicLogin, isAuthenticated, isLoading: authLoading, error, clearError } = usePublicAuthStore();

  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('login');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(`/p/${slug}/app`);
    }
  }, [isAuthenticated, slug, router]);

  // Fetch link info
  useEffect(() => {
    const fetchLink = async () => {
      try {
        const response = await axios.get(`${API_URL}/p/${slug}`);
        setLinkInfo(response.data);
      } catch (err: any) {
        const message = err?.response?.data?.message || 'Link invalido ou expirado';
        setLinkError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchLink();
  }, [slug]);

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', cpf: '', cnpj: '', phone: '' },
  });

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const onRegister = async (data: RegisterForm) => {
    try {
      await publicRegister(slug, {
        name: data.name,
        email: data.email,
        password: data.password,
        cpf: data.cpf ? unmask(data.cpf) : undefined,
        cnpj: data.cnpj ? unmask(data.cnpj) : undefined,
        phone: data.phone ? unmask(data.phone) : undefined,
      });
      router.push(`/p/${slug}/app`);
    } catch {
      // Error handled by store
    }
  };

  const onLogin = async (data: LoginForm) => {
    try {
      await publicLogin(slug, {
        identifier: data.identifier,
        password: data.password,
      });
      router.push(`/p/${slug}/app`);
    } catch {
      // Error handled by store
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link indisponivel</h2>
            <p className="text-muted-foreground text-center">{linkError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          {linkInfo?.tenantLogo ? (
            <div className="flex justify-center mb-4">
              <img
                src={linkInfo.tenantLogo}
                alt={linkInfo.tenantName}
                className="h-12 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
          )}
          <CardTitle className="text-xl font-bold">{linkInfo?.name}</CardTitle>
          <CardDescription>
            {linkInfo?.description || `${linkInfo?.tenantName} - ${linkInfo?.entityName}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={clearError} className="ml-2 text-red-700 hover:text-red-900">
                x
              </button>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); clearError(); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Cadastro</TabsTrigger>
            </TabsList>

            {/* ── LOGIN TAB ── */}
            <TabsContent value="login">
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-identifier">Email, CPF ou Telefone</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-identifier"
                      placeholder="email@exemplo.com"
                      className="pl-10"
                      {...loginForm.register('identifier')}
                    />
                  </div>
                  {loginForm.formState.errors.identifier && (
                    <p className="text-sm text-red-500">{loginForm.formState.errors.identifier.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Sua senha"
                      className="pl-10 pr-10"
                      {...loginForm.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-red-500">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={authLoading}>
                  {authLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* ── REGISTER TAB ── */}
            <TabsContent value="register">
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Nome completo *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-name"
                      placeholder="Seu nome"
                      className="pl-10"
                      {...registerForm.register('name')}
                    />
                  </div>
                  {registerForm.formState.errors.name && (
                    <p className="text-sm text-red-500">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="email@exemplo.com"
                      className="pl-10"
                      {...registerForm.register('email')}
                    />
                  </div>
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-red-500">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="reg-cpf">CPF</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-cpf"
                        placeholder="000.000.000-00"
                        className="pl-10"
                        {...registerForm.register('cpf')}
                        onChange={(e) => {
                          registerForm.setValue('cpf', maskCpf(e.target.value));
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-phone"
                        placeholder="(00) 00000-0000"
                        className="pl-10"
                        {...registerForm.register('phone')}
                        onChange={(e) => {
                          registerForm.setValue('phone', maskPhone(e.target.value));
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-cnpj">CNPJ (opcional)</Label>
                  <Input
                    id="reg-cnpj"
                    placeholder="00.000.000/0000-00"
                    {...registerForm.register('cnpj')}
                    onChange={(e) => {
                      registerForm.setValue('cnpj', maskCnpj(e.target.value));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-password">Senha *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimo 8 caracteres"
                      className="pl-10 pr-10"
                      {...registerForm.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-red-500">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={authLoading}>
                  {authLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cadastrando...</>
                  ) : (
                    'Cadastrar'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
