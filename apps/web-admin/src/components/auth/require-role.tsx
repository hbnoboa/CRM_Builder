'use client';

import { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions, readPlatformAccess } from '@/hooks/use-permissions';
interface RequireRoleProps {
  children: ReactNode;
  // Cargos permitidos por nome (fallback legado, permission-driven)
  roles?: string[];
  // Se true, exige acesso administrativo (fallback legado, permission-driven)
  adminOnly?: boolean;
  /** Chave do módulo para verificar via customRole (dashboard, entities, apis, users, settings, pages) */
  module?: string;
  /** Acao CRUD especifica no modulo (canRead/canCreate/canUpdate/canDelete). Default: canRead. */
  action?: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete';
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
  action,
  message = 'Voce nao tem permissao para acessar esta pagina.',
}: RequireRoleProps) {
  const { user } = useAuthStore();
  const { hasModuleAccess, hasModulePermission, isPlatformAdmin } = usePermissions();
  // Autorizacao e permission-driven: nome do cargo so para exibicao.
  const roleName = user?.customRole?.name;

  // Verifica se tem acesso
  const hasAccess = (() => {
    if (!user?.customRole) return false;

    // Acesso de plataforma (permission-driven) sempre tem acesso total
    if (isPlatformAdmin) return true;

    // Se tem módulo definido, verificar via usePermissions (customRole)
    if (module) {
      return action ? hasModulePermission(module, action) : hasModuleAccess(module);
    }

    // Fallback legado: se adminOnly, verificar módulos administrativos
    if (adminOnly) {
      return hasModuleAccess('entities') || hasModuleAccess('settings') || hasModuleAccess('users');
    }

    // Fallback legado: roles por nome do cargo
    if (roles && roles.length > 0) {
      return !!roleName && roles.includes(roleName);
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
              Sua role atual: <span className="font-medium">{roleName || 'Nao definida'}</span>
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

// Hook para verificar role (permission-driven via customRole)
export function useHasRole(roles?: string[], adminOnly?: boolean): boolean {
  const { user } = useAuthStore();
  const { hasModuleAccess, isPlatformAdmin } = usePermissions();
  const roleName = user?.customRole?.name;

  if (isPlatformAdmin) return true;
  if (!user?.customRole) return false;

  if (adminOnly) {
    return hasModuleAccess('entities') || hasModuleAccess('settings') || hasModuleAccess('users');
  }

  if (roles && roles.length > 0) {
    return !!roleName && roles.includes(roleName);
  }

  return true;
}

// Hook para verificar se e admin (permission-driven: "admin com tudo" = acesso de plataforma)
export function useIsAdmin(): boolean {
  const { user } = useAuthStore();
  return readPlatformAccess(user?.customRole?.modulePermissions as Record<string, unknown> | undefined);
}

// Hook para verificar se e platform admin (permission-driven)
export function useIsPlatformAdmin(): boolean {
  const { user } = useAuthStore();
  return readPlatformAccess(user?.customRole?.modulePermissions as Record<string, unknown> | undefined);
}
