'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from './auth-store';
import { readPlatformAccess } from '@/hooks/use-permissions';
import api from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  settings?: {
    theme?: {
      brandColor?: string;
      darkMode?: 'light' | 'dark' | 'system';
    };
    [key: string]: unknown;
  };
}

interface AccessibleTenant {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  isHome: boolean;
  customRole: {
    id: string;
    name: string;
  };
}

interface TenantContextType {
  tenantId: string | null;
  loading: boolean;
  tenant: Tenant | null;
  /** All tenants available (only for PLATFORM_ADMIN) */
  allTenants: Tenant[];
  /** Tenants accessible by current user (multi-tenant users) */
  accessibleTenants: AccessibleTenant[];
  /** Currently selected tenant for cross-tenant browsing (PLATFORM_ADMIN only) */
  selectedTenantId: string | null;
  /** The effective tenantId to use for API calls / query keys (derivado do slug da URL) */
  effectiveTenantId: string | null;
  /** Slug do tenant atual (fonte da verdade = URL). */
  slug: string | null;
  /** Switch to a different tenant context */
  switchTenant: (tenantId: string | null) => void;
  /** Whether the user is a PLATFORM_ADMIN */
  isPlatformAdmin: boolean;
  /** Whether the user has access to multiple tenants */
  hasMultipleTenants: boolean;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user, switchTenant: authSwitchTenant } = useAuthStore();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [accessibleTenants, setAccessibleTenants] = useState<AccessibleTenant[]>([]);
  const [loading, setLoading] = useState(true);

  // FONTE DA VERDADE do tenant atual = slug da URL (/{locale}/{tenant}/...).
  const params = useParams();
  const tenantParam = params?.tenant;
  const urlSlug = typeof tenantParam === 'string'
    ? tenantParam
    : Array.isArray(tenantParam) ? tenantParam[0] : undefined;

  // Poder de plataforma agora vem de PERMISSAO (permission-driven), nao roleType.
  const isPlatformAdmin = readPlatformAccess(
    user?.customRole?.modulePermissions as Record<string, unknown> | undefined,
  );
  const hasMultipleTenants = !!(user as unknown as Record<string, unknown>)?.hasMultipleTenants;

  // Resolve o slug da URL -> id (síncrono, das listas já carregadas). Único ponto
  // de "tenant atual" -> elimina cache/estado defasado em todos os consumidores.
  const resolvedTenantId = useMemo(() => {
    if (!urlSlug) return tenant?.id ?? user?.tenantId ?? null;
    if (tenant?.slug === urlSlug) return tenant.id;
    const fromAccessible = accessibleTenants.find((t) => t.slug === urlSlug);
    if (fromAccessible) return fromAccessible.id;
    const fromAll = allTenants.find((t) => t.slug === urlSlug);
    if (fromAll) return fromAll.id;
    return tenant?.id ?? user?.tenantId ?? null;
  }, [urlSlug, tenant, accessibleTenants, allTenants, user]);

  const fetchTenantData = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token || !user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch own tenant info
      const tenantRes = await api.get('/tenants/me');
      if (tenantRes.data) {
        setTenant(tenantRes.data);
      }

      // If PLATFORM_ADMIN, also fetch all tenants for the switcher
      if (isPlatformAdmin) {
        const allRes = await api.get('/tenants', { params: { limit: 100 } });
        if (allRes.data?.data) {
          setAllTenants(allRes.data.data);
        }
      }

      // If user has multi-tenant access, fetch accessible tenants
      if (hasMultipleTenants && !isPlatformAdmin) {
        try {
          const accessRes = await api.get('/auth/accessible-tenants');
          if (Array.isArray(accessRes.data)) {
            setAccessibleTenants(accessRes.data);
          }
        } catch {
          // silently fail
        }
      }
    } catch (error) {
      console.error('Error fetching tenant data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isPlatformAdmin, hasMultipleTenants]);

  // Re-busca ao mudar de usuário OU de tenant na URL (cobre navegação direta + switcher).
  useEffect(() => {
    fetchTenantData();
  }, [fetchTenantData, urlSlug]);

  // CENTRALIZAÇÃO do cache: qualquer troca de tenant (URL direta, login, link, switcher)
  // limpa o react-query, garantindo refetch do tenant certo mesmo p/ hooks cuja
  // queryKey não inclui o tenant. Não dispara no 1º mount.
  const prevSlugRef = useRef<string | undefined>(urlSlug);
  useEffect(() => {
    if (prevSlugRef.current !== undefined && prevSlugRef.current !== urlSlug) {
      queryClient.removeQueries();
    }
    prevSlugRef.current = urlSlug;
  }, [urlSlug, queryClient]);

  const switchTenant = useCallback(async (tenantId: string | null) => {
    if (!user || !tenantId) {
      return;
    }

    // Regular user com 1 tenant apenas nao pode trocar
    if (!isPlatformAdmin && !hasMultipleTenants) {
      return;
    }

    try {
      // TODOS usam authSwitchTenant() (PLATFORM_ADMIN + Multi-tenant)
      await authSwitchTenant(tenantId);

      // Clear all cached queries from previous tenant
      queryClient.removeQueries();

      // Disparar evento para WebSocket reconectar
      window.dispatchEvent(new CustomEvent('tenant-changed'));

      // Fetch tenant info with new JWT (switched tenant)
      const tenantRes = await api.get('/tenants/me');
      if (tenantRes.data) {
        setTenant(tenantRes.data);
      }

      // Refresh accessible tenants (apenas para multi-tenant, nao para PLATFORM_ADMIN)
      // PLATFORM_ADMIN: lista de tenants nao muda, nao precisa recarregar
      if (hasMultipleTenants && !isPlatformAdmin) {
        const accessRes = await api.get('/auth/accessible-tenants');
        if (Array.isArray(accessRes.data)) {
          setAccessibleTenants(accessRes.data);
        }
      }

      toast.success('Tenant alterado com sucesso');
    } catch (error) {
      console.error('Erro ao trocar tenant:', error);
      toast.error('Erro ao trocar tenant');
    }
  }, [user, isPlatformAdmin, hasMultipleTenants, authSwitchTenant, queryClient]);

  return (
    <TenantContext.Provider
      value={{
        // Tudo derivado do slug da URL (resolvido p/ id). Fonte única.
        tenantId: resolvedTenantId,
        loading,
        tenant,
        allTenants,
        accessibleTenants,
        selectedTenantId: resolvedTenantId,
        effectiveTenantId: resolvedTenantId,
        slug: urlSlug ?? null,
        switchTenant,
        isPlatformAdmin,
        hasMultipleTenants,
        refresh: fetchTenantData,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

/**
 * Fonte ÚNICA do tenant atual (derivado do slug da URL).
 * Use `slug` em queryKeys e `id` em chamadas que precisam do tenantId.
 * Evita ler `user.tenantId`/`activeTenantId` (defasados) espalhados pelo código.
 */
export function useActiveTenant(): { slug: string | null; id: string | null } {
  const { slug, effectiveTenantId } = useTenant();
  return { slug, id: effectiveTenantId };
}
