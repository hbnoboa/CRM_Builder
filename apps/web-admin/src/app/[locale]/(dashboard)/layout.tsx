'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import {
  LayoutDashboard,
  Users,
  Database,
  Settings,
  LogOut,
  Menu,
  X,
  Layers,
  Code,
  Search,
  Building2,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { TenantProvider, useTenant } from '@/stores/tenant-context';
import { NotificationProvider } from '@/providers/notification-provider';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { LanguageSwitcher } from '@/components/language-switcher';
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

const navigationConfig: NavItemConfig[] = [
  {
    titleKey: 'dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    moduleKey: 'dashboard',
  },
  {
    titleKey: 'tenants',
    href: '/tenants',
    icon: <Building2 className="h-5 w-5" />,
    moduleKey: 'tenants',
  },
  {
    titleKey: 'entities',
    href: '/entities',
    icon: <Database className="h-5 w-5" />,
    moduleKey: 'entities',
  },
  {
    titleKey: 'data',
    href: '/data',
    icon: <Layers className="h-5 w-5" />,
    moduleKey: 'data',
  },
  {
    titleKey: 'apis',
    href: '/apis',
    icon: <Code className="h-5 w-5" />,
    moduleKey: 'apis',
  },
  {
    titleKey: 'users',
    href: '/users',
    icon: <Users className="h-5 w-5" />,
    moduleKey: 'users',
  },
  {
    titleKey: 'roles',
    href: '/roles',
    icon: <Shield className="h-5 w-5" />,
    moduleKey: 'roles',
  },
  {
    titleKey: 'settings',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    moduleKey: 'settings',
  },
];

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
  const t = useTranslations();
  const tNav = useTranslations('navigation');
  const tRoles = useTranslations('roles');
  const { user, isAuthenticated, logout, getProfile, isLoading } = useAuthStore();
  const { hasModuleAccess } = usePermissions();
  const { tenant } = useTenant();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fetchedRef = useRef(false);

  const filteredNavigation = useMemo(
    () => navigationConfig.filter((item) => {
      if (!item.moduleKey) return true;
      return hasModuleAccess(item.moduleKey);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.customRole?.roleType, user?.customRole?.modulePermissions, user?.customRoleId]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !fetchedRef.current) {
      fetchedRef.current = true;

      const token = localStorage.getItem('accessToken');
      if (!token && !isAuthenticated) {
        router.push('/login');
        return;
      }

      getProfile().catch(() => {
        router.push('/login');
      });
    }
  }, [mounted, getProfile, router, isAuthenticated]);

  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
      }
    }
  }, [mounted, isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
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
          'fixed inset-y-0 left-0 z-50 w-64 max-w-[calc(100vw-3rem)] lg:max-w-none bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 h-16 px-4 border-b">
            {tenant?.logo ? (
              <img src={tenant.logo} alt={tenant.name} className="h-8 w-8 flex-shrink-0 object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-primary-foreground">{(tenant?.name || 'C')[0].toUpperCase()}</span>
              </div>
            )}
            <span className="font-semibold text-lg truncate">{tenant?.name || 'CRM Builder'}</span>
            <button
              className="ml-auto lg:hidden p-2 -mr-2 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
              onClick={() => setSidebarOpen(false)}
              data-testid="mobile-menu-button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px]',
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
            })}
          </nav>

          <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t bg-muted/30">
            <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors" data-testid="user-menu">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
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
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
              onClick={() => setSidebarOpen(true)}
              data-testid="mobile-menu-button"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="hidden md:flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('common.search')}
                  className="pl-9 pr-12 bg-muted/50 border-0 focus-visible:ring-1"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded">⌘</kbd>
                  <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded">K</kbd>
                </div>
              </div>
            </div>

            <div className="flex-1 md:hidden" />

            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground"
              aria-label={t('common.search')}
            >
              <Search className="h-5 w-5" />
            </button>

            <TenantSelector />

            <LanguageSwitcher />

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
      <NotificationProvider>
        <DashboardContent>{children}</DashboardContent>
      </NotificationProvider>
    </TenantProvider>
  );
}
