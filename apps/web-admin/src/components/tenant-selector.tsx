'use client';

import { Building2, ChevronDown, Globe, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const {
    isPlatformAdmin,
    allTenants,
    selectedTenantId,
    switchTenant,
    tenant: ownTenant,
  } = useTenant();

  if (!isPlatformAdmin) return null;

  const selectedTenant = selectedTenantId
    ? allTenants.find((t) => t.id === selectedTenantId)
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-1.5 max-w-[180px] text-xs h-8',
            selectedTenantId
              ? 'border-primary/50 bg-primary/5 text-primary'
              : 'text-muted-foreground'
          )}
        >
          {selectedTenantId ? (
            <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <Globe className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <span className="truncate">
            {selectedTenant?.name || 'Todos os Tenants'}
          </span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuItem
          onClick={() => switchTenant(null)}
          className={cn(!selectedTenantId && 'bg-accent')}
        >
          <Globe className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">Todos os Tenants</span>
          {!selectedTenantId && (
            <Badge variant="secondary" className="ml-auto text-[10px] px-1">
              ✓
            </Badge>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {allTenants.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => switchTenant(t.id)}
            className={cn(selectedTenantId === t.id && 'bg-accent')}
          >
            <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate flex-1">{t.name}</span>
            {selectedTenantId === t.id && (
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
