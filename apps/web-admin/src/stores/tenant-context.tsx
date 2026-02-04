'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthStore } from './auth-store';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface TenantContextType {
  tenantId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  loading: boolean;
  tenant: Tenant | null;
  organization: Organization | null;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/v1\/?$/, '');

  const fetchTenantData = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token || !user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch tenant info
      if (user.tenantId) {
        const tenantRes = await fetch(`${API_BASE}/api/v1/tenants/${user.tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (tenantRes.ok) {
          const tenantData = await tenantRes.json();
          setTenant(tenantData);
        }
      }

      // Fetch organization from user
      if (user.organizationId) {
        const orgRes = await fetch(`${API_BASE}/api/v1/organizations/${user.organizationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          setOrganization({
            id: orgData.id,
            name: orgData.name,
            slug: orgData.slug,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching tenant data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, [user]);

  const refresh = async () => {
    await fetchTenantData();
  };

  return (
    <TenantContext.Provider
      value={{
        tenantId: user?.tenantId || null,
        organizationId: user?.organizationId || null,
        organizationName: organization?.name || null,
        loading,
        tenant,
        organization,
        refresh,
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
