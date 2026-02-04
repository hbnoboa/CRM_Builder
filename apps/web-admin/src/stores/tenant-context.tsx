'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthStore } from './auth-store';

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  workspace: Workspace | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
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

      // Fetch organization (one per tenant)
      const orgRes = await fetch(`${API_BASE}/api/v1/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (orgRes.ok) {
        const orgsData = await orgRes.json();
        // Use the first organization as the workspace
        if (orgsData.length > 0) {
          const org = orgsData[0];
          setWorkspace({
            id: org.id,
            name: org.name,
            slug: org.slug,
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
        tenant,
        workspace,
        loading,
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
