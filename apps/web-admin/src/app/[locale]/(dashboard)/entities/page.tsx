'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash,
  Eye,
  Database,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RequireRole } from '@/components/auth/require-role';
import { useEntities, useDeleteEntity } from '@/hooks/use-entities';
import { useAuthStore } from '@/stores/auth-store';
import type { Entity } from '@/types';

const fieldTypeColors: Record<string, string> = {
  text: 'bg-blue-100 text-blue-800',
  number: 'bg-green-100 text-green-800',
  email: 'bg-purple-100 text-purple-800',
  date: 'bg-orange-100 text-orange-800',
  boolean: 'bg-pink-100 text-pink-800',
  select: 'bg-yellow-100 text-yellow-800',
  relation: 'bg-indigo-100 text-indigo-800',
};

function EntitiesPageContent() {
  const { user: currentUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<Entity | null>(null);

  const { data, isLoading, refetch } = useEntities();
  const deleteEntity = useDeleteEntity();

  // Garante que entities e sempre um array
  const entities: Entity[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  })();

  const filteredEntities = entities.filter((entity) =>
    (entity.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteEntity = (entity: Entity) => {
    setEntityToDelete(entity);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!entityToDelete) return;
    try {
      await deleteEntity.mutateAsync(entityToDelete.id);
      setDeleteDialogOpen(false);
      setEntityToDelete(null);
    } catch (err) {
      // Error handled by hook
    }
  };

  // Contadores seguros
  const totalEntities = entities.length;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Entidades</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Entidades</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as estruturas de dados do seu CRM
          </p>
        </div>
        <Link href="/entities/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Entidade
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalEntities}</div>
            <p className="text-sm text-muted-foreground">Total de Entidades</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {entities.filter((e) => (e.fields?.length || 0) > 0).length}
            </div>
            <p className="text-sm text-muted-foreground">Com Campos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {entities.reduce((sum, e) => sum + (e._count?.data || 0), 0)}
            </div>
            <p className="text-sm text-muted-foreground">Total de Registros</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar entidades..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Entities Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-1/2 mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEntities.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma entidade encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {search
                ? 'Nenhuma entidade corresponde a sua busca.'
                : 'Crie entidades para estruturar seus dados.'}
            </p>
            {!search && (
              <Link href="/entities/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Entidade
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEntities.map((entity) => (
            <Card key={entity.id} className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{entity.name}</h3>
                        {/* Exibe o tenant apenas para SuperAdmin */}
                        {currentUser?.role === 'PLATFORM_ADMIN' && (
                          <span className="ml-2 px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700" title={entity.tenantId}>
                            {entity.tenant?.name ? entity.tenant.name : entity.tenantId}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">/{entity.slug}</p>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/entities/${entity.id}`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteEntity(entity)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {entity.description && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                    {entity.description}
                  </p>
                )}

                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    {entity.fields?.length || 0} campos
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(entity.fields || []).slice(0, 4).map((field) => (
                      <span
                        key={field.name}
                        className={`text-xs px-2 py-0.5 rounded ${
                          fieldTypeColors[field.type] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {field.label}
                      </span>
                    ))}
                    {(entity.fields?.length || 0) > 4 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-800">
                        +{(entity.fields?.length || 0) - 4}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Link href={`/data?entity=${entity.slug}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-3 w-3 mr-1" />
                      Ver Dados
                    </Button>
                  </Link>
                  <Link href={`/entities/${entity.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de confirmacao de exclusao */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a entidade "{entityToDelete?.name}"?
              Todos os dados relacionados serao perdidos. Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEntity.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEntity.isPending}
            >
              {deleteEntity.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function EntitiesPage() {
  return (
    <RequireRole adminOnly message="Apenas administradores podem gerenciar entidades.">
      <EntitiesPageContent />
    </RequireRole>
  );
}
