'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus, Search, MoreVertical, Pencil, Trash2, Shield,
  ArrowLeft, Users, ChevronUp, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useCustomRoles, useReorderCustomRoles } from '@/hooks/use-custom-roles';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/tenant-navigation';
import { RoleFormDialog } from '@/components/roles/role-form-dialog';
import { DeleteRoleDialog } from '@/components/roles/delete-role-dialog';
import type { CustomRole } from '@/types';
import { HelpButton } from '@/components/help/help-button';

export default function RolesPage() {
  const t = useTranslations();
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const { hasModuleAccess, hasModulePermission } = usePermissions();
  const myRank = useAuthStore((s) => s.user?.customRole?.rank) ?? Number.MAX_SAFE_INTEGER;
  const reorder = useReorderCustomRoles();
  const canAccessRoles = hasModuleAccess('roles');

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);

  const { data, isLoading, refetch } = useCustomRoles();
  // Do mais alto para o mais baixo: quem esta acima gerencia quem esta abaixo.
  const roles = (Array.isArray(data?.data) ? [...data.data] : []).sort(
    (a: CustomRole, b: CustomRole) => (a.rank ?? 100) - (b.rank ?? 100) || a.name.localeCompare(b.name),
  );
  // So da para reordenar os cargos abaixo do seu (mesma regra da API).
  const below = roles.filter((r: CustomRole) => (r.rank ?? 100) > myRank);
  const canReorder = hasModulePermission('roles', 'canUpdate') && !search && below.length > 1;

  const move = (role: CustomRole, delta: -1 | 1) => {
    const ids = below.map((r: CustomRole) => r.id);
    const from = ids.indexOf(role.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorder.mutate(ids);
  };

  const filteredRoles = roles.filter(
    (role: CustomRole) =>
      (role.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (role.description || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!canAccessRoles) {
    return (
      <div className="max-w-3xl mx-auto mt-4 sm:mt-8 px-2 sm:px-0">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <Shield className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mb-4" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">{tAuth('accessRestricted')}</h2>
            <p className="text-muted-foreground text-center mb-4 text-sm sm:text-base px-2">
              {tAuth('noPermission')}
            </p>
            <Link href="/home">
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

  const handleCreate = () => { setSelectedRole(null); setFormOpen(true); };
  const handleEdit = (role: CustomRole) => { setSelectedRole(role); setFormOpen(true); };
  const handleDelete = (role: CustomRole) => { setSelectedRole(role); setDeleteOpen(true); };
  const handleSuccess = () => { refetch(); };

  return (
    <div className="space-y-6">
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/gestao" className="hover:underline">{tNav('gestao')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{t('rolesPage.title')}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">{t('rolesPage.title')}<HelpButton topic="module.roles" /></h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t('rolesPage.subtitle')}</p>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{t('rolesPage.orderHint')}</p>
        </div>
        {hasModulePermission('roles', 'canCreate') && (
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />{t('rolesPage.newRole')}
        </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <Card><CardContent className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold">{roles.length}</div>
          <p className="text-xs sm:text-sm text-muted-foreground">{t('rolesPage.stats.total')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold text-blue-600">
            {roles.reduce((acc: number, r: CustomRole) => acc + (r._count?.tenantAccessUsers || 0), 0)}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">{t('rolesPage.stats.usersAssigned')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold text-green-600">
            {roles.filter((r: CustomRole) => r.isDefault).length}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">{t('rolesPage.stats.defaults')}</p>
        </CardContent></Card>
      </div>

      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('rolesPage.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-5 bg-muted rounded w-1/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                </div>
              </div>
            </CardContent></Card>
          ))}
        </div>
      ) : filteredRoles.length === 0 ? (
        <Card><CardContent className="p-6 sm:p-12 text-center">
          <Shield className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-base sm:text-lg font-semibold mb-2">{t('rolesPage.noRolesFound')}</h3>
          <p className="text-muted-foreground text-sm sm:text-base">
            {search ? t('rolesPage.noRolesMatchSearch') : t('rolesPage.createRolesToStart')}
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredRoles.map((role: CustomRole) => (
              <Card key={role.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      {canReorder && (
                        <div className="flex flex-col" data-testid={`order-${role.name}`}>
                          {below.includes(role) ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={reorder.isPending || below[0] === role}
                                onClick={() => move(role, -1)} aria-label={t('rolesPage.moveUp')} data-testid={`move-up-${role.name}`}>
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={reorder.isPending || below[below.length - 1] === role}
                                onClick={() => move(role, 1)} aria-label={t('rolesPage.moveDown')} data-testid={`move-down-${role.name}`}>
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <div className="w-6" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h3 className="font-semibold text-sm sm:text-base">{role.name}</h3>
                          {role.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              {t('rolesPage.default')}
                            </Badge>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                            {role.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {role._count?.tenantAccessUsers || 0} {t('rolesPage.usersCount')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end sm:justify-start flex-shrink-0">
                      {hasModulePermission('roles', 'canUpdate') && (
                      <Button variant="outline" size="sm" onClick={() => handleEdit(role)} className="hidden sm:flex">
                        <Pencil className="h-4 w-4 mr-1" />{tCommon('edit')}
                      </Button>
                      )}
                      {(hasModulePermission('roles', 'canUpdate') || hasModulePermission('roles', 'canDelete')) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {hasModulePermission('roles', 'canUpdate') && (
                          <DropdownMenuItem onClick={() => handleEdit(role)}>
                            <Pencil className="h-4 w-4 mr-2" />{tCommon('edit')}
                          </DropdownMenuItem>
                          )}
                          {hasModulePermission('roles', 'canUpdate') && hasModulePermission('roles', 'canDelete') && <DropdownMenuSeparator />}
                          {hasModulePermission('roles', 'canDelete') && (
                          <DropdownMenuItem onClick={() => handleDelete(role)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />{tCommon('delete')}
                          </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
          ))}
        </div>
      )}

      <RoleFormDialog open={formOpen} onOpenChange={setFormOpen} role={selectedRole} onSuccess={handleSuccess} />
      <DeleteRoleDialog open={deleteOpen} onOpenChange={setDeleteOpen} role={selectedRole} onSuccess={handleSuccess} />
    </div>
  );
}
