'use client';

import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { useCustomDomain } from '@/lib/custom-domain';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

/**
 * "Pedir acesso" no dominio proprio da empresa: a pessoa informa nome, e-mail e senha;
 * a administracao aprova (escolhendo o cargo) ou recusa. So existe no endereco da empresa.
 */
export default function RequestAccessPage() {
  const { brand, loading } = useCustomDomain();
  const [form, setForm] = useState({ name: '', email: '', password: '', website: '' });
  const [show, setShow] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const color = brand?.brandColor || undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.name.trim().length < 2) return setError('Informe seu nome.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('Informe um e-mail válido.');
    if (form.password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres, com letras maiúsculas, minúsculas e um número.');
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/public/access-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (body as { message?: string | string[] }).message;
        throw new Error(Array.isArray(msg) ? msg.join(' ') : msg || 'Não foi possível enviar agora. Tente de novo.');
      }
      setDone((body as { message?: string }).message || 'Pedido enviado!');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!loading && !brand) {
    return (
      <AuthShell>
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold">Peça acesso pelo endereço da empresa</p>
          <p className="text-sm text-muted-foreground">Esta página só funciona no endereço próprio da empresa (ex.: www.suaempresa.com.br/pedir-acesso). Se você recebeu um convite, use o link do convite.</p>
          <Link href="/login" className="text-sm font-medium text-orange-600 hover:underline">Voltar para o login</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {done ? (
        <div className="space-y-3 text-center" data-testid="request-access-done">
          <CheckCircle2 className="mx-auto h-12 w-12" style={{ color }} />
          <p className="text-lg font-semibold">{done}</p>
          <p className="text-sm text-muted-foreground">Quando aprovarem, entre com este e-mail e a senha que você escolheu. Se você já tem conta no sistema por outra empresa, use a senha que já usa.</p>
          <Link href="/login" className="inline-block text-sm font-medium hover:underline" style={{ color }}>Ir para o login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate data-testid="request-access-form">
          <div>
            <p className="text-2xl font-bold">Pedir acesso</p>
            <p className="text-sm text-muted-foreground">{brand ? `A administração de ${brand.name} vai receber seu pedido e liberar o acesso.` : ''}</p>
          </div>
          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950" role="alert">{error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="ra-name">Nome</Label>
            <Input id="ra-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-email">E-mail</Label>
            <Input id="ra-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" placeholder="seu@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-password">Senha</Label>
            <div className="relative">
              <Input id="ra-password" type={show ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" className="pr-10" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={show ? 'Esconder senha' : 'Mostrar senha'}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres, com letras maiúsculas, minúsculas e um número.</p>
          </div>
          {/* Campo escondido: pessoas nao veem; robos preenchem */}
          <input type="text" name="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
          <Button type="submit" className="w-full text-white hover:opacity-90" style={{ backgroundColor: color }} disabled={sending} data-testid="request-access-submit">
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar pedido
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem acesso? <Link href="/login" className="font-medium hover:underline" style={{ color }}>Entrar</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
