'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PermissionGateProps {
  /** Chave do módulo: dashboard, entities, data, apis, users, roles, settings, pages */
  module?: string;
  /** Para permissão em entidade específica */
  entitySlug?: string;
  /** Ação de entidade */
  action?: 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete';
  /** Se true, exige admin */
  requireAdmin?: boolean;
  /** Se true, exige PLATFORM_ADMIN */
  requirePlatformAdmin?: boolean;
  /** Fallback quando sem acesso (se não informado, mostra card de acesso restrito) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  module,
  entitySlug,
  action,
  requireAdmin,
  requirePlatformAdmin,
  fallback,
  children,
}: PermissionGateProps) {
  const { hasModuleAccess, hasEntityPermission, isAdmin, isPlatformAdmin } = usePermissions();
  const t = useTranslations('common');

  let hasAccess = true;

  if (requirePlatformAdmin) {
    hasAccess = isPlatformAdmin;
  } else if (requireAdmin) {
    hasAccess = isAdmin;
  } else if (module) {
    hasAccess = hasModuleAccess(module);
  }

  // Verificação adicional de entidade
  if (hasAccess && entitySlug && action) {
    hasAccess = hasEntityPermission(entitySlug, action);
  }

  if (!hasAccess) {
    if (fallback !== undefined) return <>{fallback}</>;

    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 p-8">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t('accessRestricted') || 'Acesso Restrito'}</h2>
          <p className="text-muted-foreground mt-1">
            {t('noPermission') || 'Você não tem permissão para acessar este recurso.'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
