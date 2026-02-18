'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Save, Loader2, Pencil, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequireRole } from '@/components/auth/require-role';
import { useReport, useUpdateReport, useReportExecution, useExportReport } from '@/hooks/use-reports';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/stores/auth-store';
import { BasicInfoTab } from '@/components/reports/basic-info-tab';
import { ComponentsTab } from '@/components/reports/components-tab';
import { LayoutTab } from '@/components/reports/layout-tab';
import { ReportPreview } from '@/components/reports/report-preview';
import type { Report, ReportComponent, LayoutConfig } from '@/services/reports.service';

function ReportDetailPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const isEditMode = searchParams.get('edit') === 'true';

  const { user } = useAuthStore();
  const { hasModulePermission } = usePermissions();
  const isPlatformAdmin = user?.customRole?.roleType === 'PLATFORM_ADMIN';
  const canEdit = hasModulePermission('reports', 'canUpdate');

  const [activeTab, setActiveTab] = useState('preview');
  const [editedReport, setEditedReport] = useState<Partial<Report> | null>(null);

  const { data: report, isLoading } = useReport(id);
  const { data: executionData, isLoading: isExecuting, refetch: refetchExecution } = useReportExecution(id);
  const updateReport = useUpdateReport({ success: 'Relatorio atualizado' });
  const exportReport = useExportReport();

  // Inicializar editedReport quando report carregar
  useEffect(() => {
    if (report && !editedReport) {
      setEditedReport(report);
    }
  }, [report, editedReport]);

  // Mudar para tab de edicao se edit=true
  useEffect(() => {
    if (isEditMode && canEdit) {
      setActiveTab('basic');
    }
  }, [isEditMode, canEdit]);

  const handleSave = async () => {
    if (!editedReport || !report) return;

    try {
      await updateReport.mutateAsync({
        id: report.id,
        data: {
          name: editedReport.name,
          description: editedReport.description,
          icon: editedReport.icon,
          color: editedReport.color,
          components: editedReport.components,
          layoutConfig: editedReport.layoutConfig,
          visibility: editedReport.visibility,
          tenantScope: editedReport.tenantScope,
          selectedTenants: editedReport.selectedTenants,
          showInDashboard: editedReport.showInDashboard,
          dashboardOrder: editedReport.dashboardOrder,
        },
      });
      setActiveTab('preview');
      refetchExecution();
    } catch {
      // Error handled by hook
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    await exportReport.mutateAsync({ id, format });
  };

  const updateEditedReport = (updates: Partial<Report>) => {
    setEditedReport((prev) => (prev ? { ...prev, ...updates } : null));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report || !editedReport) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Relatorio nao encontrado</p>
        <Link href="/reports">
          <Button variant="outline" className="mt-4">
            Voltar para relatorios
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{report.name}</h1>
            <p className="text-muted-foreground">
              {report.description || 'Sem descricao'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'preview' ? (
            <>
              <Button variant="outline" onClick={() => refetchExecution()} disabled={isExecuting}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isExecuting ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button variant="outline" onClick={() => handleExport('xlsx')}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" onClick={() => handleExport('pdf')}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              {canEdit && (
                <Button onClick={() => setActiveTab('basic')}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setActiveTab('preview')}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={updateReport.isPending}>
                {updateReport.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="preview">Visualizar</TabsTrigger>
          {canEdit && (
            <>
              <TabsTrigger value="basic">Informacoes</TabsTrigger>
              <TabsTrigger value="components">
                Componentes ({editedReport.components?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="preview" className="mt-6">
          <ReportPreview
            report={report}
            executionData={executionData}
            isLoading={isExecuting}
          />
        </TabsContent>

        {canEdit && (
          <>
            <TabsContent value="basic" className="mt-6">
              <BasicInfoTab
                report={editedReport}
                onChange={updateEditedReport}
                isPlatformAdmin={isPlatformAdmin}
              />
            </TabsContent>

            <TabsContent value="components" className="mt-6">
              <ComponentsTab
                components={editedReport.components || []}
                onChange={(components) => updateEditedReport({ components })}
              />
            </TabsContent>

            <TabsContent value="layout" className="mt-6">
              <LayoutTab
                components={editedReport.components || []}
                layoutConfig={editedReport.layoutConfig}
                onChange={(components) => updateEditedReport({ components })}
                onLayoutChange={(layoutConfig) => updateEditedReport({ layoutConfig })}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

export default function ReportDetailPage() {
  return (
    <RequireRole module="reports">
      <ReportDetailPageContent />
    </RequireRole>
  );
}
