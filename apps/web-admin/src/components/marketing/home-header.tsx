'use client';

import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand/brand';
import { useAuthStore } from '@/stores/auth-store';

const NAV = [
  { href: '#modelos', label: 'Modelos' },
  { href: '#recursos', label: 'Recursos' },
  { href: '#precos', label: 'Preços' },
  { href: '#duvidas', label: 'Dúvidas' },
];

export function HomeHeader() {
  const [open, setOpen] = useState(false);
  // Sessao vem do store persistido: so depois de montar (evita diferenca no SSR)
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((s) => s.user);
  useEffect(() => setMounted(true), []);
  const tenantSlug = (user as { tenant?: { slug?: string } } | null)?.tenant?.slug;
  const loggedIn = mounted && !!user;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="CRM Builder — início">
          <BrandLogo fixedDark />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-slate-900">{item.label}</a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {loggedIn ? (
            <Button asChild className="bg-orange-600 text-white hover:bg-orange-700">
              <Link href={tenantSlug ? `/${tenantSlug}/home` : '/login'}>Abrir o sistema</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="text-slate-700 hover:bg-slate-100 hover:text-slate-900">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild className="bg-orange-600 text-white hover:bg-orange-700">
                <Link href="/register">Começar grátis</Link>
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          className="ml-auto rounded-md p-2 text-slate-700 sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 sm:hidden">
          <nav className="flex flex-col gap-3 text-sm text-slate-700">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="bg-white text-slate-900 border-slate-300 hover:bg-slate-50 hover:text-slate-900"><Link href="/login">Entrar</Link></Button>
            <Button asChild className="bg-orange-600 text-white hover:bg-orange-700"><Link href="/register">Começar grátis</Link></Button>
          </div>
        </div>
      )}
    </header>
  );
}
