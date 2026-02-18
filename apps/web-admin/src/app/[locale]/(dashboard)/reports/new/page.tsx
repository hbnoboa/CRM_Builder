'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequireRole } from '@/components/auth/require-role';
import { useCreateReport } from '@/hooks/use-reports';
import { useAuthStore } from '@/stores/auth-store';
import { BasicInfoTab } from '@/components/reports/basic-info-tab';
import { ComponentsTab } from '@/components/reports/components-tab';
import { LayoutTab } from '@/components/reports/layout-tab';
import type { Report, ReportComponent, ReportVisibility, TenantScope, LayoutConfig } from '@/services/reports.service';

type PartialReport = Partial<Report> & {
  name: string;
  components: ReportComponent[];
};

function NewReportPageContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isPlatformAdmin = user?.customRole?.roleType === 'PLATFORM_ADMIN';

  const [activeTab, setActiveTab] = useState('basic');
  const [report, setReport] = useState<PartialReport>({
    name: '',
    description: '',
    icon: 'BarChart3',
    color: '#6366f1',
    components: [],
    layoutConfig: { columns: 2, gaps: 4 },
    visibility: 'PRIVATE' as ReportVisibility,
    tenantScope: 'CURRENT' as TenantScope,
    selectedTenants: [],
    showInDashboard: false,
    dashboardOrder: 0,
  });

  const createReport = useCreateReport({ success: 'Relatorio criado com sucesso' });

  const handleSave = async () => {
    if (!report.name) {
      setActiveTab('basic');
      return;
    }

    try {
      const newReport = await createReport.mutateAsync({
        name: report.name,
        description: report.description,
        icon: report.icon,
        color: report.color,
        components: report.components,
        layoutConfig: report.layoutConfig,
        visibility: report.visibility,
        tenantScope: report.tenantScope,
        selectedTenants: report.selectedTenants,
        showInDashboard: report.showInDashboard,
        dashboardOrder: report.dashboardOrder,
      });
      router.push(`/reports/${newReport.id}`);
    } catch {
      // Error handled by hook
    }
  };

  const updateReport = (updates: Partial<PartialReport>) => {
    setReport((prev) => ({ ...prev, ...updates }));
  };

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
            <h1 className="text-2xl font-bold">Novo Relatorio</h1>
            <p className="text-muted-foreground">
              Configure os componentes do seu relatorio
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={createReport.isPending || !report.name}>
          {createReport.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Relatorio
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="basic">Informacoes</TabsTrigger>
          <TabsTrigger value="components">
            Componentes ({report.components.length})
          </TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6">
          <BasicInfoTab
            report={report}
            onChange={updateReport}
            isPlatformAdmin={isPlatformAdmin}
          />
        </TabsContent>

        <TabsContent value="components" className="mt-6">
          <ComponentsTab
            components={report.components}
            onChange={(components) => updateReport({ components })}
          />
        </TabsContent>

        <TabsContent value="layout" className="mt-6">
          <LayoutTab
            components={report.components}
            layoutConfig={report.layoutConfig}
            onChange={(components) => updateReport({ components })}
            onLayoutChange={(layoutConfig) => updateReport({ layoutConfig })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function NewReportPage() {
  return (
    <RequireRole module="reports" permission="canCreate">
      <NewReportPageContent />
    </RequireRole>
  );
}
