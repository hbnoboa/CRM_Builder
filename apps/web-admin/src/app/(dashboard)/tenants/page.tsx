'use client';

import { useState } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Building2,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  ArrowLeft,
  Users,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTenants, useSuspendTenant, useActivateTenant } from '@/hooks/use-tenants';
import { TenantFormDialog, DeleteTenantDialog } from '@/components/tenants';
import { useAuthStore } from '@/stores/auth-store';
import Link from 'next/link';
import type { Tenant } from '@/types';

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  INACTIVE: 'Inativo',
};

const planColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-800',
  basic: 'bg-blue-100 text-blue-800',
  pro: 'bg-purple-100 text-purple-800',
  enterprise: 'bg-orange-100 text-orange-800',
};

export default function TenantsPage() {
  const { user } = useAuthStore();
  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN';

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const { data, isLoading, refetch } = useTenants();
  const suspendTenant = useSuspendTenant();
  const activateTenant = useActivateTenant();

  const tenants = Array.isArray(data?.data) ? data.data : [];

  const filteredTenants = tenants.filter(
    (tenant: Tenant) =>
      (tenant.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (tenant.slug || '').toLowerCase().includes(search.toLowerCase())
  );

  // If not PLATFORM_ADMIN, show access denied message
  if (!isPlatformAdmin) {
    return (
      <div className="max-w-3xl mx-auto mt-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground text-center mb-4">
              Esta pagina e restrita a administradores da plataforma (PLATFORM_ADMIN).
            </p>
            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateTenant = () => {
    setSelectedTenant(null);
    setFormOpen(true);
  };

  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormOpen(true);
  };

  const handleDeleteTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDeleteOpen(true);
  };

  const handleSuspendTenant = async (tenant: Tenant) => {
    try {
      await suspendTenant.mutateAsync(tenant.id);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleActivateTenant = async (tenant: Tenant) => {
    try {
      await activateTenant.mutateAsync(tenant.id);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleSuccess = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Tenants</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os tenants da plataforma
          </p>
        </div>
        <Button onClick={handleCreateTenant}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Tenant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{tenants.length}</div>
            <p className="text-sm text-muted-foreground">Total de Tenants</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {tenants.filter((t: Tenant) => t.status === 'ACTIVE').length}
            </div>
            <p className="text-sm text-muted-foreground">Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {tenants.filter((t: Tenant) => t.status === 'SUSPENDED').length}
            </div>
            <p className="text-sm text-muted-foreground">Suspensos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {tenants.filter((t: Tenant) => t.plan === 'pro' || t.plan === 'enterprise').length}
            </div>
            <p className="text-sm text-muted-foreground">Planos Premium</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tenants List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-5 bg-muted rounded w-1/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTenants.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum tenant encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {search
                ? 'Nenhum tenant corresponde a sua busca.'
                : 'Crie tenants para comecar.'}
            </p>
            {!search && (
              <Button onClick={handleCreateTenant}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Tenant
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTenants.map((tenant: Tenant) => (
            <Card key={tenant.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{tenant.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            statusColors[tenant.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {statusLabels[tenant.status] || tenant.status}
                        </span>
                        {tenant.plan && (
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              planColors[tenant.plan] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="font-mono">{tenant.slug}</span>
                        {tenant._count?.users !== undefined && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {tenant._count.users} usuarios
                          </span>
                        )}
                        {tenant.createdAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Criado em {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => handleEditTenant(tenant)}>
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar tenant</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditTenant(tenant)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {tenant.status === 'ACTIVE' ? (
                          <DropdownMenuItem
                            onClick={() => handleSuspendTenant(tenant)}
                            className="text-yellow-600 focus:text-yellow-600"
                          >
                            <PauseCircle className="h-4 w-4 mr-2" />
                            Suspender
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleActivateTenant(tenant)}
                            className="text-green-600 focus:text-green-600"
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Ativar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteTenant(tenant)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <TenantFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenant={selectedTenant}
        onSuccess={handleSuccess}
      />
      <DeleteTenantDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tenant={selectedTenant}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
