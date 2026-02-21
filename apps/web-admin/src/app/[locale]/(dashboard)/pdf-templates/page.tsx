'use client';

import { useState, useMemo, useCallback } from 'react';
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
  Filter,
  X,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  useGeneratePdf,
  useGenerateBatchPdf,
} from '@/hooks/use-pdf-templates';
import { useEntityData } from '@/hooks/use-data';
import type { PdfTemplate } from '@/services/pdf-templates.service';

function GenerateModal({
  template,
  open,
  onOpenChange,
}: {
  template: PdfTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [recordSearch, setRecordSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<
    Array<{ fieldSlug: string; fieldName: string; fieldType: string; operator: string; value: string }>
  >([]);

  const entitySlug = template?.sourceEntity?.slug || '';
  const isBatch = template?.templateType === 'batch';

  const { data: recordsData, isLoading: loadingRecords } = useEntityData(
    entitySlug,
    {
      limit: 50,
      search: recordSearch || undefined,
      filters: activeFilters.length > 0
        ? JSON.stringify(activeFilters)
        : undefined,
    }
  );

  const generateSingle = useGeneratePdf();
  const generateBatch = useGenerateBatchPdf();
  const isGenerating = generateSingle.isPending || generateBatch.isPending;

  const records = recordsData?.data || [];
  const entityFields = recordsData?.entity?.fields || template?.sourceEntity?.fields || [];

  // Campos de texto para exibir no label de cada registro
  const displayFields = useMemo(() => {
    return entityFields
      .filter((f: { type: string }) =>
        ['text', 'short_text', 'string'].includes(f.type)
      )
      .slice(0, 3);
  }, [entityFields]);

  // Campos filtraveis (text, select, short_text)
  const filterableFields = useMemo(() => {
    return entityFields.filter(
      (f: { type: string; slug: string; name: string }) =>
        ['text', 'short_text', 'string', 'select', 'number'].includes(f.type)
    );
  }, [entityFields]);

  // Valores unicos por campo (para selects de filtro)
  const uniqueFieldValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const field of filterableFields) {
      const slug = (field as { slug: string }).slug;
      const values = new Set<string>();
      for (const record of records) {
        const val = record.data?.[slug];
        if (val && typeof val === 'string' && val.length > 0) {
          values.add(val);
        } else if (val && typeof val === 'number') {
          values.add(String(val));
        }
      }
      if (values.size > 0 && values.size <= 50) {
        map[slug] = Array.from(values).sort();
      }
    }
    return map;
  }, [filterableFields, records]);

  const handleAddFilter = useCallback(() => {
    if (filterableFields.length === 0) return;
    const first = filterableFields[0] as { slug: string; name: string; type: string; label?: string };
    setActiveFilters((prev) => [
      ...prev,
      {
        fieldSlug: first.slug,
        fieldName: first.label || first.name,
        fieldType: first.type,
        operator: 'equals',
        value: '',
      },
    ]);
  }, [filterableFields]);

  const handleRemoveFilter = useCallback((index: number) => {
    setActiveFilters((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFilterFieldChange = useCallback(
    (index: number, slug: string) => {
      const field = filterableFields.find(
        (f: { slug: string }) => f.slug === slug
      ) as { slug: string; name: string; type: string; label?: string } | undefined;
      if (!field) return;
      setActiveFilters((prev) => {
        const newFilters = [...prev];
        newFilters[index] = {
          ...newFilters[index],
          fieldSlug: slug,
          fieldName: field.label || field.name,
          fieldType: field.type,
          value: '',
        };
        return newFilters;
      });
    },
    [filterableFields]
  );

  const handleFilterValueChange = useCallback((index: number, value: string) => {
    setActiveFilters((prev) => {
      const newFilters = [...prev];
      newFilters[index] = { ...newFilters[index], value };
      return newFilters;
    });
  }, []);

  const getRecordLabel = (record: { id: string; data: Record<string, unknown> }) => {
    for (const field of displayFields) {
      const val = record.data[(field as { slug: string }).slug];
      if (val && typeof val === 'string') return val;
    }
    // Fallback: first string value
    for (const val of Object.values(record.data)) {
      if (val && typeof val === 'string' && val.length > 2 && val.length < 100) return val;
    }
    return record.id.slice(-8);
  };

  const handleToggleRecord = (id: string) => {
    if (isBatch) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map((r) => r.id));
    }
  };

  const handleGenerate = async () => {
    if (!template || selectedIds.length === 0) return;
    try {
      if (isBatch) {
        await generateBatch.mutateAsync({
          templateId: template.id,
          recordIds: selectedIds,
          mergePdfs: true,
        });
      } else {
        await generateSingle.mutateAsync({
          templateId: template.id,
          recordId: selectedIds[0],
        });
      }
      onOpenChange(false);
      setSelectedIds([]);
      setRecordSearch('');
      setActiveFilters([]);
    } catch {
      // Error handled by hook
    }
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      setSelectedIds([]);
      setRecordSearch('');
      setActiveFilters([]);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerar PDF</DialogTitle>
          <DialogDescription>
            {template?.name} &mdash;{' '}
            {isBatch
              ? 'Selecione os registros para gerar o PDF em lote'
              : 'Selecione um registro para gerar o PDF'}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar registros..."
            value={recordSearch}
            onChange={(e) => setRecordSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters for batch */}
        {isBatch && filterableFields.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Filtros
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddFilter}
              >
                <Plus className="h-3 w-3 mr-1" />
                Filtro
              </Button>
            </div>
            {activeFilters.map((filter, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={filter.fieldSlug}
                  onValueChange={(val) => handleFilterFieldChange(index, val)}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filterableFields.map((f: { slug: string; name: string; label?: string }) => (
                      <SelectItem key={f.slug} value={f.slug}>
                        {f.label || f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {uniqueFieldValues[filter.fieldSlug] ? (
                  <Select
                    value={filter.value || '_empty'}
                    onValueChange={(val) =>
                      handleFilterValueChange(index, val === '_empty' ? '' : val)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Valor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_empty">Todos</SelectItem>
                      {uniqueFieldValues[filter.fieldSlug].map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Valor..."
                    value={filter.value}
                    onChange={(e) => handleFilterValueChange(index, e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveFilter(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Select all for batch */}
        {isBatch && records.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={records.length > 0 && selectedIds.length === records.length}
                onCheckedChange={handleSelectAll}
              />
              Selecionar todos ({records.length})
            </label>
            {selectedIds.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedIds.length} selecionado{selectedIds.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Records list */}
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px] border rounded-md divide-y">
          {loadingRecords ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">
                {recordSearch ? 'Nenhum registro encontrado' : 'Nenhum registro disponivel'}
              </p>
            </div>
          ) : (
            records.map((record) => {
              const isSelected = selectedIds.includes(record.id);
              return (
                <label
                  key={record.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors ${
                    isSelected ? 'bg-accent/50' : ''
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleRecord(record.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {getRecordLabel(record)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={selectedIds.length === 0 || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Gerar PDF
                {isBatch && selectedIds.length > 0 && ` (${selectedIds.length})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PdfTemplatesPageContent() {
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const { hasModulePermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<PdfTemplate | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [templateToGenerate, setTemplateToGenerate] = useState<PdfTemplate | null>(null);

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

  const handleGenerate = (template: PdfTemplate) => {
    setTemplateToGenerate(template);
    setGenerateDialogOpen(true);
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
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 text-xs sm:text-sm"
                        onClick={() => handleGenerate(template)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Gerar
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate Modal */}
      <GenerateModal
        template={templateToGenerate}
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
      />

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
