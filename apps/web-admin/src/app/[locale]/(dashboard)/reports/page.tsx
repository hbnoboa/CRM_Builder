'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash,
  Copy,
  Eye,
  BarChart3,
  Loader2,
  Download,
  LayoutDashboard,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { usePermissions } from '@/hooks/use-permissions';
import { useReports, useDeleteReport, useDuplicateReport, useExportReport } from '@/hooks/use-reports';
import { useAuthStore } from '@/stores/auth-store';
import type { Report, ReportVisibility } from '@/services/reports.service';

const visibilityLabels: Record<ReportVisibility, string> = {
  PRIVATE: 'Privado',
  TEAM: 'Time',
  ORGANIZATION: 'Organizacao',
  PUBLIC: 'Publico',
};

const visibilityColors: Record<ReportVisibility, string> = {
  PRIVATE: 'bg-gray-100 text-gray-800',
  TEAM: 'bg-blue-100 text-blue-800',
  ORGANIZATION: 'bg-green-100 text-green-800',
  PUBLIC: 'bg-purple-100 text-purple-800',
};

function ReportsPageContent() {
  const { user: currentUser } = useAuthStore();
  const { hasModulePermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);

  const { data, isLoading } = useReports({ search: search || undefined });
  const deleteReport = useDeleteReport({ success: 'Relatorio excluido' });
  const duplicateReport = useDuplicateReport({ success: 'Relatorio duplicado' });
  const exportReport = useExportReport();

  const reports: Report[] = data?.data || [];

  const handleDelete = (report: Report) => {
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete) return;
    try {
      await deleteReport.mutateAsync(reportToDelete.id);
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    } catch {
      // Error handled by hook
    }
  };

  const handleDuplicate = async (id: string) => {
    await duplicateReport.mutateAsync(id);
  };

  const handleExport = async (id: string, format: 'csv' | 'xlsx' | 'pdf') => {
    await exportReport.mutateAsync({ id, format });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Relatorios</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Relatorios</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Crie e gerencie relatorios personalizados
          </p>
        </div>
        {hasModulePermission('reports', 'canCreate') && (
          <Link href="/reports/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Relatorio
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold">{reports.length}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total de relatorios</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">
              {reports.filter((r) => r.createdById === currentUser?.id).length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Meus relatorios</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {reports.filter((r) => r.showInDashboard).length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">No dashboard</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar relatorios..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Reports Grid */}
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
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="p-6 sm:p-12 text-center">
            <BarChart3 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">Nenhum relatorio encontrado</h3>
            <p className="text-muted-foreground">
              {search
                ? 'Nenhum relatorio corresponde a sua busca'
                : 'Crie seu primeiro relatorio para comecar'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Card key={report.id} className="group hover:border-primary/50 transition-colors">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: report.color || '#6366f1' }}
                    >
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{report.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {report.components?.length || 0} componentes
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/reports/${report.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </Link>
                      </DropdownMenuItem>
                      {hasModulePermission('reports', 'canUpdate') && (
                        <DropdownMenuItem asChild>
                          <Link href={`/reports/${report.id}?edit=true`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {hasModulePermission('reports', 'canCreate') && (
                        <DropdownMenuItem onClick={() => handleDuplicate(report.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleExport(report.id, 'xlsx')}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(report.id, 'pdf')}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar PDF
                      </DropdownMenuItem>
                      {hasModulePermission('reports', 'canDelete') && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(report)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {report.description && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3 line-clamp-2">
                    {report.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline" className={visibilityColors[report.visibility]}>
                    {visibilityLabels[report.visibility]}
                  </Badge>
                  {report.showInDashboard && (
                    <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                      <LayoutDashboard className="h-3 w-3 mr-1" />
                      Dashboard
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <span>Por {report.createdBy?.name || 'Desconhecido'}</span>
                  <span>-</span>
                  <span>{new Date(report.updatedAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatorio</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o relatorio "{reportToDelete?.name}"?
              Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteReport.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteReport.isPending}
            >
              {deleteReport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequireRole module="reports">
      <ReportsPageContent />
    </RequireRole>
  );
}
