'use client';

/**
 * SHELL OPERACIONAL (#18 / superficie SERVICE_SCOPE=user no frontend).
 *
 * Usuarios sem acesso a modulos de gestao entram AQUI, e nao no console de admin.
 * Nav slim (Inicio, Registros, Chat, Configuracoes), identidade visual propria
 * ("Operacional", accent esmeralda) e SEM chrome de builder/admin. A escolha do
 * shell e feita no layout via usePermissions().isOperationalSurface; um admin nao
 * alterna para ca — para ver o operacional ele IMPERSONA um usuario.
 */

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/tenant-navigation';
import {
  Home,
  Settings,
  LogOut,
  Menu,
  X,
  Database,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  CircleDot,
  LayoutDashboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { useEntitiesGrouped } from '@/hooks/use-entities';
import { useTenant } from '@/stores/tenant-context';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { TenantSelector } from '@/components/tenant-selector';
import { cn } from '@/lib/utils';

export function OperationalShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const tNav = useTranslations('navigation');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { hasModuleAccess } = usePermissions();
  const { tenant } = useTenant();
  const routeParams = useParams();
  const currentTenantSlug = typeof routeParams?.tenant === 'string' ? routeParams.tenant : undefined;
  const { data: entityGroups } = useEntitiesGrouped(currentTenantSlug);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [registrosOpen, setRegistrosOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navLink = (href: string, icon: React.ReactNode, label: string) => {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        key={href}
        href={href}
        prefetch={false}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'flex items-center rounded-lg text-sm font-medium transition-all min-h-[44px] gap-3 px-3 py-2.5',
          isActive
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        {icon}
        <span className="flex-1">{label}</span>
      </Link>
    );
  };

  const isRegistrosActive = pathname === '/data';

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 max-w-[calc(100vw-3rem)] bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 overflow-hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Faixa de identidade da superficie operacional */}
        <div className="h-1 bg-emerald-500" />
        <div className="flex flex-col h-[calc(100%-0.25rem)]">
          <div className="flex items-center h-16 border-b gap-3 px-4">
            {tenant?.logo ? (
              <img src={tenant.logo} alt={tenant.name} className="h-8 w-8 flex-shrink-0 object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-white">{(tenant?.name || 'C')[0].toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm truncate block leading-tight">{tenant?.name || 'CRM Builder'}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {tNav('operational')}
              </span>
            </div>
            <button
              className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navLink('/home', <Home className="h-5 w-5" />, tNav('home'))}
            {hasModuleAccess('dashboard') && navLink('/dashboard', <LayoutDashboard className="h-5 w-5" />, tNav('dashboard'))}
            {navLink('/chat', <MessageSquare className="h-5 w-5" />, tNav('chat'))}

            <div className="my-3 border-t" />

            {/* Registros (somente leitura da lista; sem builder) */}
            <div>
              <button
                onClick={() => setRegistrosOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  isRegistrosActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Database className="h-5 w-5" />
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
                            'flex items-center rounded-lg text-sm transition-all min-h-[36px] gap-2.5 pl-7 pr-3 py-1.5',
                            isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                        >
                          <span style={{ color: isActive ? undefined : entity.color || undefined }}>
                            <CircleDot className="h-4 w-4" />
                          </span>
                          <span className="flex-1 truncate text-[13px]">{entity.name}</span>
                          {entity._count && (
                            <span className={cn('text-[10px] tabular-nums', isActive ? 'text-white/70' : 'text-muted-foreground/50')}>
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

            {navLink('/settings', <Settings className="h-5 w-5" />, tNav('settings'))}
          </nav>

          <div className="border-t bg-muted/30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center rounded-lg hover:bg-muted transition-colors gap-3 p-2.5" data-testid="user-menu">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-white">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                {user?.customRole && (
                  <span className="inline-block text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 bg-emerald-100 text-emerald-700">
                    {user.customRole.name}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title={t('auth.logout')}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 sm:gap-4 h-full px-3 sm:px-4">
            <button
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setSidebarOpen(true)}
              data-testid="mobile-menu-button"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex-1" />
            <TenantSelector />
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2 text-sm pl-2 border-l">
              <span className="text-muted-foreground">{tNav('hello')}</span>
              <span className="font-medium">{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
