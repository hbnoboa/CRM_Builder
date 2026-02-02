'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthStore } from './auth-store';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  icon?: string;
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
  workspaces: Workspace[];
  setWorkspace: (workspace: Workspace) => void;
  loading: boolean;
  refreshWorkspaces: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuthStore();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchTenantDate = async () => {
    if (!token || !user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch tenant info
      if (user.tenantId) {
        const tenantRes = await fetch(`${API_URL}/api/v1/tenants/${user.tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (tenantRes.ok) {
          const tenantDate = await tenantRes.json();
          setTenant(tenantDate);
        }
      }

      // Fetch workspaces
      const orgRes = await fetch(`${API_URL}/api/v1/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (orgRes.ok) {
        const orgsDate = await orgRes.json();
        const mappedWorkspaces = orgsDate.map((org: any) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          icon: org.icon,
        }));
        setWorkspaces(mappedWorkspaces);

        // Set default workspace
        if (mappedWorkspaces.length > 0) {
          const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
          const savedWorkspace = mappedWorkspaces.find(
            (w: Workspace) => w.id === savedWorkspaceId
          );
          setWorkspaceState(savedWorkspace || mappedWorkspaces[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching tenant data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantDate();
  }, [token, user]);

  const setWorkspace = (ws: Workspace) => {
    setWorkspaceState(ws);
    localStorage.setItem('currentWorkspaceId', ws.id);
  };

  const refreshWorkspaces = async () => {
    await fetchTenantDate();
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        workspace,
        workspaces,
        setWorkspace,
        loading,
        refreshWorkspaces,
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
