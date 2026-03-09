'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
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

function DashboardTemplatesContent() {
  const { data: templates, isLoading } = useDashboardTemplates();
  const deleteTemplate = useDeleteDashboardTemplate();
  const [deleteTarget, setDeleteTarget] = useState<DashboardTemplate | null>(null);

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
          <h1 className="text-2xl font-bold">Dashboard Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie dashboards customizados e atribua a cargos
          </p>
        </div>
        <Link href="/settings/dashboard-templates/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        </Link>
      </div>

      {(!templates || templates.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum template criado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie templates de dashboard com graficos, KPIs e tabelas para seus usuarios
            </p>
            <Link href="/settings/dashboard-templates/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro template
              </Button>
            </Link>
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
                    <Link href={`/settings/dashboard-templates/${template.id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteTarget(template)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {template.entitySlug && (
                    <Badge variant="outline" className="text-xs">
                      {template.entitySlug}
                    </Badge>
                  )}
                  {!template.entitySlug && (
                    <Badge variant="secondary" className="text-xs">
                      Global
                    </Badge>
                  )}
                  <Badge variant={template.isActive ? 'default' : 'secondary'} className="text-xs">
                    {template.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {template.roleIds.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {template.roleIds.length} cargo(s)
                    </Badge>
                  )}
                  {Object.keys(template.widgets || {}).length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {Object.keys(template.widgets).length} widget(s)
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
    <RequireRole roles={['PLATFORM_ADMIN', 'ADMIN']}>
      <DashboardTemplatesContent />
    </RequireRole>
  );
}
