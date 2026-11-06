'use client';

import { useState } from 'react';
import { useEntities } from '@/hooks/use-entities';
import { Link } from '@/i18n/tenant-navigation';
import { RequireRole } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Pencil, Trash2, BarChart3, Loader2 } from 'lucide-react';
import {
  useDashboardTemplates,
  useDeleteDashboardTemplate,
} from '@/hooks/use-dashboard-templates';
import type { DashboardTemplate } from '@crm-builder/shared';
import { usePermissions } from '@/hooks/use-permissions';
import { HelpButton } from '@/components/help/help-button';

function DashboardTemplatesContent() {
  const { data: templates, isLoading } = useDashboardTemplates();
  const { data: entitiesPage } = useEntities({ limit: 200 });
  const entityNameOf = (slug: string) => entitiesPage?.data?.find((e) => e.slug === slug)?.name ?? slug;
  const deleteTemplate = useDeleteDashboardTemplate();
  const [deleteTarget, setDeleteTarget] = useState<DashboardTemplate | null>(null);
  // Mesma permissao da API (modulo dashboard).
  const { hasModulePermission } = usePermissions();
  const canCreate = hasModulePermission('dashboard', 'canCreate');
  const canUpdate = hasModulePermission('dashboard', 'canUpdate');
  const canDelete = hasModulePermission('dashboard', 'canDelete');

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTemplate.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">Painéis<HelpButton topic="module.dashboards" /></h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monte painéis com gráficos e números e escolha quais cargos veem cada um.
          </p>
        </div>
        {canCreate && (
          <Link href="/gestao/dashboard-templates/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo painel
            </Button>
          </Link>
        )}
      </div>

      {(!templates || templates.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum template criado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie templates de dashboard com graficos, KPIs e tabelas para seus usuarios
            </p>
            {canCreate && (
              <Link href="/gestao/dashboard-templates/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro template
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {canUpdate && (
                      <Link href={`/gestao/dashboard-templates/${template.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteTarget(template)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {template.entitySlug && (
                    <Badge variant="outline" className="text-xs">
                      Tabela: {entityNameOf(template.entitySlug)}
                    </Badge>
                  )}
                  {!template.entitySlug && (
                    <Badge variant="secondary" className="text-xs">
                      Várias tabelas
                    </Badge>
                  )}
                  <Badge variant="secondary" className={template.isActive ? 'bg-emerald-50 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-xs'}>
                    {template.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {template.roleIds.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {template.roleIds.length} {template.roleIds.length === 1 ? 'cargo' : 'cargos'}
                    </Badge>
                  )}
                  {Object.keys(template.widgets || {}).length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {Object.keys(template.widgets).length} {Object.keys(template.widgets).length === 1 ? 'bloco' : 'blocos'}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{deleteTarget?.name}&quot;? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function DashboardTemplatesPage() {
  return (
    <RequireRole module="templates">
      <DashboardTemplatesContent />
    </RequireRole>
  );
}
