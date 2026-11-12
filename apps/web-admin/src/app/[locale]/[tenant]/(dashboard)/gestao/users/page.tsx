'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/tenant-navigation';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Users as UsersIcon,
  Mail,
  Phone,
  UserCheck,
  UserX,
  Crown,
} from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';
import { usePermissions, readFullTenantAccess } from '@/hooks/use-permissions';
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
import { useAllUsers } from '@/hooks/use-users';
import { useTeams } from '@/hooks/use-teams';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserFormDialog, DeleteUserDialog, InviteUserDialog, PendingInvitations, AccessRequests } from '@/components/users';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import { formatCpf, formatPhone } from '@/lib/masks';
import type { User } from '@/types';
import { HelpButton } from '@/components/help/help-button';

// "Administrador" agora e permission-driven: quem gere cargos ou tem acesso total ao tenant.
const ALL_TEAMS = '__all__';

function isAdminRole(role?: User['customRole']): boolean {
  const mp = role?.modulePermissions as Record<string, unknown> | undefined;
  return readFullTenantAccess(mp) || role?.modulePermissions?.roles?.canUpdate === true;
}

function UsersPageContent() {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const tAuth = useTranslations('auth');
  const { user: currentUser } = useAuthStore();
  const { tenant } = useTenant();
  const router = useRouter();
  const { hasModulePermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState(ALL_TEAMS);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data, isLoading, refetch } = useAllUsers();
  const { data: teams } = useTeams(hasModulePermission('users', 'canRead'));

  // Extrai array de users de forma segura (igual ao padrao de /roles)
  const users: User[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  })();

  const filteredUsers = users.filter(
    (user) =>
      (teamFilter === ALL_TEAMS || (user.teams ?? []).some((tm) => tm.id === teamFilter)) && (
      (user.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (user.cpf || '').includes(search.replace(/\D/g, '')) ||
      (user.phone || '').includes(search.replace(/\D/g, ''))
      )
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

  // Mesma regra da API: o dono gerencia todos; os demais so quem esta num cargo
  // abaixo do seu; no dono ninguem mexe alem dele mesmo.
  const ownerId = tenant?.ownerId ?? null;
  const iAmOwner = !!currentUser && currentUser.id === ownerId;
  const myRank = currentUser?.customRole?.rank ?? Number.MAX_SAFE_INTEGER;
  const canManage = (target: User) =>
    target.id !== ownerId && (iAmOwner || (target.customRole?.rank ?? Number.MAX_SAFE_INTEGER) > myRank);
  const canEditUser = (target: User) => {
    if (!currentUser) return false;
    if (currentUser.id === target.id) return true;
    return hasModulePermission('users', 'canUpdate') && canManage(target);
  };
  const canDeleteUser = (target: User) =>
    hasModulePermission('users', 'canDelete') && currentUser?.id !== target.id && canManage(target);
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/gestao" className="hover:underline">{tNav('gestao')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{tNav('users')}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">{t('title')}<HelpButton topic="module.users" /></h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        {hasModulePermission('users', 'canCreate') && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleCreateUser} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {t('newUser')}
          </Button>
          <Button onClick={() => setInviteOpen(true)} className="w-full sm:w-auto" data-testid="invite-user">
            <Mail className="h-4 w-4 mr-2" />
            {t('invite.button')}
          </Button>
        </div>
        )}
      </div>

      <AccessRequests canManage={hasModulePermission('users', 'canCreate')} />
      <PendingInvitations canManage={hasModulePermission('users', 'canCreate')} />

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
              {users.filter((u) => isAdminRole(u.customRole)).length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.administrators')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600">
              {/* Cast local: 'PENDING' pode chegar da API mas nao esta na uniao Status. Somente tipagem. */}
              {users.filter((u) => (u.status as string) === 'PENDING').length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.pending')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + equipe */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {(teams?.length ?? 0) > 0 && (
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="sm:w-56" data-testid="users-team-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TEAMS}>{t('allTeams')}</SelectItem>
              {teams!.map((tm) => <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
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
                        <span className="px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap bg-indigo-100 text-indigo-800">
                          {user.customRole?.name || 'Sem role'}
                        </span>
                        {(user.teams ?? []).map((tm) => (
                          <span
                            key={tm.id}
                            className="flex items-center gap-1 rounded border px-2 py-0.5 text-xs whitespace-nowrap"
                            data-testid={`user-team-${tm.name}`}
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tm.color ?? '#6366f1' }} />
                            {tm.name}
                            {tm.isLeader && <Crown className="h-3 w-3 text-amber-600" />}
                          </span>
                        ))}
                        {user.id === ownerId && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap bg-amber-100 text-amber-800" data-testid="owner-badge">
                            <Crown className="h-3 w-3" />
                            {t('owner')}
                          </span>
                        )}
                        {user.status === 'ACTIVE' ? (
                          <UserCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <UserX className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </span>
                        {user.cpf && (
                          <span className="flex items-center gap-1">
                            <span className="text-muted-foreground">CPF:</span>
                            <span>{formatCpf(user.cpf)}</span>
                          </span>
                        )}
                        {user.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span>{formatPhone(user.phone)}</span>
                          </span>
                        )}
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
                    {(canEditUser(user) || canDeleteUser(user)) && (
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
                          {canEditUser(user) && canDeleteUser(user) && <DropdownMenuSeparator />}
                          {canDeleteUser(user) && (
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
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
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
