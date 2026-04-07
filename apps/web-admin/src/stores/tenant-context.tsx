'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from './auth-store';
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
    roleType: string;
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
  /** The effective tenantId to use for API calls (selected or own) */
  effectiveTenantId: string | null;
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

  const isPlatformAdmin = user?.customRole?.roleType === 'PLATFORM_ADMIN';
  const hasMultipleTenants = !!(user as Record<string, unknown>)?.hasMultipleTenants;

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

  useEffect(() => {
    fetchTenantData();
  }, [fetchTenantData]);

  const switchTenant = useCallback(async (tenantId: string | null) => {
    console.log('🔄 [TenantContext] switchTenant called with:', tenantId);
    console.log('🔄 [TenantContext] Current user.tenantId:', user?.tenantId);

    if (!user || !tenantId) {
      console.log('❌ [TenantContext] Aborting: no user or tenantId');
      return;
    }

    // Regular user com 1 tenant apenas nao pode trocar
    if (!isPlatformAdmin && !hasMultipleTenants) {
      console.log('❌ [TenantContext] Aborting: not platform admin and no multi-tenant');
      return;
    }

    try {
      console.log('📡 [TenantContext] Calling authSwitchTenant...');
      // TODOS usam authSwitchTenant() (PLATFORM_ADMIN + Multi-tenant)
      await authSwitchTenant(tenantId);
      console.log('✅ [TenantContext] authSwitchTenant completed');

      // Clear all cached queries from previous tenant
      queryClient.removeQueries();
      console.log('🗑️ [TenantContext] Cache cleared');

      // Disparar evento para WebSocket reconectar
      window.dispatchEvent(new CustomEvent('tenant-changed'));
      console.log('📢 [TenantContext] tenant-changed event dispatched');

      // Fetch tenant info with new JWT (switched tenant)
      const tenantRes = await api.get('/tenants/me');
      console.log('📥 [TenantContext] Fetched /tenants/me:', tenantRes.data);
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

      // Check if user was updated
      const updatedUser = useAuthStore.getState().user;
      console.log('👤 [TenantContext] Updated user.tenantId:', updatedUser?.tenantId);

      toast.success('Tenant alterado com sucesso');
    } catch (error) {
      console.error('❌ [TenantContext] Erro ao trocar tenant:', error);
      toast.error('Erro ao trocar tenant');
    }
  }, [user, isPlatformAdmin, hasMultipleTenants, authSwitchTenant, queryClient]);

  return (
    <TenantContext.Provider
      value={{
        tenantId: user?.tenantId || null,
        loading,
        tenant,
        allTenants,
        accessibleTenants,
        // selectedTenantId now reflects the current JWT tenant (for backward compatibility)
        // PLATFORM_ADMIN: JWT changes to selected tenant
        // Multi-tenant/Regular: JWT reflects current tenant
        selectedTenantId: user?.tenantId || null,
        effectiveTenantId: user?.tenantId || null,
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
