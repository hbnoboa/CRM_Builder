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
  Copy,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Download,
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
import {
  usePdfTemplates,
  useDeletePdfTemplate,
  useDuplicatePdfTemplate,
  usePublishPdfTemplate,
  useUnpublishPdfTemplate,
} from '@/hooks/use-pdf-templates';
import type { PdfTemplate } from '@/services/pdf-templates.service';

function PdfTemplatesPageContent() {
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const { hasModulePermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<PdfTemplate | null>(null);

  const { data, isLoading } = usePdfTemplates({ search: search || undefined });
  const deleteTemplate = useDeletePdfTemplate({ success: 'Template excluido com sucesso!' });
  const duplicateTemplate = useDuplicatePdfTemplate({ success: 'Template duplicado com sucesso!' });
  const publishTemplate = usePublishPdfTemplate();
  const unpublishTemplate = useUnpublishPdfTemplate();

  const templates: PdfTemplate[] = data?.data || [];

  const handleDeleteTemplate = (template: PdfTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    try {
      await deleteTemplate.mutateAsync(templateToDelete.id);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch {
      // Error handled by hook
    }
  };

  const handleDuplicate = async (template: PdfTemplate) => {
    try {
      await duplicateTemplate.mutateAsync(template.id);
    } catch {
      // Error handled by hook
    }
  };

  const handleTogglePublish = async (template: PdfTemplate) => {
    try {
      if (template.isPublished) {
        await unpublishTemplate.mutateAsync(template.id);
      } else {
        await publishTemplate.mutateAsync(template.id);
      }
    } catch {
      // Error handled by hook
    }
  };

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
        <span className="font-semibold text-foreground">Templates de PDF</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Templates de PDF</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Crie e gerencie templates personalizados para geracao de PDFs
          </p>
        </div>
        {hasModulePermission('pdfTemplates', 'canCreate') && (
          <Link href="/pdf-templates/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold">{templates.length}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total de Templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {templates.filter((t) => t.isPublished).length}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Publicados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">
              {templates.reduce((sum, t) => sum + (t._count?.generations || 0), 0)}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">PDFs Gerados</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Templates Grid */}
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
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-6 sm:p-12 text-center">
            <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">Nenhum template encontrado</h3>
            <p className="text-muted-foreground">
              {search
                ? 'Nenhum template corresponde a busca'
                : 'Crie um template para comecar a gerar PDFs'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="group transition-colors hover:border-primary/50"
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <h3 className="font-semibold text-sm sm:text-base truncate">
                          {template.name}
                        </h3>
                        {template.isPublished ? (
                          <Badge variant="default" className="text-[10px] h-5 gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Publicado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                            <XCircle className="h-3 w-3" />
                            Rascunho
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        /{template.slug}
                      </p>
                    </div>
                  </div>
                  {(hasModulePermission('pdfTemplates', 'canUpdate') ||
                    hasModulePermission('pdfTemplates', 'canDelete')) && (
                    <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {hasModulePermission('pdfTemplates', 'canUpdate') && (
                            <DropdownMenuItem asChild>
                              <Link href={`/pdf-templates/${template.id}`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {tCommon('edit')}
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {hasModulePermission('pdfTemplates', 'canCreate') && (
                            <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                          )}
                          {hasModulePermission('pdfTemplates', 'canUpdate') && (
                            <DropdownMenuItem onClick={() => handleTogglePublish(template)}>
                              {template.isPublished ? (
                                <>
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Despublicar
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Publicar
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {hasModulePermission('pdfTemplates', 'canDelete') && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteTemplate(template)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              {tCommon('delete')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {template.description && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3 line-clamp-2">
                    {template.description}
                  </p>
                )}

                <div className="mt-3 sm:mt-4">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">
                      {template.templateType === 'single' ? 'Individual' : 'Lote'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {template.pageSize}
                    </Badge>
                    {template.sourceEntity && (
                      <Badge variant="outline" className="text-xs">
                        {template.sourceEntity.name}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                  {hasModulePermission('pdfTemplates', 'canUpdate') && (
                    <Link href={`/pdf-templates/${template.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
                        <Pencil className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </Link>
                  )}
                  {template.isPublished &&
                    hasModulePermission('pdfTemplates', 'canGenerate') && (
                      <Link
                        href={`/data?entity=${template.sourceEntity?.slug || ''}`}
                        className="flex-1"
                      >
                        <Button variant="default" size="sm" className="w-full text-xs sm:text-sm">
                          <Download className="h-3 w-3 mr-1" />
                          Gerar
                        </Button>
                      </Link>
                    )}
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
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template &quot;{templateToDelete?.name}&quot;? Esta
              acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTemplate.isPending}>
              {tCommon('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTemplate.isPending}
            >
              {deleteTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function PdfTemplatesPage() {
  return (
    <RequireRole module="pdfTemplates">
      <PdfTemplatesPageContent />
    </RequireRole>
  );
}
