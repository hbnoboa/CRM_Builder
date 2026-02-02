'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingPage } from '@/components/ui/loading-page';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Plus, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export default function TenantsPage() {
  const { user } = useAuthStore();
  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await api.get('/tenants');
      return res.data;
    },
    enabled: isPlatformAdmin, // Only runs if PLATFORM_ADMIN
    retry: false,
  });

  // If not PLATFORM_ADMIN, show access denied message
  if (!isPlatformAdmin) {
    return (
      <div className="max-w-3xl mx-auto mt-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground text-center mb-4">
              This page is restricted to platform administrators (PLATFORM_ADMIN).
            </p>
            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back ao Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-3xl mx-auto mt-8">
        {/* Breadcrumbs */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb" data-testid="breadcrumb">
          <Link href="/dashboard" className="hover:underline" data-testid="breadcrumb-dashboard">Dashboard</Link>
          <span>/</span>
          <span className="font-semibold text-foreground" data-testid="breadcrumb-tenants">Tenants</span>
        </nav>
        {/* Back */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="mb-2" aria-label="Back to dashboard" data-testid="voltar-dashboard-btn">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Back to dashboard</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {isLoading ? (
          <LoadingPage />
        ) : isError ? (
          <EmptyState message="Error loading tenants." />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle data-testid="tenants-heading">Tenants</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="default" aria-label="New Tenant" data-testid="novo-tenant-btn">
                      <Plus className="h-4 w-4 mr-1" /> New Tenant
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cadastrar novo tenant</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent>
              {data?.length === 0 ? (
                <EmptyState message="No tenant found." />
              ) : (
                <ul className="space-y-2">
                  {data?.map((tenant: any) => (
                    <li key={tenant.id} className="border p-2 rounded">
                      <div className="font-semibold">{tenant.nome}</div>
                      <div className="text-sm text-muted-foreground">{tenant.status}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}
