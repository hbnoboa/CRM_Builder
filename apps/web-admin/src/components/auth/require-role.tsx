'use client';

import { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole } from '@/types';

interface RequireRoleProps {
  children: ReactNode;
  // Roles permitidas
  roles?: UserRole[];
  // Se true, apenas PLATFORM_ADMIN e ADMIN podem acessar
  adminOnly?: boolean;
  // Mensagem customizada
  message?: string;
  // Se true, redireciona ao inves de mostrar mensagem
  redirect?: string;
}

export function RequireRole({
  children,
  roles,
  adminOnly,
  message = 'Voce nao tem permissao para acessar esta pagina.',
}: RequireRoleProps) {
  const { user } = useAuthStore();
  const userRole = user?.role;

  // Verifica se tem acesso
  const hasAccess = (() => {
    if (!userRole) return false;

    // Se adminOnly, apenas PLATFORM_ADMIN e ADMIN
    if (adminOnly) {
      return userRole === 'PLATFORM_ADMIN' || userRole === 'ADMIN';
    }

    // Se tem roles especificas, verifica
    if (roles && roles.length > 0) {
      return roles.includes(userRole);
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

// Hook para verificar role
export function useHasRole(roles?: UserRole[], adminOnly?: boolean): boolean {
  const { user } = useAuthStore();
  const userRole = user?.role;

  if (!userRole) return false;

  if (adminOnly) {
    return userRole === 'PLATFORM_ADMIN' || userRole === 'ADMIN';
  }

  if (roles && roles.length > 0) {
    return roles.includes(userRole);
  }

  return true;
}

// Hook para verificar se e admin
export function useIsAdmin(): boolean {
  const { user } = useAuthStore();
  return user?.role === 'PLATFORM_ADMIN' || user?.role === 'ADMIN';
}

// Hook para verificar se e platform admin
export function useIsPlatformAdmin(): boolean {
  const { user } = useAuthStore();
  return user?.role === 'PLATFORM_ADMIN';
}
