'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/navigation';
import type { Tenant } from '@/types';

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

export default function TenantsPage() {
  const t = useTranslations('tenants');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const { user } = useAuthStore();
  const { hasModuleAccess } = usePermissions();
  const canAccessTenants = hasModuleAccess('tenants');

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const { data, isLoading, refetch } = useTenants();
  const suspendTenant = useSuspendTenant({
    success: t('toast.suspended'),
  });
  const activateTenant = useActivateTenant({
    success: t('toast.activated'),
  });

  const tenants = Array.isArray(data?.data) ? data.data : [];

  const filteredTenants = tenants.filter(
    (tenant: Tenant) =>
      (tenant.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (tenant.slug || '').toLowerCase().includes(search.toLowerCase())
  );

  // If user doesn't have tenants module access, show access denied
  if (!canAccessTenants) {
    return (
      <div className="max-w-3xl mx-auto mt-4 sm:mt-8 px-2 sm:px-0">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <ShieldAlert className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">{t('accessRestricted')}</h2>
            <p className="text-muted-foreground text-center mb-4 text-sm sm:text-base px-2">
              {t('platformAdminOnly')}
            </p>
            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {tAuth('backToDashboard')}
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
        <Link href="/dashboard" className="hover:underline">{tNav('dashboard')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{tNav('tenants')}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={handleCreateTenant} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('newTenant')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold">{tenants.length}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.total')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {tenants.filter((tenant: Tenant) => tenant.status === 'ACTIVE').length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.active')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600">
              {tenants.filter((tenant: Tenant) => tenant.status === 'SUSPENDED').length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.suspended')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-gray-600">
              {tenants.filter((tenant: Tenant) => tenant.status === 'INACTIVE').length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{tCommon('inactive')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
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
          <CardContent className="p-6 sm:p-12 text-center">
            <Building2 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">{t('noTenantsFound')}</h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              {search
                ? t('noTenantsMatchSearch')
                : t('createTenantsToStart')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTenants.map((tenant: Tenant) => (
            <Card key={tenant.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h3 className="font-semibold text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">{tenant.name}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${
                            statusColors[tenant.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {tCommon(tenant.status === 'ACTIVE' ? 'active' : tenant.status === 'SUSPENDED' ? 'suspended' : 'inactive')}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                        <span className="font-mono truncate">{tenant.slug}</span>
                        {tenant._count?.users !== undefined && (
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <Users className="h-3 w-3 flex-shrink-0" />
                            {tenant._count.users}
                          </span>
                        )}
                        {tenant.createdAt && (
                          <span className="hidden sm:flex items-center gap-1 whitespace-nowrap">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            {new Date(tenant.createdAt).toLocaleDateString(locale)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end sm:justify-start flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleEditTenant(tenant)} className="hidden sm:flex">
                      <Pencil className="h-4 w-4 mr-1" />
                      {tCommon('edit')}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditTenant(tenant)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {tCommon('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {tenant.status === 'ACTIVE' ? (
                          <DropdownMenuItem
                            onClick={() => handleSuspendTenant(tenant)}
                            className="text-yellow-600 focus:text-yellow-600"
                          >
                            <PauseCircle className="h-4 w-4 mr-2" />
                            {t('suspend')}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleActivateTenant(tenant)}
                            className="text-green-600 focus:text-green-600"
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            {t('activate')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteTenant(tenant)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {tCommon('delete')}
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
