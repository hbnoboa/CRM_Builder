'use client';

/**
 * ADMINISTRACAO DA EMPRESA (/{empresa}/gestao).
 *
 * Modo separado da operacao: selo "Administracao" no topo (tom da marca) e um
 * botao sempre visivel de volta para a operacao — quem esta aqui sabe que esta
 * configurando a empresa, nao trabalhando nos registros. Quem ve cada secao e
 * decidido por usePermissions().canAccessAdminSection (mesma regra da API).
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/tenant-navigation';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  DatabaseBackup,
  FileText,
  Gauge,
  Link2,
  Lock,
  Plug,
  ScrollText,
  Shield,
  ShieldCheck,
  TableProperties,
  Timer,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { TrialBanner, useTenantFeatures } from '@/components/subscription/subscription-widgets';
import { AnnouncementsBanner } from '@/components/announcements/announcements-banner';
import { cn } from '@/lib/utils';
import { CommandMenu, NavSectionLabel, ShellTopbar, SidebarBrand, navItemClass } from '@/components/layout/shell-parts';
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
      { key: 'teams', section: 'teams', icon: <UsersRound className="h-4 w-4" /> },
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
      { key: 'securityPolicy', section: 'security', icon: <Lock className="h-4 w-4" /> },
      { key: 'auditLogs', section: 'audit-logs', icon: <ScrollText className="h-4 w-4" /> },
      { key: 'executionLogs', section: 'execution-logs', icon: <Timer className="h-4 w-4" /> },
    ],
  },
  {
    key: 'company',
    items: [
      { key: 'organization', section: 'organization', icon: <Building2 className="h-4 w-4" /> },
      { key: 'plan', section: 'plan', icon: <CreditCard className="h-4 w-4" /> },
      { key: 'privacy', section: 'privacy', icon: <DatabaseBackup className="h-4 w-4" /> },
    ],
  },
];

export function GestaoShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('gestao');
  const tNav = useTranslations('navigation');
  const pathname = usePathname();
  const { canAccessAdminSection } = usePermissions();
  const features = useTenantFeatures();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const currentSection = pathname.split('/').filter(Boolean)[1] ?? '';
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.featureKey || features[i.featureKey]) && canAccessAdminSection(i.section)),
  })).filter((g) => g.items.length > 0);

  const hrefOf = (item: GestaoItem) => (item.section ? `/gestao/${item.section}` : '/gestao');

  return (
    <div className="min-h-screen bg-background pt-[var(--banner-h,0px)]" data-testid="gestao-shell">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={cn(
          'fixed bottom-0 top-[var(--banner-h,0px)] left-0 z-50 flex w-64 max-w-[calc(100vw-3rem)] flex-col border-r bg-card transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-3 border-b px-4">
          <div className="min-w-0 flex-1">
            <SidebarBrand
              subtitle={
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <ShieldCheck className="h-3 w-3" /> {t('label')}
                </span>
              }
            />
          </div>
          <button className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setSidebarOpen(false)} aria-label={t('closeMenu')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.key}>
              {group.key !== 'overview' && <NavSectionLabel>{t(`groups.${group.key}`)}</NavSectionLabel>}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.key}
                    href={hrefOf(item)}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    data-testid={`gestao-nav-${item.key}`}
                    className={navItemClass(currentSection === item.section)}
                  >
                    {item.icon}
                    <span className="truncate">{t(`nav.${item.key}`)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            href="/home"
            prefetch={false}
            data-testid="back-to-operation"
            className="flex min-h-[40px] items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToOperation')}
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        <ShellTopbar
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          left={
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-nav-active px-2.5 py-1 text-xs font-medium text-nav-active-foreground sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('label')}
            </span>
          }
        />
        <CommandMenu
          open={searchOpen}
          onOpenChange={setSearchOpen}
          tables={[]}
          pages={[
            ...groups.flatMap((g) => g.items).map((item) => ({ label: t(`nav.${item.key}`), href: hrefOf(item), icon: item.icon })),
            { label: tNav('backToOperation'), href: '/home', icon: <ArrowLeft className="h-4 w-4" /> },
          ]}
          actions={canAccessAdminSection('entities') ? [{ label: tNav('newTable'), href: '/gestao/entities/new', keywords: ['criar', 'tabela'] }] : []}
        />
        <AnnouncementsBanner />
        <TrialBanner />
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
