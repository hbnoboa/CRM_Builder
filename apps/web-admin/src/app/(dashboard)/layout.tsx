'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Database,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Layers,
  Code,
  Search,
  Shield,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { TenantProvider } from '@/stores/tenant-context';
import { NotificationProvider } from '@/providers/notification-provider';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  // Roles que podem ver este item (vazio = todos)
  roles?: UserRole[];
  // Se true, so mostra para admins (PLATFORM_ADMIN, ADMIN)
  adminOnly?: boolean;
}

// Definicao de navegacao com restricoes de role
const navigation: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    // Todos podem ver o dashboard
  },
  {
    title: 'Entidades',
    href: '/entities',
    icon: <Database className="h-5 w-5" />,
    // Apenas admins podem configurar entidades
    adminOnly: true,
  },
  {
    title: 'Dados',
    href: '/data',
    icon: <Layers className="h-5 w-5" />,
    // Todos podem ver dados (com restricoes de escopo no backend)
  },
  {
    title: 'Paginas',
    href: '/pages',
    icon: <FileText className="h-5 w-5" />,
    // Apenas admins podem criar paginas
    adminOnly: true,
  },
  {
    title: 'APIs',
    href: '/apis',
    icon: <Code className="h-5 w-5" />,
    // Apenas admins podem criar APIs
    adminOnly: true,
  },
  {
    title: 'Usuarios',
    href: '/users',
    icon: <Users className="h-5 w-5" />,
    // Admins e Managers podem ver usuarios
    roles: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    title: 'Roles',
    href: '/roles',
    icon: <Shield className="h-5 w-5" />,
    // Apenas admins podem gerenciar roles
    adminOnly: true,
  },
  {
    title: 'Organizacao',
    href: '/organization',
    icon: <Building2 className="h-5 w-5" />,
    // Admins e Managers podem ver organizacao
    roles: ['PLATFORM_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    title: 'Configuracoes',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    // Apenas admins podem alterar configuracoes
    adminOnly: true,
  },
];

// Funcao para filtrar navegacao por role
function getNavigationForRole(role: UserRole | undefined): NavItem[] {
  if (!role) return [];

  const isAdmin = role === 'PLATFORM_ADMIN' || role === 'ADMIN';

  return navigation.filter((item) => {
    // Se adminOnly e nao e admin, esconde
    if (item.adminOnly && !isAdmin) {
      return false;
    }

    // Se tem roles especificas, verifica se o usuario esta nelas
    if (item.roles && item.roles.length > 0) {
      return item.roles.includes(role);
    }

    // Sem restricoes, mostra para todos
    return true;
  });
}

// Labels e cores para roles
const roleConfig: Record<UserRole, { label: string; color: string; bgColor: string }> = {
  PLATFORM_ADMIN: {
    label: 'Super Admin',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  ADMIN: {
    label: 'Administrador',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  MANAGER: {
    label: 'Gerente',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  USER: {
    label: 'Usuario',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  VIEWER: {
    label: 'Visualizador',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
};

function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, getProfile, isLoading } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fetchedRef = useRef(false);

  // Filtra navegacao baseado na role do usuario
  const filteredNavigation = useMemo(
    () => getNavigationForRole(user?.role),
    [user?.role]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !fetchedRef.current) {
      fetchedRef.current = true;
      
      // Check for token in localStorage
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
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 h-16 px-4 border-b">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">C</span>
            </div>
            <span className="font-semibold text-lg">CRM Builder</span>
            <button
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
              data-testid="mobile-menu-button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Workspace Switcher */}
          <div className="px-3 py-3 border-b">
            <WorkspaceSwitcher />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.icon}
                  <span className="flex-1">{item.title}</span>
                  {item.badge && (
                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-3 border-t bg-muted/30">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors" data-testid="user-menu">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                {user?.role && (
                  <span
                    className={cn(
                      'inline-block text-xs px-1.5 py-0.5 rounded font-medium mt-0.5',
                      roleConfig[user.role]?.bgColor || 'bg-gray-100',
                      roleConfig[user.role]?.color || 'text-gray-700'
                    )}
                  >
                    {roleConfig[user.role]?.label || user.role}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Logout"
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-4 h-full px-4">
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              data-testid="mobile-menu-button"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Search */}
            <div className="hidden md:flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-9 pr-12 bg-muted/50 border-0 focus-visible:ring-1"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded">⌘</kbd>
                  <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded">K</kbd>
                </div>
              </div>
            </div>

            <div className="flex-1 md:hidden" />

            {/* Notification Bell with real-time notifications */}
            <NotificationBell />

            <div className="hidden sm:flex items-center gap-2 text-sm pl-2 border-l">
              <span className="text-muted-foreground">Hello,</span>
              <span className="font-medium">{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
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
