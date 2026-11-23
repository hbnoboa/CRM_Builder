'use client';

import { useTranslations } from 'next-intl';
import { Database, Home, LayoutDashboard, type LucideIcon, Menu, MessageSquare } from 'lucide-react';
import { Link, usePathname } from '@/i18n/tenant-navigation';
import { cn } from '@/lib/utils';

interface Tab { key: string; href: string; icon: LucideIcon }

/**
 * Barra de abas embaixo, no app instalado (como o app do celular): Inicio, Painel, Dados,
 * Chat e "Mais" (abre o menu com o resto). So as abas que o cargo/plano permitem.
 */
export function AppBottomNav({ showDashboard, showData, showChat, onMore }: { showDashboard: boolean; showData: boolean; showChat: boolean; onMore: () => void }) {
  const tNav = useTranslations('navigation');
  const pathname = usePathname();
  const tabs: Tab[] = [
    { key: 'home', href: '/home', icon: Home },
    ...(showDashboard ? [{ key: 'dashboard', href: '/dashboard', icon: LayoutDashboard }] : []),
    ...(showData ? [{ key: 'data', href: '/tabelas', icon: Database }] : []),
    ...(showChat ? [{ key: 'chat', href: '/chat', icon: MessageSquare }] : []),
  ];
  const active = (href: string) => pathname === href || (href === '/tabelas' && pathname.startsWith('/data'));
  const cell = 'flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-medium';
  const Icon = ({ icon: I, on }: { icon: LucideIcon; on: boolean }) => (
    <span className={cn('flex h-8 w-16 items-center justify-center rounded-full transition-colors', on && 'bg-primary/10')}>
      <I className={cn('h-5 w-5', on ? 'text-primary' : 'text-muted-foreground')} />
    </span>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgb(16_24_40/0.06)]" data-testid="app-bottom-nav">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((t) => {
          const on = active(t.href);
          return (
            <Link key={t.key} href={t.href} prefetch={false} className={cn(cell, on ? 'text-primary' : 'text-muted-foreground')} data-testid={`app-tab-${t.key}`}>
              <Icon icon={t.icon} on={on} />
              {tNav(t.key)}
            </Link>
          );
        })}
        <button type="button" onClick={onMore} className={cn(cell, 'text-muted-foreground')} data-testid="app-tab-more">
          <Icon icon={Menu} on={false} />
          {tNav('more')}
        </button>
      </div>
    </nav>
  );
}
