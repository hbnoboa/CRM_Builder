'use client';

/**
 * SHELL OPERACIONAL (#18 / superficie SERVICE_SCOPE=user no frontend).
 *
 * Usuarios sem acesso a modulos de gestao entram AQUI, e nao no console de admin.
 * Nav slim (Inicio, Registros, Chat, Configuracoes) na cor da empresa e SEM chrome
 * de builder/admin. A escolha do
 * shell e feita no layout via usePermissions().isOperationalSurface; um admin nao
 * alterna para ca — para ver o operacional ele IMPERSONA um usuario.
 */

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/tenant-navigation';
import {
  Home,
  Settings,
  X,
  Database,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  CircleDot,
  LayoutDashboard,
  LifeBuoy,
  Trash2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { useEntitiesGrouped } from '@/hooks/use-entities';
import { cn } from '@/lib/utils';
import { CommandMenu, ShellTopbar, SidebarBrand, navItemClass } from '@/components/layout/shell-parts';
import { TrialBanner, useTenantFeatures } from '@/components/subscription/subscription-widgets';
import { AnnouncementsBanner } from '@/components/announcements/announcements-banner';

export function OperationalShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const tNav = useTranslations('navigation');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { hasModuleAccess, canUseTrash } = usePermissions();
  const features = useTenantFeatures();
  const routeParams = useParams();
  const currentTenantSlug = typeof routeParams?.tenant === 'string' ? routeParams.tenant : undefined;
  const { data: entityGroups } = useEntitiesGrouped(currentTenantSlug);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [registrosOpen, setRegistrosOpen] = useState(true);

  const navLink = (href: string, icon: React.ReactNode, label: string) => {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        key={href}
        href={href}
        prefetch={false}
        onClick={() => setSidebarOpen(false)}
        className={navItemClass(isActive)}
      >
        {icon}
        <span className="flex-1">{label}</span>
      </Link>
    );
  };

  const isRegistrosActive = pathname === '/data';

  return (
    <div className="min-h-screen bg-background pt-[var(--banner-h,0px)]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed bottom-0 top-[var(--banner-h,0px)] left-0 z-50 w-64 max-w-[calc(100vw-3rem)] bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 overflow-hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center gap-3 border-b px-4">
            <div className="min-w-0 flex-1">
              <SidebarBrand subtitle={user?.customRole?.name || tNav('operational')} />
            </div>
            <button
              className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {navLink('/home', <Home className="h-4 w-4" />, tNav('home'))}
            {hasModuleAccess('dashboard') && navLink('/dashboard', <LayoutDashboard className="h-4 w-4" />, tNav('dashboard'))}
            {features.chat && navLink('/chat', <MessageSquare className="h-4 w-4" />, tNav('chat'))}

            <div className="my-3 border-t" />

            {/* Registros (somente leitura da lista; sem builder) */}
            <div>
              <button
                onClick={() => setRegistrosOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-3 w-full px-2.5 min-h-[36px] text-sm font-medium rounded-md transition-colors',
                  isRegistrosActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Database className="h-4 w-4" />
                <span className="flex-1 text-left">{tNav('data')}</span>
                {registrosOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {registrosOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {entityGroups && entityGroups.length > 0 ? (
                    entityGroups.flatMap((group) => group.entities).map((entity) => {
                      const href = `/data?entity=${entity.slug}`;
                      const isActive = pathname === '/data' && searchParams.get('entity') === entity.slug;
                      return (
                        <Link
                          key={entity.id}
                          href={href}
                          prefetch={false}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center rounded-md text-sm transition-colors min-h-[34px] gap-2.5 pl-7 pr-2.5 py-1',
                            isActive ? 'bg-nav-active text-nav-active-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                        >
                          <span style={{ color: isActive ? undefined : entity.color || undefined }}>
                            <CircleDot className="h-4 w-4" />
                          </span>
                          <span className="flex-1 truncate text-[13px]">{entity.name}</span>
                          {entity._count && (
                            <span className={cn('text-[10px] tabular-nums', isActive ? 'text-nav-active-foreground/70' : 'text-muted-foreground/50')}>
                              {(entity._count.data || 0) + (entity._count.archivedData || 0)}
                            </span>
                          )}
                        </Link>
                      );
                    })
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground/50">{t('entities.noEntitiesFound')}</p>
                  )}
                </div>
              )}
            </div>

            <div className="my-3 border-t" />

            {canUseTrash && navLink('/trash', <Trash2 className="h-4 w-4" />, tNav('trash'))}
            {navLink('/support', <LifeBuoy className="h-4 w-4" />, tNav('support'))}
            {navLink('/settings', <Settings className="h-4 w-4" />, tNav('settings'))}
          </nav>

        </div>
      </aside>

      <div className="lg:pl-64">
        <ShellTopbar onOpenSidebar={() => setSidebarOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        <CommandMenu
          open={searchOpen}
          onOpenChange={setSearchOpen}
          tables={(entityGroups || []).flatMap((g) => g.entities).flatMap((e) => [
            { label: e.name, href: `/data?entity=${e.slug}`, color: e.color, keywords: [e.slug] },
            // Sub-tabelas (ex.: Ordem de servico dentro de Cliente) tambem sao abertas direto
            ...(((e as { subEntities?: Array<{ name: string; slug: string; color?: string }> }).subEntities) || []).map((sub) => ({
              label: sub.name, href: `/data?entity=${sub.slug}`, color: sub.color, keywords: [sub.slug, e.name],
            })),
          ])}
          pages={[
            { label: tNav('home'), href: '/home', icon: <Home className="h-4 w-4" /> },
            ...(hasModuleAccess('dashboard') ? [{ label: tNav('dashboard'), href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> }] : []),
            ...(features.chat ? [{ label: tNav('chat'), href: '/chat', icon: <MessageSquare className="h-4 w-4" /> }] : []),
            ...(canUseTrash ? [{ label: tNav('trash'), href: '/trash', icon: <Trash2 className="h-4 w-4" /> }] : []),
            { label: tNav('support'), href: '/support', icon: <LifeBuoy className="h-4 w-4" /> },
            { label: tNav('settings'), href: '/settings', icon: <Settings className="h-4 w-4" /> },
          ]}
        />

        <AnnouncementsBanner />
        <TrialBanner />
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
