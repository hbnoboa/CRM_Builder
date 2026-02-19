'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Loader2,
  Save,
  Eye,
  Settings,
  Layers,
  FileText,
  CheckCircle,
  XCircle,
  Download,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RequireRole } from '@/components/auth/require-role';
import { usePermissions } from '@/hooks/use-permissions';
import {
  usePdfTemplate,
  useUpdatePdfTemplate,
  usePublishPdfTemplate,
  useUnpublishPdfTemplate,
  useGeneratePdfSync,
} from '@/hooks/use-pdf-templates';
import { useEntities, useEntityBySlug } from '@/hooks/use-entities';
import { toast } from 'sonner';
import type { PdfElement } from '@/types';

// Dynamic import for Konva (SSR incompatible)
const PdfTemplateDesigner = dynamic(
  () => import('@/components/pdf/pdf-template-designer').then((mod) => mod.PdfTemplateDesigner),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);

const settingsSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z.string()
    .min(2, 'Slug deve ter pelo menos 2 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minusculas, numeros e hifens'),
  description: z.string().optional(),
  category: z.string().optional(),
  entitySlug: z.string().optional(),
  pageSize: z.enum(['A4', 'LETTER', 'LEGAL']),
  orientation: z.enum(['portrait', 'landscape']),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const CATEGORIES = [
  { value: 'relatorio', label: 'Relatorio' },
  { value: 'ficha', label: 'Ficha' },
  { value: 'etiqueta', label: 'Etiqueta' },
  { value: 'formulario', label: 'Formulario' },
  { value: 'contrato', label: 'Contrato' },
];

function PdfTemplateEditorContent() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('pdfTemplates');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { hasModulePermission, hasModuleAction } = usePermissions();

  const [activeTab, setActiveTab] = useState('editor');
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: template, isLoading, refetch } = usePdfTemplate(id);
  const { data: entitiesData } = useEntities();
  const entities = entitiesData?.data ?? (Array.isArray(entitiesData) ? entitiesData : []);

  // Fetch linked entity details if template has one
  const { data: linkedEntity } = useEntityBySlug(template?.entitySlug || '');
  const entity = useMemo(() => linkedEntity || null, [linkedEntity]);

  const updateTemplate = useUpdatePdfTemplate({ success: t('toast.saved') });
  const publishTemplate = usePublishPdfTemplate({ success: t('toast.published') });
  const unpublishTemplate = useUnpublishPdfTemplate({ success: t('toast.unpublished') });
  const generatePdf = useGeneratePdfSync({ success: t('toast.generated') });

  const canUpdate = hasModulePermission('pdf', 'canUpdate') && !template?.isSystem;
  const canPublish = hasModuleAction('pdf', 'canPublish') && !template?.isSystem;
  const canGenerate = hasModuleAction('pdf', 'canGenerate');

  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      category: '',
      entitySlug: '',
      pageSize: 'A4',
      orientation: 'portrait',
    },
  });

  useEffect(() => {
    if (template) {
      const settings = template.settings as { pageSize?: string; orientation?: string } | undefined;
      settingsForm.reset({
        name: template.name,
        slug: template.slug,
        description: template.description || '',
        category: template.category || '',
        entitySlug: template.entitySlug || '',
        pageSize: (settings?.pageSize as 'A4' | 'LETTER' | 'LEGAL') || 'A4',
        orientation: (settings?.orientation as 'portrait' | 'landscape') || 'portrait',
      });
    }
  }, [template, settingsForm]);

  const onSaveSettings = async (data: SettingsFormData) => {
    if (!template) return;

    await updateTemplate.mutateAsync({
      id: template.id,
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        category: data.category || undefined,
        entitySlug: data.entitySlug || undefined,
        settings: {
          ...(template.settings as Record<string, unknown>),
          pageSize: data.pageSize,
          orientation: data.orientation,
        },
      },
    });
    refetch();
  };

  const handleTogglePublish = async () => {
    if (!template) return;

    if (template.isPublished) {
      await unpublishTemplate.mutateAsync(template.id);
    } else {
      await publishTemplate.mutateAsync(template.id);
    }
    refetch();
  };

  const handleTestGenerate = async () => {
    if (!template) return;

    setIsGenerating(true);
    try {
      const result = await generatePdf.mutateAsync({
        templateId: template.id,
      });

      if (result.fileUrl) {
        toast.success(t('toast.generated'), {
          action: {
            label: t('download'),
            onClick: () => window.open(result.fileUrl, '_blank'),
          },
        });
      }
    } catch {
      // Error handled by hook
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveElements = async (elements: PdfElement[]) => {
    if (!template) return;

    await updateTemplate.mutateAsync({
      id: template.id,
      data: {
        schemas: [elements], // Page 1 elements
      },
    });
    refetch();
  };

  const handlePreview = () => {
    setActiveTab('preview');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">{t('notFound')}</h3>
        <Button asChild className="mt-4">
          <Link href="/pdf-templates">{t('backToList')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/pdf-templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{template.name}</h1>
              {template.isPublished ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  {t('published')}
                </Badge>
              ) : (
                <Badge variant="secondary">{t('draft')}</Badge>
              )}
              {template.isSystem && (
                <Badge variant="outline">{t('system')}</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{template.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canGenerate && (
            <Button
              variant="outline"
              onClick={handleTestGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {t('testGenerate')}
            </Button>
          )}
          {canPublish && (
            <Button
              variant={template.isPublished ? 'outline' : 'default'}
              onClick={handleTogglePublish}
            >
              {template.isPublished ? (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t('unpublish')}
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t('publish')}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="editor" className="gap-2">
            <Layers className="h-4 w-4" />
            {t('tabs.editor')}
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            {t('tabs.preview')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            {t('tabs.settings')}
          </TabsTrigger>
        </TabsList>

        {/* Editor Tab */}
        <TabsContent value="editor" className="mt-6">
          {canUpdate ? (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <PdfTemplateDesigner
                  template={template}
                  entity={entity}
                  onSave={handleSaveElements}
                  onPreview={handlePreview}
                  isSaving={updateTemplate.isPending}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t('editor.title')}</CardTitle>
                <CardDescription>{t('editor.readOnly')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">
                    {t('editor.viewOnly')}
                  </h3>
                  {template.schemas && Array.isArray(template.schemas) && template.schemas.length > 0 && (
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        {t('editor.elementsCount', { count: template.schemas.flat().length })}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('preview.title')}</CardTitle>
              <CardDescription>{t('preview.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg bg-white shadow-inner p-8 min-h-[600px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Eye className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>{t('preview.placeholder')}</p>
                  <p className="text-sm mt-2">{t('preview.placeholderDesc')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.title')}</CardTitle>
              <CardDescription>{t('settings.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit(onSaveSettings)} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={settingsForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('form.name')}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!canUpdate} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('form.slug')}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!canUpdate} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={settingsForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('form.description')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} disabled={!canUpdate} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={settingsForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('form.category')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!canUpdate}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('form.categoryPlaceholder')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">{t('form.noCategory')}</SelectItem>
                              {CATEGORIES.map((category) => (
                                <SelectItem key={category.value} value={category.value}>
                                  {category.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="entitySlug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('form.linkedEntity')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!canUpdate}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('form.linkedEntityPlaceholder')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">{t('form.noEntity')}</SelectItem>
                              {entities.map((entity) => (
                                <SelectItem key={entity.id} value={entity.slug}>
                                  {entity.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>{t('form.linkedEntityDesc')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <h3 className="text-lg font-medium">{t('settings.page')}</h3>

                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={settingsForm.control}
                      name="pageSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('form.pageSize')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!canUpdate}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
                              <SelectItem value="LETTER">Letter (8.5 x 11 in)</SelectItem>
                              <SelectItem value="LEGAL">Legal (8.5 x 14 in)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="orientation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('form.orientation')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!canUpdate}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="portrait">{t('form.portrait')}</SelectItem>
                              <SelectItem value="landscape">{t('form.landscape')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {canUpdate && (
                    <div className="flex justify-end">
                      <Button type="submit" disabled={updateTemplate.isPending}>
                        {updateTemplate.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <Save className="mr-2 h-4 w-4" />
                        {tCommon('save')}
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Template Info */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t('info.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('info.version')}</p>
                  <p className="font-medium">v{template.version}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('info.createdAt')}</p>
                  <p className="font-medium">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('info.updatedAt')}</p>
                  <p className="font-medium">
                    {new Date(template.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                {template._count && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('info.generations')}</p>
                    <p className="font-medium">{template._count.generations}</p>
                  </div>
                )}
              </div>
              {template.createdBy && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('info.createdBy')}</p>
                  <p className="font-medium">{template.createdBy.name}</p>
                </div>
              )}
              {template.clonedFrom && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('info.clonedFrom')}</p>
                  <p className="font-medium">{template.clonedFrom.name}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PdfTemplateEditorPage() {
  return (
    <RequireRole module="pdf" action="canRead">
      <PdfTemplateEditorContent />
    </RequireRole>
  );
}
