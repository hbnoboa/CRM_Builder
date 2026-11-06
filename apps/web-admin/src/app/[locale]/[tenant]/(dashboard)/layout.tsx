'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/tenant-navigation';
import {
  LayoutDashboard,
  Home,
  Users,
  Settings,
  X,
  Plus,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
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
  Settings2,
  MessageSquare,
  ShieldCheck,
  Trash2,
  LifeBuoy,
} from 'lucide-react';
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
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { OperationalShell } from '@/components/layout/operational-shell';
import { GestaoShell } from '@/components/layout/gestao-shell';
import { cn } from '@/lib/utils';
import { CommandMenu, ShellTopbar, SidebarBrand, navItemClass } from '@/components/layout/shell-parts';
import { TrialBanner, useTenantFeatures } from '@/components/subscription/subscription-widgets';
import { AnnouncementsBanner } from '@/components/announcements/announcements-banner';
import type { FeatureKey } from '@/types/platform';

interface NavItemConfig {
  titleKey: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  /** Chave do módulo para verificar permissão (via usePermissions) */
  moduleKey?: string;
  /** Função do plano do tenant; desligada = item some do menu */
  featureKey?: FeatureKey;
  /** Só para quem pode excluir em alguma tabela */
  trash?: boolean;
}

const topNavigation: NavItemConfig[] = [
  // Home de AÇÃO (sem gate): cards permission-aware decidem o que cada um vê (#21).
  { titleKey: 'home', href: '/home', icon: <Home className="h-4 w-4" /> },
  { titleKey: 'dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, moduleKey: 'dashboard' },
  { titleKey: 'chat', href: '/chat', icon: <MessageSquare className="h-4 w-4" />, featureKey: 'chat' },
];

const bottomNavigation: NavItemConfig[] = [
  { titleKey: 'trash', href: '/trash', icon: <Trash2 className="h-4 w-4" />, trash: true },
  { titleKey: 'support', href: '/support', icon: <LifeBuoy className="h-4 w-4" /> },
  // Configurações da CONTA é de todos (#21); o tab "Organização" dentro é que é gated.
  { titleKey: 'settings', href: '/settings', icon: <Settings className="h-4 w-4" /> },
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

function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const tNav = useTranslations('navigation');
  const { user, isAuthenticated, ensureAuth, isLoading } = useAuthStore();
  const { hasModuleAccess, hasModulePermission, getDefaultRoute, isOperationalSurface, canAccessAdminArea, canAccessAdminSection, canUseTrash } = usePermissions();
  const { tenant, effectiveTenantId } = useTenant();
  const features = useTenantFeatures();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });
  const [mounted, setMounted] = useState(false);
  const fetchedRef = useRef(false);

  // Tenant atual = slug da URL (sempre em sincronia). A lista de TABELAS refaz o
  // fetch ao trocar de tenant porque o slug entra na queryKey.
  const routeParams = useParams();
  const currentTenantSlug = typeof routeParams?.tenant === 'string' ? routeParams.tenant : undefined;
  const { data: entityGroups } = useEntitiesGrouped(currentTenantSlug);

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
      if (item.featureKey && !features[item.featureKey]) return false;
      if (!item.moduleKey) return true;
      return hasModuleAccess(item.moduleKey);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.customRole?.modulePermissions, user?.customRoleId, features]
  );

  const filteredBottomNav = useMemo(
    () => bottomNavigation.filter((item) => {
      if (item.trash && !canUseTrash) return false;
      if (item.featureKey && !features[item.featureKey]) return false;
      if (!item.moduleKey) return true;
      return hasModuleAccess(item.moduleKey);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.customRole?.modulePermissions, user?.customRoleId, features, canUseTrash]
  );

  const isRegistrosOpen = openCategories['__registros__'] !== false;
  const isRegistrosActive = pathname === '/data';

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
    const [segment, section] = pathname.split('/').filter(Boolean);
    // Administracao da empresa: regra por secao (ver ADMIN_SECTION_RULES).
    if (segment === 'gestao') {
      if (!canAccessAdminSection(section)) router.replace(canAccessAdminArea ? '/gestao' : getDefaultRoute());
      return;
    }
    // Rotas disponíveis a qualquer usuário autenticado (sem módulo próprio).
    // A visibilidade interna (ex.: canais do chat por tabela) é checada lá dentro.
    // Suporte: qualquer pessoa abre chamado. Lixeira: a API só lista o que a pessoa pode excluir.
    // Perfil e configurações são da PRÓPRIA conta (senha, 2 etapas, avisos, privacidade).
    const ALWAYS_ALLOWED = ['home', 'chat', 'support', 'trash', 'profile', 'settings'];
    if (segment && !ALWAYS_ALLOWED.includes(segment) && !hasModuleAccess(segment)) {
      const defaultRoute = getDefaultRoute();
      if (defaultRoute !== `/${segment}`) {
        router.replace(defaultRoute);
      }
    }
  }, [mounted, isLoading, isAuthenticated, user, pathname, hasModuleAccess, getDefaultRoute, router, canAccessAdminArea, canAccessAdminSection]);

  const renderNavLink = (item: NavItemConfig) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

    if (sidebarCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              prefetch={false}
              className={navItemClass(isActive, 'lg:justify-center lg:px-0')}
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
        className={navItemClass(isActive)}
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

  // Superficie OPERACIONAL (#18): usuarios sem modulos de gestao ganham um shell
  // proprio (slim, identidade "Operacional"), nao o console de admin. O guard de
  // rota acima ja redireciona URLs admin digitadas na mao para a home deles.
  if (pathname === '/gestao' || pathname.startsWith('/gestao/')) {
    return <GestaoShell>{children}</GestaoShell>;
  }

  if (isOperationalSurface) {
    return <OperationalShell>{children}</OperationalShell>;
  }

  return (
    <div className="min-h-screen bg-background pt-[var(--banner-h,0px)]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed bottom-0 top-[var(--banner-h,0px)] left-0 z-50 max-w-[calc(100vw-3rem)] lg:max-w-none bg-card border-r transform transition-all duration-200 ease-in-out lg:translate-x-0 overflow-hidden',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-64',
          'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <TooltipProvider delayDuration={0}>
          <div className="flex flex-col h-full">
            <div className={cn('flex items-center h-14 border-b', sidebarCollapsed ? 'lg:justify-center lg:px-2 px-4 gap-3' : 'gap-3 px-4')}>
              {/* Quando colapsada, só o botão de expandir (logo+nome somem) p/ caber no rail. */}
              <div className={cn('min-w-0 flex-1', sidebarCollapsed && 'lg:hidden')}>
                <SidebarBrand subtitle={user?.customRole?.name} />
              </div>
              <button
                className={cn('hidden lg:flex p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors', !sidebarCollapsed && '-mr-2')}
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
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className={cn('flex-1 overflow-y-auto', sidebarCollapsed ? 'lg:p-2 p-3' : 'p-3')}>
              {/* 1. Dashboard */}
              <div className="space-y-0.5">
                {filteredTopNav.map((item) => renderNavLink(item))}
              </div>

              {/* Separator */}
              <div className={cn('my-3 border-t', sidebarCollapsed && 'lg:mx-1')} />

              {/* 2. Entrada da administracao da empresa (modo separado, /gestao) */}
              {canAccessAdminArea && (
                <>
                  {sidebarCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href="/gestao"
                          prefetch={false}
                          data-testid="enter-gestao"
                          className="hidden lg:flex items-center justify-center rounded-md min-h-[36px] border bg-background text-foreground hover:bg-muted transition-colors"
                        >
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{tNav('gestao')}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      href="/gestao"
                      prefetch={false}
                      data-testid="enter-gestao"
                      onClick={() => setSidebarOpen(false)}
                      className="group flex items-center gap-3 rounded-md min-h-[42px] lg:min-h-[38px] px-2.5 text-sm font-medium border bg-background hover:border-primary/40 hover:bg-nav-active hover:text-nav-active-foreground transition-colors"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-nav-active text-nav-active-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1">{tNav('gestao')}</span>
                      <ChevronRight className="h-4 w-4 opacity-50 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
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
                            'hidden lg:flex items-center justify-center rounded-md min-h-[36px] w-full transition-colors',
                            isRegistrosActive
                              ? 'text-foreground bg-muted'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                        >
                          <Database className="h-4 w-4" />
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
                                href="/gestao/entities/new"
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
                                          'hidden lg:flex items-center justify-center rounded-md min-h-[36px] transition-colors',
                                          isActive
                                            ? 'bg-nav-active text-nav-active-foreground'
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
                          'flex items-center gap-3 flex-1 px-2.5 min-h-[36px] text-sm font-medium rounded-md transition-colors',
                          isRegistrosActive
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <Database className="h-4 w-4" />
                        <span className="flex-1 text-left">{tNav('data')}</span>
                        {isRegistrosOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      {hasModuleAccess('entities') && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href="/gestao/entities/new"
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
                                className="flex items-center gap-2 w-full px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
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
                                              'flex items-center rounded-md text-sm transition-colors min-h-[34px] gap-2.5 pl-7 pr-2.5 py-1 flex-1 min-w-0',
                                              isActive
                                                ? 'bg-nav-active text-nav-active-foreground font-medium'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                            )}
                                            onClick={() => setSidebarOpen(false)}
                                          >
                                            {getEntityIcon(entity.icon, isActive ? undefined : entity.color)}
                                            <span className="flex-1 truncate text-[13px]">{entity.name}</span>
                                            {entity._count && (
                                              <span className={cn(
                                                'text-[10px] tabular-nums',
                                                isActive ? 'text-nav-active-foreground/70' : 'text-muted-foreground/50'
                                              )}>
                                                {(entity._count.data || 0) + (entity._count.archivedData || 0)}
                                              </span>
                                            )}
                                          </Link>
                                          {canEditEntities && (
                                            <Link
                                              href={`/gestao/entities/${entity.id}`}
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
                                              const subHref = `/gestao/entities/${sub.id}`;
                                              const isSubActive = pathname === `/gestao/entities/${sub.id}`;
                                              return (
                                                <Link
                                                  key={sub.id}
                                                  href={subHref}
                                                  prefetch={false}
                                                  className={cn(
                                                    'flex items-center rounded-md text-xs transition-colors min-h-[30px] gap-2 pl-12 pr-2.5 py-1',
                                                    isSubActive
                                                      ? 'bg-nav-active text-nav-active-foreground font-medium'
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
              <div className="space-y-0.5">
                {filteredBottomNav.map((item) => renderNavLink(item))}
              </div>
            </nav>

          </div>
        </TooltipProvider>
      </aside>

      <div className={cn('transition-all duration-200', sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64')}>
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
            ...filteredTopNav.map((item) => ({ label: tNav(item.titleKey), href: item.href, icon: item.icon })),
            ...(canAccessAdminArea ? [{ label: tNav('gestao'), href: '/gestao', icon: <ShieldCheck className="h-4 w-4" />, keywords: ['admin', 'administracao', 'gestao'] }] : []),
            ...filteredBottomNav.map((item) => ({ label: tNav(item.titleKey), href: item.href, icon: item.icon })),
            { label: tNav('profile'), href: '/profile', icon: <Users className="h-4 w-4" /> },
          ]}
          actions={hasModuleAccess('entities') ? [{ label: tNav('newTable'), href: '/gestao/entities/new', keywords: ['criar', 'tabela', 'entidade'] }] : []}
        />

        <AnnouncementsBanner />
        <TrialBanner />
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
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
          <ImpersonationBanner />
          <DashboardContent>{children}</DashboardContent>
        </NotificationProvider>
      </TenantThemeProvider>
    </TenantProvider>
  );
}
