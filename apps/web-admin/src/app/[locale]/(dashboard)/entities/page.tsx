'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
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
import { useTenant } from '@/stores/tenant-context';
import type { Entity } from '@/types';

const fieldTypeColors: Record<string, string> = {
  text: 'bg-blue-100 text-blue-800',
  textarea: 'bg-blue-100 text-blue-800',
  richtext: 'bg-blue-100 text-blue-800',
  number: 'bg-green-100 text-green-800',
  currency: 'bg-green-100 text-green-800',
  percentage: 'bg-green-100 text-green-800',
  slider: 'bg-green-100 text-green-800',
  rating: 'bg-amber-100 text-amber-800',
  email: 'bg-purple-100 text-purple-800',
  phone: 'bg-purple-100 text-purple-800',
  url: 'bg-purple-100 text-purple-800',
  cpf: 'bg-teal-100 text-teal-800',
  cnpj: 'bg-teal-100 text-teal-800',
  cep: 'bg-teal-100 text-teal-800',
  date: 'bg-orange-100 text-orange-800',
  datetime: 'bg-orange-100 text-orange-800',
  time: 'bg-orange-100 text-orange-800',
  boolean: 'bg-pink-100 text-pink-800',
  select: 'bg-yellow-100 text-yellow-800',
  multiselect: 'bg-yellow-100 text-yellow-800',
  'api-select': 'bg-amber-100 text-amber-800',
  relation: 'bg-indigo-100 text-indigo-800',
  color: 'bg-rose-100 text-rose-800',
  file: 'bg-gray-100 text-gray-800',
  image: 'bg-gray-100 text-gray-800',
  json: 'bg-slate-100 text-slate-800',
  password: 'bg-red-100 text-red-800',
  hidden: 'bg-gray-100 text-gray-800',
};

function EntitiesPageContent() {
  const t = useTranslations('entities');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const { user: currentUser } = useAuthStore();
  const { effectiveTenantId } = useTenant();
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<Entity | null>(null);

  const queryParams = effectiveTenantId ? { tenantId: effectiveTenantId } : undefined;
  const { data, isLoading, refetch } = useEntities(queryParams);
  const deleteEntity = useDeleteEntity({ success: t('toast.deleted') });

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
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link href="/dashboard" className="hover:underline">{tNav('dashboard')}</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{tNav('entities')}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        <Link href="/entities/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {t('newEntity')}
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold">{totalEntities}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.total')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">
              {entities.filter((e) => (e.fields?.length || 0) > 0).length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.withFields')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {entities.reduce((sum, e) => sum + (e._count?.data || 0), 0)}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('stats.totalRecords')}</p>
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
          <CardContent className="p-6 sm:p-12 text-center">
            <Database className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">{t('noEntitiesFound')}</h3>
            <p className="text-muted-foreground mb-4">
              {search
                ? t('noEntitiesMatchSearch')
                : t('createEntitiesToStart')}
            </p>
            {!search && (
              <Link href="/entities/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createFirstEntity')}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEntities.map((entity) => (
            <Card key={entity.id} className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <Database className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{entity.name}</h3>
                        {currentUser?.role === 'PLATFORM_ADMIN' && (
                          <span className="px-1.5 sm:px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700 truncate max-w-[80px]" title={entity.tenantId}>
                            {entity.tenant?.name ? entity.tenant.name : entity.tenantId}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">/{entity.slug}</p>
                    </div>
                  </div>
                  <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/entities/${entity.id}`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {tCommon('edit')}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteEntity(entity)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          {tCommon('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {entity.description && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3 line-clamp-2">
                    {entity.description}
                  </p>
                )}

                <div className="mt-3 sm:mt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    {entity.fields?.length || 0} {t('fields')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(entity.fields || []).slice(0, 3).map((field) => (
                      <span
                        key={field.name}
                        className={`text-xs px-1.5 sm:px-2 py-0.5 rounded ${
                          fieldTypeColors[field.type] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {field.label}
                      </span>
                    ))}
                    {(entity.fields?.length || 0) > 3 && (
                      <span className="text-xs px-1.5 sm:px-2 py-0.5 rounded bg-gray-100 text-gray-800">
                        +{(entity.fields?.length || 0) - 3}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                  <Link href={`/data?entity=${entity.slug}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
                      <Eye className="h-3 w-3 mr-1" />
                      {t('viewData')}
                    </Button>
                  </Link>
                  <Link href={`/entities/${entity.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
                      <Pencil className="h-3 w-3 mr-1" />
                      {tCommon('edit')}
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
            <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm.message', { name: entityToDelete?.name || '' })}
              {' '}{t('deleteConfirm.warning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEntity.isPending}>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEntity.isPending}
            >
              {deleteEntity.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function EntitiesPage() {
  return (
    <RequireRole adminOnly>
      <EntitiesPageContent />
    </RequireRole>
  );
}
