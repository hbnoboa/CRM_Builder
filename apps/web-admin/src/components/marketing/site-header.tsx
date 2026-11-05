'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { SOLUTION_CATALOG } from '@crm-builder/shared';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand/brand';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { SolutionIcon } from './solution-icon';

const PRODUCT_LINKS = [
  { href: '/#como-funciona', label: 'Como funciona', text: 'Tabelas, painéis, PDFs, permissões e chat' },
  { href: '/#recursos', label: 'Recursos', text: 'Tudo o que vem no sistema' },
  { href: '/#app', label: 'App offline', text: 'Trabalho de campo sem sinal' },
  { href: '/#integracoes', label: 'Integrações', text: 'API, webhooks, automações e Excel' },
  { href: '/#seguranca', label: 'Segurança e LGPD', text: 'Isolamento, 2 etapas, auditoria' },
];

type MenuKey = 'produto' | 'solucoes' | null;

/** Cabecalho das paginas publicas: menus Produto e Solucoes, Precos, Contato. */
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menu, setMenu] = useState<MenuKey>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((s) => s.user);
  useEffect(() => setMounted(true), []);
  const tenantSlug = (user as { tenant?: { slug?: string } } | null)?.tenant?.slug;
  const loggedIn = mounted && !!user;

  // Fecha o menu ao clicar fora ou apertar Esc
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  const trigger = (key: Exclude<MenuKey, null>, label: string) => (
    <button
      type="button"
      onClick={() => setMenu((m) => (m === key ? null : key))}
      aria-expanded={menu === key}
      className={cn('inline-flex items-center gap-1 hover:text-slate-900', menu === key && 'text-slate-900')}
    >
      {label}
      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', menu === key && 'rotate-180')} />
    </button>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div ref={ref} className="relative mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="CRM Builder — início">
          <BrandLogo fixedDark />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 lg:flex">
          {trigger('produto', 'Produto')}
          {trigger('solucoes', 'Soluções')}
          <Link href="/precos" className="hover:text-slate-900">Preços</Link>
          <Link href="/contato" className="hover:text-slate-900">Contato</Link>
        </nav>

        {menu && (
          <div className="absolute inset-x-4 top-full mt-2 hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xl lg:block sm:inset-x-6">
            {menu === 'produto' ? (
              <div className="grid grid-cols-3 gap-2">
                {PRODUCT_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setMenu(null)} className="rounded-lg p-3 hover:bg-slate-50">
                    <span className="block text-sm font-semibold text-slate-900">{l.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{l.text}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-[2fr_1fr] gap-6">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Modelos prontos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SOLUTION_CATALOG.map((s) => (
                      <Link key={s.slug} href={`/solucoes/${s.slug}`} onClick={() => setMenu(null)} className="flex gap-3 rounded-lg p-3 hover:bg-slate-50">
                        <SolutionIcon name={s.icon} className="mt-0.5 h-5 w-5 shrink-0" style={{ color: s.color }} />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{s.name}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{s.audience}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Casos de uso</p>
                  <p className="mt-2 text-sm text-slate-600">Por segmento e por área: veja onde o CRM Builder já se encaixa.</p>
                  <Link href="/#casos-de-uso" onClick={() => setMenu(null)} className="mt-3 inline-block text-sm font-medium text-orange-600 hover:underline">
                    Ver casos de uso →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

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
              <Button asChild variant="outline" className="hidden border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900 md:inline-flex">
                <Link href="/contato">Falar com especialista</Link>
              </Button>
              <Button asChild className="bg-orange-600 text-white hover:bg-orange-700">
                <Link href="/register">Começar grátis</Link>
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          className="ml-auto rounded-md p-2 text-slate-700 sm:ml-0 lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Produto</p>
          <nav className="mt-2 flex flex-col gap-2 text-sm text-slate-700">
            {PRODUCT_LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}>{l.label}</Link>)}
          </nav>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Soluções</p>
          <nav className="mt-2 flex flex-col gap-2 text-sm text-slate-700">
            {SOLUTION_CATALOG.map((s) => <Link key={s.slug} href={`/solucoes/${s.slug}`} onClick={() => setMobileOpen(false)}>{s.name}</Link>)}
            <Link href="/#casos-de-uso" onClick={() => setMobileOpen(false)}>Casos de uso</Link>
          </nav>
          <nav className="mt-5 flex flex-col gap-2 text-sm font-medium text-slate-900">
            <Link href="/precos" onClick={() => setMobileOpen(false)}>Preços</Link>
            <Link href="/contato" onClick={() => setMobileOpen(false)}>Falar com especialista</Link>
          </nav>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900"><Link href="/login">Entrar</Link></Button>
            <Button asChild className="bg-orange-600 text-white hover:bg-orange-700"><Link href="/register">Começar grátis</Link></Button>
          </div>
        </div>
      )}
    </header>
  );
}
