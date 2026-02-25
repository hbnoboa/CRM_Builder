'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  const { user, switchTenant: authSwitchTenant, getProfile } = useAuthStore();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [accessibleTenants, setAccessibleTenants] = useState<AccessibleTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
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

  // Restore selected tenant from sessionStorage (PLATFORM_ADMIN only)
  useEffect(() => {
    if (isPlatformAdmin) {
      const saved = sessionStorage.getItem('selectedTenantId');
      if (saved) {
        setSelectedTenantId(saved);
      }
    }
  }, [isPlatformAdmin]);

  const switchTenant = useCallback(async (tenantId: string | null) => {
    if (isPlatformAdmin) {
      // PLATFORM_ADMIN: sessionStorage-based switching (existing mechanism)
      setSelectedTenantId(tenantId);
      if (tenantId) {
        sessionStorage.setItem('selectedTenantId', tenantId);
      } else {
        sessionStorage.removeItem('selectedTenantId');
      }
      window.dispatchEvent(new CustomEvent('tenant-changed'));
    } else if (hasMultipleTenants && tenantId) {
      // Regular multi-tenant user: JWT-based switching
      try {
        await authSwitchTenant(tenantId);
        // Refresh tenant data after switch
        await getProfile();
        const tenantRes = await api.get('/tenants/me');
        if (tenantRes.data) {
          setTenant(tenantRes.data);
        }
        // Refresh accessible tenants
        const accessRes = await api.get('/auth/accessible-tenants');
        if (Array.isArray(accessRes.data)) {
          setAccessibleTenants(accessRes.data);
        }
      } catch (error) {
        console.error('Error switching tenant:', error);
      }
    }
  }, [isPlatformAdmin, hasMultipleTenants, authSwitchTenant, getProfile]);

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
        accessibleTenants,
        selectedTenantId,
        effectiveTenantId,
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
