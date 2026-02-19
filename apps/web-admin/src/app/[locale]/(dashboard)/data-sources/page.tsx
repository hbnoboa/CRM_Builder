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
  TableProperties,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { usePermissions } from '@/hooks/use-permissions';
import { useDataSources, useDeleteDataSource } from '@/hooks/use-data-sources';
import type { DataSourceDefinition } from '@crm-builder/shared';

function DataSourcesPageContent() {
  const t = useTranslations('dataSources');
  const tCommon = useTranslations('common');
  const { hasModulePermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useDataSources(search || undefined);
  const deleteMutation = useDeleteDataSource({ success: t('toast.deleted') });

  const dataSources = data?.data ?? [];

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const getEntitySlugs = (definition: DataSourceDefinition | Record<string, unknown>) => {
    const def = definition as DataSourceDefinition;
    return def?.sources?.map(s => s.entitySlug).join(', ') || '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        {hasModulePermission('data-sources', 'canCreate') && (
          <Button asChild>
            <Link href="/data-sources/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('newDataSource')}
            </Link>
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={tCommon('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : dataSources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TableProperties className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{t('noDataSources')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t('noDataSourcesDesc')}</p>
            {hasModulePermission('data-sources', 'canCreate') && (
              <Button asChild className="mt-4">
                <Link href="/data-sources/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('newDataSource')}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {dataSources.map((ds) => (
            <Card key={ds.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <TableProperties className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{ds.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {ds.description || getEntitySlugs(ds.definition)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(ds.createdAt).toLocaleDateString()}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/data-sources/${ds.id}`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {tCommon('edit')}
                        </Link>
                      </DropdownMenuItem>
                      {hasModulePermission('data-sources', 'canDelete') && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(ds.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          {tCommon('delete')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{tCommon('confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function DataSourcesPage() {
  return (
    <RequireRole module="data-sources" action="canRead">
      <DataSourcesPageContent />
    </RequireRole>
  );
}
