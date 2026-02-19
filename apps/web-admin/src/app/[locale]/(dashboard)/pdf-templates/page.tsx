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
  FileText,
  Loader2,
  Copy,
  CheckCircle,
  XCircle,
  Globe,
  Lock,
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
import type { PdfTemplate } from '@/types';

const categoryColors: Record<string, string> = {
  relatorio: 'bg-blue-100 text-blue-800',
  ficha: 'bg-green-100 text-green-800',
  etiqueta: 'bg-purple-100 text-purple-800',
  formulario: 'bg-orange-100 text-orange-800',
  contrato: 'bg-red-100 text-red-800',
};

function PdfTemplatesPageContent() {
  const t = useTranslations('pdfTemplates');
  const tCommon = useTranslations('common');
  const { hasModulePermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<PdfTemplate | null>(null);

  const { data, isLoading, refetch } = usePdfTemplates({ search: search || undefined });
  const deleteTemplate = useDeletePdfTemplate({ success: t('toast.deleted') });
  const duplicateTemplate = useDuplicatePdfTemplate({ success: t('toast.duplicated') });
  const publishTemplate = usePublishPdfTemplate({ success: t('toast.published') });
  const unpublishTemplate = useUnpublishPdfTemplate({ success: t('toast.unpublished') });

  const templates: PdfTemplate[] = data?.data ?? [];

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(search.toLowerCase()) ||
    template.slug.toLowerCase().includes(search.toLowerCase()) ||
    template.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (template: PdfTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    await deleteTemplate.mutateAsync(templateToDelete.id);
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
  };

  const handleDuplicate = async (template: PdfTemplate) => {
    await duplicateTemplate.mutateAsync(template.id);
  };

  const handleTogglePublish = async (template: PdfTemplate) => {
    if (template.isPublished) {
      await unpublishTemplate.mutateAsync(template.id);
    } else {
      await publishTemplate.mutateAsync(template.id);
    }
  };

  const canCreate = hasModulePermission('pdf', 'canCreate');
  const canUpdate = hasModulePermission('pdf', 'canUpdate');
  const canDelete = hasModulePermission('pdf', 'canDelete');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/pdf-templates/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('newTemplate')}
            </Link>
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{t('noTemplates')}</h3>
            <p className="text-muted-foreground text-center mt-1">
              {search ? t('noTemplatesSearch') : t('noTemplatesYet')}
            </p>
            {canCreate && !search && (
              <Button asChild className="mt-4">
                <Link href="/pdf-templates/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createFirst')}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{template.name}</h3>
                      <p className="text-sm text-muted-foreground">{template.slug}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/pdf-templates/${template.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          {tCommon('view')}
                        </Link>
                      </DropdownMenuItem>
                      {canUpdate && !template.isSystem && (
                        <DropdownMenuItem asChild>
                          <Link href={`/pdf-templates/${template.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {tCommon('edit')}
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                        <Copy className="mr-2 h-4 w-4" />
                        {t('duplicate')}
                      </DropdownMenuItem>
                      {canUpdate && !template.isSystem && (
                        <DropdownMenuItem onClick={() => handleTogglePublish(template)}>
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
                        </DropdownMenuItem>
                      )}
                      {canDelete && !template.isSystem && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(template)}
                            className="text-destructive"
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            {tCommon('delete')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {template.description && (
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {template.isPublished ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      {t('published')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      {t('draft')}
                    </Badge>
                  )}
                  {template.isGlobal && (
                    <Badge variant="outline">
                      <Globe className="mr-1 h-3 w-3" />
                      {t('global')}
                    </Badge>
                  )}
                  {template.isSystem && (
                    <Badge variant="outline">
                      <Lock className="mr-1 h-3 w-3" />
                      {t('system')}
                    </Badge>
                  )}
                  {template.category && (
                    <Badge className={categoryColors[template.category] || 'bg-gray-100 text-gray-800'}>
                      {template.category}
                    </Badge>
                  )}
                </div>

                {template.entity && (
                  <div className="mt-3 text-sm text-muted-foreground">
                    {t('linkedTo')}: <span className="font-medium">{template.entity.name}</span>
                  </div>
                )}

                {template._count && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t('generationsCount', { count: template._count.generations })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm.message', { name: templateToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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
    <RequireRole module="pdf" action="canRead">
      <PdfTemplatesPageContent />
    </RequireRole>
  );
}
