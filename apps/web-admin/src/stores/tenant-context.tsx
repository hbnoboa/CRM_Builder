'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuthStore } from './auth-store';
import api from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface TenantContextType {
  tenantId: string | null;
  loading: boolean;
  tenant: Tenant | null;
  /** All tenants available (only for PLATFORM_ADMIN) */
  allTenants: Tenant[];
  /** Currently selected tenant for cross-tenant browsing (PLATFORM_ADMIN only) */
  selectedTenantId: string | null;
  /** The effective tenantId to use for API calls (selected or own) */
  effectiveTenantId: string | null;
  /** Switch to a different tenant context (PLATFORM_ADMIN only) */
  switchTenant: (tenantId: string | null) => void;
  /** Whether the user is a PLATFORM_ADMIN */
  isPlatformAdmin: boolean;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isPlatformAdmin = user?.customRole?.roleType === 'PLATFORM_ADMIN';

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
    } catch (error) {
      console.error('Error fetching tenant data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isPlatformAdmin]);

  useEffect(() => {
    fetchTenantData();
  }, [fetchTenantData]);

  // Restore selected tenant from sessionStorage
  useEffect(() => {
    if (isPlatformAdmin) {
      const saved = sessionStorage.getItem('selectedTenantId');
      if (saved) {
        setSelectedTenantId(saved);
      }
    }
  }, [isPlatformAdmin]);

  const switchTenant = useCallback((tenantId: string | null) => {
    setSelectedTenantId(tenantId);
    if (tenantId) {
      sessionStorage.setItem('selectedTenantId', tenantId);
    } else {
      sessionStorage.removeItem('selectedTenantId');
    }
  }, []);

  const effectiveTenantId = isPlatformAdmin
    ? (selectedTenantId || null)
    : (user?.tenantId || null);

  return (
    <TenantContext.Provider
      value={{
        tenantId: user?.tenantId || null,
        loading,
        tenant,
        allTenants,
        selectedTenantId,
        effectiveTenantId,
        switchTenant,
        isPlatformAdmin,
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
