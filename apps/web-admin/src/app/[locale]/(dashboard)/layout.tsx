'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Shield,
  Plus,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Target,
  Briefcase,
  TicketCheck,
  FolderKanban,
  CheckSquare,
  Wrench,
  Cpu,
  ClipboardCheck,
  Package,
  UserCheck,
  CircleDot,
  Layers,
  FileText,
  BarChart3,
  Settings2,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { useEntitiesGrouped } from '@/hooks/use-entities';
import { TenantProvider, useTenant } from '@/stores/tenant-context';
import { NotificationProvider } from '@/providers/notification-provider';
import { TenantThemeProvider } from '@/providers/tenant-theme-provider';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { TenantSelector } from '@/components/tenant-selector';
import { cn } from '@/lib/utils';
import type { RoleType } from '@/types';

interface NavItemConfig {
  titleKey: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  /** Chave do módulo para verificar permissão (via usePermissions) */
  moduleKey?: string;
}

const topNavigation: NavItemConfig[] = [
  { titleKey: 'dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" />, moduleKey: 'dashboard' },
];

const adminNavigation: NavItemConfig[] = [
  { titleKey: 'tenants', href: '/tenants', icon: <Building2 className="h-5 w-5" />, moduleKey: 'tenants' },
  { titleKey: 'users', href: '/users', icon: <Users className="h-5 w-5" />, moduleKey: 'users' },
  { titleKey: 'roles', href: '/roles', icon: <Shield className="h-5 w-5" />, moduleKey: 'roles' },
  { titleKey: 'pdfTemplates', href: '/pdf-templates', icon: <FileText className="h-5 w-5" />, moduleKey: 'pdfTemplates' },
  { titleKey: 'auditLogs', href: '/audit-logs', icon: <ScrollText className="h-5 w-5" />, moduleKey: 'auditLogs' },
  { titleKey: 'dashboardTemplates', href: '/dashboard-templates', icon: <BarChart3 className="h-5 w-5" />, moduleKey: 'dashboardTemplates' },
  { titleKey: 'publicLinks', href: '/public-links', icon: <Link2 className="h-5 w-5" />, moduleKey: 'publicLinks' },
];

const bottomNavigation: NavItemConfig[] = [
  { titleKey: 'settings', href: '/settings', icon: <Settings className="h-5 w-5" />, moduleKey: 'settings' },
];

const iconMap: Record<string, React.ReactNode> = {
  Target: <Target className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  Briefcase: <Briefcase className="h-4 w-4" />,
  TicketCheck: <TicketCheck className="h-4 w-4" />,
  FolderKanban: <FolderKanban className="h-4 w-4" />,
  CheckSquare: <CheckSquare className="h-4 w-4" />,
  Wrench: <Wrench className="h-4 w-4" />,
  Cpu: <Cpu className="h-4 w-4" />,
  ClipboardCheck: <ClipboardCheck className="h-4 w-4" />,
  Package: <Package className="h-4 w-4" />,
  UserCheck: <UserCheck className="h-4 w-4" />,
};

function getEntityIcon(iconName?: string, color?: string) {
  if (iconName && iconMap[iconName]) {
    return <span style={{ color: color || undefined }}>{iconMap[iconName]}</span>;
  }
  return <CircleDot className="h-4 w-4 text-muted-foreground" />;
}

const roleColors: Record<RoleType, { color: string; bgColor: string }> = {
  PLATFORM_ADMIN: {
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  ADMIN: {
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  MANAGER: {
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  USER: {
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  VIEWER: {
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  CUSTOM: {
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
  },
};

function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const tNav = useTranslations('navigation');
  const tRoles = useTranslations('roles');
  const { user, isAuthenticated, logout, ensureAuth, isLoading } = useAuthStore();
  const { hasModuleAccess, hasModulePermission, getDefaultRoute } = usePermissions();
  const { tenant, effectiveTenantId } = useTenant();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });
  const [mounted, setMounted] = useState(false);
  const fetchedRef = useRef(false);

  const { data: entityGroups } = useEntitiesGrouped(effectiveTenantId);

  // Category open/close state saved in localStorage
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('sidebar-categories');
        return saved ? JSON.parse(saved) : {};
      } catch { return {}; }
    }
    return {};
  });

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => {
      const next = { ...prev, [cat]: !prev[cat] };
      localStorage.setItem('sidebar-categories', JSON.stringify(next));
      return next;
    });
  };

  // By default, categories are open
  const isCategoryOpen = (cat: string) => openCategories[cat] !== false;

  const filteredTopNav = useMemo(
    () => topNavigation.filter((item) => {
      if (!item.moduleKey) return true;
      return hasModuleAccess(item.moduleKey);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.customRole?.roleType, user?.customRole?.modulePermissions, user?.customRoleId]
  );

  const filteredAdminNav = useMemo(
    () => adminNavigation.filter((item) => {
      if (!item.moduleKey) return true;
      return hasModuleAccess(item.moduleKey);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.customRole?.roleType, user?.customRole?.modulePermissions, user?.customRoleId]
  );

  const filteredBottomNav = useMemo(
    () => bottomNavigation.filter((item) => {
      if (!item.moduleKey) return true;
      return hasModuleAccess(item.moduleKey);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.customRole?.roleType, user?.customRole?.modulePermissions, user?.customRoleId]
  );

  const isAdminOpen = openCategories['__admin__'] !== false;
  const isAdminActive = filteredAdminNav.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  const isRegistrosOpen = openCategories['__registros__'] !== false;
  const isRegistrosActive = pathname === '/data' || pathname.startsWith('/entities');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !fetchedRef.current) {
      fetchedRef.current = true;
      ensureAuth().then((result) => {
        if (result === 'redirect') router.push('/login');
      });
    }
  }, [mounted, ensureAuth, router]);

  // Redirect if user doesn't have access to the current module
  useEffect(() => {
    if (!mounted || isLoading || !isAuthenticated || !user) return;

    // Map pathname to moduleKey
    const segment = pathname.split('/').filter(Boolean)[0];
    if (segment && !hasModuleAccess(segment)) {
      const defaultRoute = getDefaultRoute();
      if (defaultRoute !== `/${segment}`) {
        router.replace(defaultRoute);
      }
    }
  }, [mounted, isLoading, isAuthenticated, user, pathname, hasModuleAccess, getDefaultRoute, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const renderNavLink = (item: NavItemConfig) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

    if (sidebarCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              prefetch={false}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-all min-h-[44px]',
                'lg:justify-center lg:px-0 lg:py-2.5 gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              <span className="lg:hidden flex-1">{tNav(item.titleKey)}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="hidden lg:block">
            {tNav(item.titleKey)}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        className={cn(
          'flex items-center rounded-lg text-sm font-medium transition-all min-h-[44px] gap-3 px-3 py-2.5',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        onClick={() => setSidebarOpen(false)}
      >
        {item.icon}
        <span className="flex-1">{tNav(item.titleKey)}</span>
        {item.badge && (
          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  if (!mounted || (isLoading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 max-w-[calc(100vw-3rem)] lg:max-w-none bg-card border-r transform transition-all duration-200 ease-in-out lg:translate-x-0',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-64',
          'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <TooltipProvider delayDuration={0}>
          <div className="flex flex-col h-full">
            <div className={cn('flex items-center h-16 border-b', sidebarCollapsed ? 'lg:justify-center lg:px-2 px-4 gap-3' : 'gap-3 px-4')}>
              {tenant?.logo ? (
                <img src={tenant.logo} alt={tenant.name} className="h-8 w-8 flex-shrink-0 object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-primary-foreground">{(tenant?.name || 'C')[0].toUpperCase()}</span>
                </div>
              )}
              <span className={cn('font-semibold text-lg truncate flex-1', sidebarCollapsed && 'lg:hidden')}>{tenant?.name || 'CRM Builder'}</span>
              <button
                className="hidden lg:flex p-2 -mr-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={() => {
                  setSidebarCollapsed(prev => {
                    const next = !prev;
                    localStorage.setItem('sidebar-collapsed', String(next));
                    return next;
                  });
                }}
                title={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
              <button
                className="ml-auto lg:hidden p-2 -mr-2 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
                onClick={() => setSidebarOpen(false)}
                data-testid="mobile-menu-button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className={cn('flex-1 overflow-y-auto', sidebarCollapsed ? 'lg:p-2 p-3' : 'p-3')}>
              {/* 1. Dashboard */}
              <div className="space-y-1">
                {filteredTopNav.map((item) => renderNavLink(item))}
              </div>

              {/* Separator */}
              <div className={cn('my-3 border-t', sidebarCollapsed && 'lg:mx-1')} />

              {/* 2. Admin section - collapsible */}
              {filteredAdminNav.length > 0 && (
                <>
                  <div className="mb-1">
                    {sidebarCollapsed ? (
                      <div className="space-y-1">
                        {filteredAdminNav.map((item) => renderNavLink(item))}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleCategory('__admin__')}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                            isAdminActive
                              ? 'text-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                        >
                          <Shield className="h-5 w-5" />
                          <span className="flex-1 text-left">{tNav('admin')}</span>
                          {isAdminOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        {isAdminOpen && (
                          <div className="space-y-0.5 mt-0.5">
                            {filteredAdminNav.map((item) => {
                              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  prefetch={false}
                                  className={cn(
                                    'flex items-center rounded-lg text-sm transition-all min-h-[36px] gap-2.5 pl-7 pr-3 py-1.5',
                                    isActive
                                      ? 'bg-primary text-primary-foreground shadow-sm'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                  )}
                                  onClick={() => setSidebarOpen(false)}
                                >
                                  {item.icon}
                                  <span className="flex-1 truncate text-[13px]">{tNav(item.titleKey)}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className={cn('my-3 border-t', sidebarCollapsed && 'lg:mx-1')} />
                </>
              )}

              {/* 4. Registros - collapsible dropdown with + button and entity list */}
              <div className="mb-1">
                {sidebarCollapsed ? (
                  <div className="space-y-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => toggleCategory('__registros__')}
                          className={cn(
                            'hidden lg:flex items-center justify-center rounded-lg min-h-[44px] w-full transition-all',
                            isRegistrosActive
                              ? 'text-foreground bg-muted'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                        >
                          <Database className="h-5 w-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{tNav('data')}</TooltipContent>
                    </Tooltip>
                    {isRegistrosOpen && (
                      <>
                        {hasModuleAccess('entities') && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href="/entities/new"
                                prefetch={false}
                                className="hidden lg:flex items-center justify-center rounded-lg min-h-[40px] transition-all text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => setSidebarOpen(false)}
                              >
                                <Plus className="h-4 w-4" />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">{t('entities.newEntity')}</TooltipContent>
                          </Tooltip>
                        )}
                        {entityGroups && entityGroups.length > 0 && entityGroups.map((group) => {
                          const catKey = group.category || '__uncategorized__';
                          return (
                            <div key={catKey} className="space-y-1">
                              {group.entities.map((entity) => {
                                const href = `/data?entity=${entity.slug}`;
                                const isActive = pathname === '/data' && searchParams.get('entity') === entity.slug;
                                return (
                                  <Tooltip key={entity.id}>
                                    <TooltipTrigger asChild>
                                      <Link
                                        href={href}
                                        prefetch={false}
                                        className={cn(
                                          'hidden lg:flex items-center justify-center rounded-lg min-h-[40px] transition-all',
                                          isActive
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                        )}
                                        onClick={() => setSidebarOpen(false)}
                                      >
                                        {getEntityIcon(entity.icon, isActive ? undefined : entity.color)}
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                      <p>{entity.name}</p>
                                      {entity._count && <p className="text-xs text-muted-foreground">{(entity._count.data || 0) + (entity._count.archivedData || 0)} registros</p>}
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleCategory('__registros__')}
                        className={cn(
                          'flex items-center gap-2 flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                          isRegistrosActive
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <Database className="h-5 w-5" />
                        <span className="flex-1 text-left">{tNav('data')}</span>
                        {isRegistrosOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      {hasModuleAccess('entities') && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href="/entities/new"
                              prefetch={false}
                              className="p-1.5 mr-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                              onClick={(e) => { e.stopPropagation(); setSidebarOpen(false); }}
                            >
                              <Plus className="h-4 w-4" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            {t('entities.newEntity')}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {isRegistrosOpen && (
                      <div className="mt-0.5">
                        {entityGroups && entityGroups.length > 0 ? entityGroups.map((group) => {
                          const catKey = group.category || '__uncategorized__';
                          const catLabel = group.category || tNav('entities');
                          const isOpen = isCategoryOpen(catKey);

                          return (
                            <div key={catKey} className="mb-1">
                              <button
                                onClick={() => toggleCategory(catKey)}
                                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                              >
                                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span className="truncate">{catLabel}</span>
                                <span className="ml-auto text-[10px] font-normal text-muted-foreground/50">
                                  {group.entities.length}
                                </span>
                              </button>
                              {isOpen && (
                                <div className="space-y-0.5 mt-0.5">
                                  {group.entities.map((entity) => {
                                    const href = `/data?entity=${entity.slug}`;
                                    const isActive = pathname === '/data' && searchParams.get('entity') === entity.slug;
                                    const subEntities = (entity as any).subEntities as Array<{ id: string; name: string; slug: string; icon?: string; color?: string }> | undefined;
                                    const canEditEntities = hasModulePermission('entities', 'canUpdate');
                                    return (
                                      <div key={entity.id}>
                                        <div className="flex items-center group">
                                          <Link
                                            href={href}
                                            prefetch={false}
                                            className={cn(
                                              'flex items-center rounded-lg text-sm transition-all min-h-[36px] gap-2.5 pl-7 pr-3 py-1.5 flex-1 min-w-0',
                                              isActive
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                            )}
                                            onClick={() => setSidebarOpen(false)}
                                          >
                                            {getEntityIcon(entity.icon, isActive ? undefined : entity.color)}
                                            <span className="flex-1 truncate text-[13px]">{entity.name}</span>
                                            {entity._count && (
                                              <span className={cn(
                                                'text-[10px] tabular-nums',
                                                isActive ? 'text-primary-foreground/70' : 'text-muted-foreground/50'
                                              )}>
                                                {(entity._count.data || 0) + (entity._count.archivedData || 0)}
                                              </span>
                                            )}
                                          </Link>
                                          {canEditEntities && (
                                            <Link
                                              href={`/entities/${entity.id}`}
                                              prefetch={false}
                                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 mr-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                              onClick={(e) => { e.stopPropagation(); setSidebarOpen(false); }}
                                            >
                                              <Settings2 className="h-3.5 w-3.5" />
                                            </Link>
                                          )}
                                        </div>
                                        {canEditEntities && subEntities && subEntities.length > 0 && (
                                          <div className="space-y-0.5 mt-0.5">
                                            {subEntities.map((sub) => {
                                              const subHref = `/entities/${sub.id}`;
                                              const isSubActive = pathname === `/entities/${sub.id}`;
                                              return (
                                                <Link
                                                  key={sub.id}
                                                  href={subHref}
                                                  prefetch={false}
                                                  className={cn(
                                                    'flex items-center rounded-lg text-xs transition-all min-h-[30px] gap-2 pl-12 pr-3 py-1',
                                                    isSubActive
                                                      ? 'bg-primary text-primary-foreground shadow-sm'
                                                      : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted'
                                                  )}
                                                  onClick={() => setSidebarOpen(false)}
                                                >
                                                  <Layers className="h-3 w-3 flex-shrink-0" />
                                                  <span className="flex-1 truncate">{sub.name}</span>
                                                </Link>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }) : (
                          <p className="px-3 py-2 text-xs text-muted-foreground/50">{t('entities.noEntitiesFound')}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Separator before Settings */}
              <div className={cn('my-3 border-t', sidebarCollapsed && 'lg:mx-1')} />

              {/* 4. Settings */}
              <div className="space-y-1">
                {filteredBottomNav.map((item) => renderNavLink(item))}
              </div>
            </nav>

            <div className={cn('border-t bg-muted/30', sidebarCollapsed ? 'lg:p-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]')}>
              <div className={cn('flex items-center rounded-lg hover:bg-muted transition-colors', sidebarCollapsed ? 'lg:justify-center lg:p-2 gap-3 p-2.5' : 'gap-3 p-2.5')} data-testid="user-menu">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-white">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className={cn('flex-1 min-w-0', sidebarCollapsed && 'lg:hidden')}>
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                  {user?.customRole && (
                    <span
                      className={cn(
                        'inline-block text-xs px-1.5 py-0.5 rounded font-medium mt-0.5',
                        user.customRole.isSystem
                          ? roleColors[user.customRole.roleType as RoleType]?.bgColor || 'bg-gray-100'
                          : 'bg-indigo-100',
                        user.customRole.isSystem
                          ? roleColors[user.customRole.roleType as RoleType]?.color || 'text-gray-700'
                          : 'text-indigo-700'
                      )}
                    >
                      {user.customRole.isSystem
                        ? tRoles(user.customRole.roleType)
                        : user.customRole.name}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title={t('auth.logout')}
                  className={cn('text-muted-foreground hover:text-destructive', sidebarCollapsed && 'lg:hidden')}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </aside>

      <div className={cn('transition-all duration-200', sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <header className="sticky top-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 sm:gap-4 h-full px-3 sm:px-4">
            <button
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
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

        <main className="p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TenantProvider>
      <TenantThemeProvider>
        <NotificationProvider>
          <DashboardContent>{children}</DashboardContent>
        </NotificationProvider>
      </TenantThemeProvider>
    </TenantProvider>
  );
}
