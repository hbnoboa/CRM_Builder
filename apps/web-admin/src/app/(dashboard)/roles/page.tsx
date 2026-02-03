'use client';

import { useState } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Shield,
  Users,
  Key,
} from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';
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
import { useRoles } from '@/hooks/use-roles';
import { RoleFormDialog, DeleteRoleDialog } from '@/components/roles';
import type { Role } from '@/types';
import Link from 'next/link';

interface RoleWithCount extends Role {
  _count?: {
    users: number;
  };
}

function RolesPageContent() {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleWithCount | null>(null);

  const { data: roles = [], isLoading, refetch } = useRoles();

  const filteredRoles = (roles as RoleWithCount[]).filter(
    (role) =>
      (role.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (role.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateRole = () => {
    setSelectedRole(null);
    setFormOpen(true);
  };

  const handleEditRole = (role: RoleWithCount) => {
    setSelectedRole(role);
    setFormOpen(true);
  };

  const handleDeleteRole = (role: RoleWithCount) => {
    setSelectedRole(role);
    setDeleteOpen(true);
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
        <span className="font-semibold text-foreground">Roles</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Roles</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as roles e permissoes da sua organizacao
          </p>
        </div>
        <Button onClick={handleCreateRole}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-sm text-muted-foreground">Total de Roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {(roles as RoleWithCount[]).reduce((sum, r) => sum + (r._count?.users || 0), 0)}
            </div>
            <p className="text-sm text-muted-foreground">Usuarios com Roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {(roles as RoleWithCount[]).filter((r) => Object.keys(r.permissions || {}).length > 0).length}
            </div>
            <p className="text-sm text-muted-foreground">Roles com Permissoes</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar roles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Roles List */}
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
      ) : filteredRoles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma role encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {search
                ? 'Nenhuma role corresponde a sua busca.'
                : 'Crie roles para organizar permissoes.'}
            </p>
            {!search && (
              <Button onClick={handleCreateRole}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Role
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRoles.map((role) => (
            <Card key={role.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{role.name}</h3>
                        {role._count?.users !== undefined && role._count.users > 0 && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                            {role._count.users} usuarios
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        {role.description ? (
                          <span>{role.description}</span>
                        ) : (
                          <span className="italic">Sem descricao</span>
                        )}
                      </div>
                      {role.permissions && Object.keys(role.permissions).length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <Key className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {Object.keys(role.permissions).length} permissoes configuradas
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditRole(role)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditRole(role)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Key className="h-4 w-4 mr-2" />
                          Gerenciar Permissoes
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Users className="h-4 w-4 mr-2" />
                          Ver Usuarios
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteRole(role)}
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
      <RoleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        role={selectedRole}
        onSuccess={handleSuccess}
      />
      <DeleteRoleDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        role={selectedRole}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

export default function RolesPage() {
  return (
    <RequireRole adminOnly message="Apenas administradores podem gerenciar roles.">
      <RolesPageContent />
    </RequireRole>
  );
}
