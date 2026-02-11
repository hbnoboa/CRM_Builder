'use client';

import { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import type { UserRole } from '@/types';

interface RequireRoleProps {
  children: ReactNode;
  // Roles permitidas (fallback legado)
  roles?: UserRole[];
  // Se true, apenas PLATFORM_ADMIN e ADMIN podem acessar (fallback legado)
  adminOnly?: boolean;
  /** Chave do módulo para verificar via customRole (dashboard, entities, apis, users, settings, pages) */
  module?: string;
  // Mensagem customizada
  message?: string;
  // Se true, redireciona ao inves de mostrar mensagem
  redirect?: string;
}

export function RequireRole({
  children,
  roles,
  adminOnly,
  module,
  message = 'Voce nao tem permissao para acessar esta pagina.',
}: RequireRoleProps) {
  const { user } = useAuthStore();
  const { hasModuleAccess } = usePermissions();
  const userRole = user?.customRole?.roleType as UserRole | undefined;

  // Verifica se tem acesso
  const hasAccess = (() => {
    if (!userRole) return false;

    // PLATFORM_ADMIN sempre tem acesso total
    if (userRole === 'PLATFORM_ADMIN') return true;

    // Se tem módulo definido, verificar via usePermissions (customRole + fallback role)
    if (module) {
      return hasModuleAccess(module);
    }

    // Fallback legado: se adminOnly, verificar via usePermissions
    if (adminOnly) {
      // Se tem customRole, verificar os módulos relevantes
      if (user?.customRole) {
        return hasModuleAccess('entities') || hasModuleAccess('settings') || hasModuleAccess('apis');
      }
      return userRole === 'ADMIN';
    }

    // Se tem roles especificas, verificar base role + customRole modulePermissions
    if (roles && roles.length > 0) {
      if (roles.includes(userRole)) {
        return true;
      }
      if (user?.customRole) {
        return hasModuleAccess('users') || hasModuleAccess('entities');
      }
      return false;
    }

    // Sem restricoes
    return true;
  })();

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              {message}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Sua role atual: <span className="font-medium">{userRole || 'Nao definida'}</span>
            </p>
            <Button variant="outline" asChild>
              <a href="/dashboard">Voltar ao Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

// Hook para verificar role (agora com suporte a customRole)
export function useHasRole(roles?: UserRole[], adminOnly?: boolean): boolean {
  const { user } = useAuthStore();
  const { hasModuleAccess, isAdmin, isPlatformAdmin } = usePermissions();
  const userRole = user?.customRole?.roleType as UserRole | undefined;

  if (!userRole) return false;
  if (isPlatformAdmin) return true;

  if (adminOnly) {
    if (isAdmin && !user?.customRole) return true;
    if (user?.customRole) {
      return hasModuleAccess('entities') || hasModuleAccess('settings') || hasModuleAccess('apis');
    }
    return isAdmin;
  }

  if (roles && roles.length > 0) {
    return roles.includes(userRole);
  }

  return true;
}

// Hook para verificar se e admin
export function useIsAdmin(): boolean {
  const { user } = useAuthStore();
  const roleType = user?.customRole?.roleType;
  return roleType === 'PLATFORM_ADMIN' || roleType === 'ADMIN';
}

// Hook para verificar se e platform admin
export function useIsPlatformAdmin(): boolean {
  const { user } = useAuthStore();
  return user?.customRole?.roleType === 'PLATFORM_ADMIN';
}
