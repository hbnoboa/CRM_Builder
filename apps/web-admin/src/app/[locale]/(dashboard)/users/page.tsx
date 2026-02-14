'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Users as UsersIcon,
  Mail,
  UserCheck,
  UserX,
} from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUsers } from '@/hooks/use-users';
import { UserFormDialog } from '@/components/users/user-form-dialog';
import { DeleteUserDialog } from '@/components/users/delete-user-dialog';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import type { User } from '@/types';

const roleColors: Record<string, string> = {
  PLATFORM_ADMIN: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  USER: 'bg-green-100 text-green-800',
  VIEWER: 'bg-gray-100 text-gray-800',
  CUSTOM: 'bg-indigo-100 text-indigo-800',
};

function UsersPageContent() {
  const t = useTranslations('users');
  const tRoles = useTranslations('roles');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tAuth = useTranslations('auth');
  const { user: currentUser } = useAuthStore();
  const { hasModulePermission } = usePermissions();
  const { effectiveTenantId } = useTenant();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const queryParams = effectiveTenantId ? { tenantId: effectiveTenantId } : undefined;
  const { data, isLoading, refetch } = useUsers(queryParams);

  // Extrai array de users de forma segura (igual ao padrao de /roles)
  const users: User[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  })();

  const filteredUsers = users.filter(
    (user) =>
      (user.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateUser = () => {
    setSelectedUser(null);
    setFormOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setFormOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setDeleteOpen(true);
  };

  const handleSuccess = () => {
    refetch();
  };

  const canEditUser = (target: User) => {
    if (!currentUser) return false;
    if (hasModulePermission('users', 'canUpdate')) return true;
    return currentUser.id === target.id;
  };
  const canDeleteUser = () => {
    return hasModulePermission('users', 'canDelete');
  };
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">{tNav('dashboard')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{tNav('users')}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        {hasModulePermission('users', 'canCreate') && (
        <Button onClick={handleCreateUser} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('newUser')}
        </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold">{users.length}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.total')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {users.filter((u) => u.status === 'ACTIVE').length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.active')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">
              {users.filter((u) => u.customRole?.roleType === 'ADMIN' || u.customRole?.roleType === 'MANAGER').length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.administrators')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600">
              {users.filter((u) => u.status === 'PENDING').length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.pending')}</p>
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

      {/* Users List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-5 bg-muted rounded w-1/2 sm:w-1/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-2/3 sm:w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="p-6 sm:p-12 text-center">
            <UsersIcon className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">{t('noUsersFound')}</h3>
            <p className="text-muted-foreground">
              {search
                ? t('noUsersMatchSearch')
                : t('createUsersToStart')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-primary">
                        {(user.name || user.email || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h3 className="font-semibold text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">{user.name || user.email}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${
                            roleColors[user.customRole?.roleType || 'VIEWER'] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.customRole?.isSystem
                            ? tRoles(user.customRole.roleType)
                            : user.customRole?.name || 'Sem role'}
                        </span>
                        {user.status === 'ACTIVE' ? (
                          <UserCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <UserX className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        )}
                        {currentUser?.customRole?.roleType === 'PLATFORM_ADMIN' && (
                          <span className="px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700 truncate max-w-[80px] sm:max-w-[120px] md:max-w-[160px]" title={user.tenantId}>
                            {user.tenant?.name ? user.tenant.name : user.tenantId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end sm:justify-start flex-shrink-0">
                    {canEditUser(user) && (
                      <Button variant="outline" size="sm" onClick={() => handleEditUser(user)} className="hidden sm:flex">
                        <Pencil className="h-4 w-4 mr-1" />
                        {tCommon('edit')}
                      </Button>
                    )}
                    {(canEditUser(user) || canDeleteUser()) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEditUser(user) && (
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {tCommon('edit')}
                            </DropdownMenuItem>
                          )}
                          {canEditUser(user) && canDeleteUser() && <DropdownMenuSeparator />}
                          {canDeleteUser() && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(user)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {tCommon('delete')}
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

      {/* Dialogs */}
      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={selectedUser}
        onSuccess={handleSuccess}
      />
      <DeleteUserDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        user={selectedUser}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <RequireRole module="users">
      <UsersPageContent />
    </RequireRole>
  );
}
