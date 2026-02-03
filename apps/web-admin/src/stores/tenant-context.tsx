'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useAuthStore } from './auth-store';

interface TenantContextType {
  tenantId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuthStore();

  return (
    <TenantContext.Provider
      value={{
        tenantId: user?.tenantId || null,
        organizationId: user?.organizationId || null,
        organizationName: user?.organization?.name || null,
        loading: isLoading,
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
