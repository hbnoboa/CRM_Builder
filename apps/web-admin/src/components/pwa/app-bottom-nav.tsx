'use client';

import { useTranslations } from 'next-intl';
import { Folder, LayoutDashboard, type LucideIcon, MessageCircle } from 'lucide-react';
import { Link, usePathname } from '@/i18n/tenant-navigation';
import { cn } from '@/lib/utils';

interface Tab { key: 'dashboard' | 'data' | 'chat'; href: string; icon: LucideIcon }

/**
 * Barra de abas embaixo, igual a do app Flutter: Dashboard, Dados e Chat (so as que o
 * cargo/plano permitem). Com uma aba so, a barra nao aparece. O resto fica no menu (☰).
 */
export function AppBottomNav({ showDashboard, showData, showChat }: { showDashboard: boolean; showData: boolean; showChat: boolean }) {
  const t = useTranslations('navigation.appNav');
  const pathname = usePathname();
  const tabs: Tab[] = [
    ...(showDashboard ? [{ key: 'dashboard' as const, href: '/dashboard', icon: LayoutDashboard }] : []),
    ...(showData ? [{ key: 'data' as const, href: '/tabelas', icon: Folder }] : []),
    ...(showChat ? [{ key: 'chat' as const, href: '/chat', icon: MessageCircle }] : []),
  ];
  if (tabs.length < 2) return null;
  const active = (tab: Tab) =>
    tab.key === 'data' ? pathname === '/tabelas' || pathname.startsWith('/data') : pathname.startsWith(tab.href);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgb(16_24_40/0.1)]" data-testid="app-bottom-nav">
      <div className="mx-auto flex h-16 max-w-lg">
        {tabs.map((tab) => {
          const on = active(tab);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              prefetch={false}
              className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-[11px]', on ? 'font-semibold text-primary' : 'font-medium text-muted-foreground')}
              data-testid={`app-tab-${tab.key}`}
            >
              <span className={cn('flex h-8 w-16 items-center justify-center rounded-full transition-colors', on && 'bg-primary/[0.12]')}>
                <Icon className="h-6 w-6" strokeWidth={on ? 2.4 : 1.8} />
              </span>
              {t(tab.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
