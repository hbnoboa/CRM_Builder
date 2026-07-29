'use client';

import { Building2, ChevronDown, Globe, Home } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTenant } from '@/stores/tenant-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function TenantSelector() {
  const router = useRouter();
  const params = useParams();
  // Fonte da verdade do tenant atual = slug na URL (sempre em sincronia, sem race).
  const currentSlug = typeof params?.tenant === 'string' ? params.tenant : undefined;
  const {
    isPlatformAdmin,
    hasMultipleTenants,
    allTenants,
    accessibleTenants,
    switchTenant,
    tenant: ownTenant,
  } = useTenant();

  const handleSwitchTenant = (tenantId: string, slug?: string) => {
    switchTenant(tenantId);
    // Tenant na URL: navega para a home do tenant destino (/{slug}/home).
    router.push(slug ? `/${slug}/home` : '/home');
  };

  // Mostra p/ acesso de plataforma (permission-driven) ou usuarios multi-tenant
  if (!isPlatformAdmin && !hasMultipleTenants) return null;

  // PLATFORM_ADMIN: use allTenants, Multi-tenant: use accessibleTenants
  const tenants = isPlatformAdmin
    ? allTenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        isHome: false,
        customRole: { id: '', name: 'Admin' }
      }))
    : accessibleTenants;

  const currentTenant = tenants.find((t) => t.slug === currentSlug);
  const currentTenantName = currentTenant?.name || ownTenant?.name || 'Tenant';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 max-w-[180px] text-xs h-8 border-primary/50 bg-primary/5 text-primary"
        >
          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{currentTenantName}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        {tenants.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => handleSwitchTenant(t.id, t.slug)}
            className={cn(t.slug === currentSlug && 'bg-accent')}
          >
            <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm">{t.name}</span>
                {t.isHome && <Home className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
              </div>
              <span className="text-[10px] text-muted-foreground">{t.customRole.name}</span>
            </div>
            {t.slug === currentSlug && (
              <Badge variant="secondary" className="ml-auto text-[10px] px-1">
                ✓
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
