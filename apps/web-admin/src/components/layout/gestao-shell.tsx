'use client';

/**
 * ADMINISTRACAO DA EMPRESA (/{empresa}/gestao).
 *
 * Modo separado da operacao: menu escuro com a marca, faixa "Administracao" e um
 * botao sempre visivel de volta para a operacao — quem esta aqui sabe que esta
 * configurando a empresa, nao trabalhando nos registros. Quem ve cada secao e
 * decidido por usePermissions().canAccessAdminSection (mesma regra da API).
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/tenant-navigation';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  FileText,
  Gauge,
  Link2,
  LogOut,
  Menu,
  Plug,
  ScrollText,
  Shield,
  ShieldCheck,
  TableProperties,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { useTenant } from '@/stores/tenant-context';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { TrialBanner, useTenantFeatures } from '@/components/subscription/subscription-widgets';
import { cn } from '@/lib/utils';
import type { FeatureKey } from '@/types/platform';

interface GestaoItem {
  key: string;
  /** Secao de /gestao ('' = painel) — tambem e a chave da regra de acesso. */
  section: string;
  icon: React.ReactNode;
  featureKey?: FeatureKey;
}

const GROUPS: Array<{ key: string; items: GestaoItem[] }> = [
  { key: 'overview', items: [{ key: 'dashboard', section: '', icon: <Gauge className="h-4 w-4" /> }] },
  {
    key: 'team',
    items: [
      { key: 'users', section: 'users', icon: <Users className="h-4 w-4" /> },
      { key: 'roles', section: 'roles', icon: <Shield className="h-4 w-4" /> },
      { key: 'permissions', section: 'permissions', icon: <BookOpen className="h-4 w-4" /> },
    ],
  },
  {
    key: 'structure',
    items: [
      { key: 'entities', section: 'entities', icon: <TableProperties className="h-4 w-4" /> },
      { key: 'pdfTemplates', section: 'pdf-templates', icon: <FileText className="h-4 w-4" />, featureKey: 'pdf' },
      { key: 'dashboardTemplates', section: 'dashboard-templates', icon: <BarChart3 className="h-4 w-4" /> },
      { key: 'publicLinks', section: 'public-links', icon: <Link2 className="h-4 w-4" />, featureKey: 'publicLinks' },
      { key: 'integrations', section: 'integrations', icon: <Plug className="h-4 w-4" /> },
    ],
  },
  {
    key: 'security',
    items: [
      { key: 'auditLogs', section: 'audit-logs', icon: <ScrollText className="h-4 w-4" /> },
      { key: 'executionLogs', section: 'execution-logs', icon: <Timer className="h-4 w-4" /> },
    ],
  },
  {
    key: 'company',
    items: [
      { key: 'organization', section: 'organization', icon: <Building2 className="h-4 w-4" /> },
      { key: 'plan', section: 'plan', icon: <CreditCard className="h-4 w-4" /> },
    ],
  },
];

export function GestaoShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('gestao');
  const tAuth = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { canAccessAdminSection } = usePermissions();
  const features = useTenantFeatures();
  const { tenant } = useTenant();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentSection = pathname.split('/').filter(Boolean)[1] ?? '';
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.featureKey || features[i.featureKey]) && canAccessAdminSection(i.section)),
  })).filter((g) => g.items.length > 0);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-muted/40 pt-[var(--banner-h,0px)]" data-testid="gestao-shell">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={cn(
          'fixed bottom-0 top-[var(--banner-h,0px)] left-0 z-50 flex w-64 max-w-[calc(100vw-3rem)] flex-col bg-zinc-950 text-zinc-300 transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{t('label')}</p>
            <p className="truncate text-sm font-semibold text-white">{tenant?.name}</p>
          </div>
          <button className="rounded-lg p-2 hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label={t('closeMenu')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.key}>
              {group.key !== 'overview' && (
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{t(`groups.${group.key}`)}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = currentSection === item.section;
                  return (
                    <Link
                      key={item.key}
                      href={item.section ? `/gestao/${item.section}` : '/gestao'}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      data-testid={`gestao-nav-${item.key}`}
                      className={cn(
                        'flex min-h-[38px] items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        active ? 'bg-primary font-medium text-primary-foreground' : 'hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {item.icon}
                      <span className="truncate">{t(`nav.${item.key}`)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            href="/home"
            prefetch={false}
            data-testid="back-to-operation"
            className="flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-white/10 px-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToOperation')}
          </Link>
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white">{user?.name}</p>
              <p className="truncate text-xs text-zinc-500">{user?.customRole?.name}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title={tAuth('logout')} className="text-zinc-400 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-[var(--banner-h,0px)] z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
          <button className="-ml-2 rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setSidebarOpen(true)} data-testid="mobile-menu-button" aria-label={t('openMenu')}>
            <Menu className="h-6 w-6" />
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-medium text-white dark:bg-zinc-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('label')}
          </span>
          <div className="flex-1" />
          <NotificationBell />
          <Link href="/home" prefetch={false} className="hidden items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
            <ArrowLeft className="h-4 w-4" />
            {t('backToOperation')}
          </Link>
        </header>
        <TrialBanner />
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
