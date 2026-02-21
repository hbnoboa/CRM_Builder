'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Loader2,
  Save,
  Eye,
  CheckCircle,
  Settings,
  FileText,
  LayoutList,
  Image,
  Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RequireRole } from '@/components/auth/require-role';
import { usePdfTemplate, useUpdatePdfTemplate, usePublishPdfTemplate } from '@/hooks/use-pdf-templates';
import type { PdfTemplate, PdfTemplateContent } from '@/services/pdf-templates.service';

// Tab components
import { GeneralTab } from '@/components/pdf/template-editor/general-tab';
import { HeaderTab } from '@/components/pdf/template-editor/header-tab';
import { ElementsTab } from '@/components/pdf/template-editor/elements-tab';
import { FooterTab } from '@/components/pdf/template-editor/footer-tab';
import { DataTab } from '@/components/pdf/template-editor/data-tab';
import { PdfPreview } from '@/components/pdf/preview/pdf-preview';

interface PageProps {
  params: { id: string };
}

function EditPdfTemplatePageContent({ params }: PageProps) {
  const { id } = params;
  const router = useRouter();
  const tNav = useTranslations('navigation');

  const { data: template, isLoading, error } = usePdfTemplate(id);
  const updateTemplate = useUpdatePdfTemplate({ success: 'Template salvo com sucesso!' });
  const publishTemplate = usePublishPdfTemplate();

  const [localContent, setLocalContent] = useState<PdfTemplateContent | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (template?.content) {
      setLocalContent(template.content as PdfTemplateContent);
    }
  }, [template]);

  const handleContentChange = (newContent: Partial<PdfTemplateContent>) => {
    if (!localContent) return;
    setLocalContent({ ...localContent, ...newContent });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!template || !localContent) return;
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        data: { content: localContent },
      });
      setHasChanges(false);
    } catch {
      // Error handled by hook
    }
  };

  const handlePublish = async () => {
    if (!template) return;
    try {
      // Save first if there are changes
      if (hasChanges && localContent) {
        await updateTemplate.mutateAsync({
          id: template.id,
          data: { content: localContent },
        });
        setHasChanges(false);
      }
      await publishTemplate.mutateAsync(template.id);
    } catch {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Template nao encontrado</p>
        <Link href="/pdf-templates">
          <Button variant="outline">Voltar para lista</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumbs */}
      <nav
        className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"
        aria-label="breadcrumb"
      >
        <Link href="/dashboard" className="hover:underline">
          {tNav('dashboard')}
        </Link>
        <span>/</span>
        <Link href="/pdf-templates" className="hover:underline">
          Templates de PDF
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{template.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/pdf-templates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{template.name}</h1>
              {template.isPublished ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Publicado
                </Badge>
              ) : (
                <Badge variant="secondary">Rascunho</Badge>
              )}
              {hasChanges && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  Alteracoes nao salvas
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">/{template.slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? 'Ocultar Preview' : 'Preview'}
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={!hasChanges || updateTemplate.isPending}
          >
            {updateTemplate.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
          {!template.isPublished && (
            <Button onClick={handlePublish} disabled={publishTemplate.isPending}>
              {publishTemplate.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Publicar
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`grid gap-6 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
        {/* Editor Tabs */}
        <div>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="general" className="gap-2">
                <Settings className="h-4 w-4" />
                Geral
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-2">
                <Calculator className="h-4 w-4" />
                Dados
              </TabsTrigger>
              <TabsTrigger value="header" className="gap-2">
                <Image className="h-4 w-4" />
                Header
              </TabsTrigger>
              <TabsTrigger value="elements" className="gap-2">
                <LayoutList className="h-4 w-4" />
                Elementos
              </TabsTrigger>
              <TabsTrigger value="footer" className="gap-2">
                <FileText className="h-4 w-4" />
                Footer
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4">
              <GeneralTab
                template={template}
                onUpdate={(data) => {
                  updateTemplate.mutate({ id: template.id, data });
                }}
                isUpdating={updateTemplate.isPending}
              />
            </TabsContent>

            <TabsContent value="data" className="mt-4">
              {localContent && (
                <DataTab
                  computedFields={localContent.computedFields || []}
                  onChange={(computedFields) => handleContentChange({ computedFields })}
                  availableFields={template.sourceEntity?.fields || []}
                  templateType={template.templateType}
                  elements={localContent.body || []}
                  onElementChange={(elementId, updates) => {
                    handleContentChange({
                      body: (localContent.body || []).map((el) =>
                        el.id === elementId ? { ...el, ...updates } : el
                      ),
                    });
                  }}
                  subEntities={template.subEntities}
                />
              )}
            </TabsContent>

            <TabsContent value="header" className="mt-4">
              {localContent && (
                <HeaderTab
                  header={localContent.header}
                  onChange={(header) => handleContentChange({ header })}
                  availableFields={template.sourceEntity?.fields || []}
                />
              )}
            </TabsContent>

            <TabsContent value="elements" className="mt-4">
              {localContent && (
                <ElementsTab
                  elements={localContent.body || []}
                  sourceEntity={template.sourceEntity}
                  onChange={(body) => handleContentChange({ body })}
                />
              )}
            </TabsContent>

            <TabsContent value="footer" className="mt-4">
              {localContent && (
                <FooterTab
                  footer={localContent.footer}
                  onChange={(footer) => handleContentChange({ footer })}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <Card className="h-fit sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>Visualizacao aproximada do PDF</CardDescription>
            </CardHeader>
            <CardContent>
              <PdfPreview
                template={template}
                content={localContent}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function EditPdfTemplatePage({ params }: PageProps) {
  return (
    <RequireRole module="pdfTemplates" action="canUpdate">
      <EditPdfTemplatePageContent params={params} />
    </RequireRole>
  );
}
