'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Loader2,
  Columns3,
  Eye,
  EyeOff,
  Table2,
  FileText,
  Filter,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useEntityDataOptional } from '@/components/entity-data/entity-data-context';
import { usePermissions } from '@/hooks/use-permissions';
import { useDeleteEntityData } from '@/hooks/use-data';
import { RecordFormDialog } from '@/components/data/record-form-dialog';
import { ImportDialog } from '@/components/data/import-dialog';
import { exportToJson, exportToXlsx } from '@/lib/export-utils';
import { pdfTemplatesService, type PdfTemplate } from '@/services/pdf-templates.service';
import { formatFieldValue, type FormatFieldOptions } from '@crm-builder/shared';
import { useEntityBySlug } from '@/hooks/use-entities';
import { api } from '@/lib/api';
import { useDashboardFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import type { WidgetConfig } from '@crm-builder/shared';
import type { DataRecord, EntityField } from '@/components/entity-data/unified-filter-types';
import type { Entity } from '@/types';

// ─── Filter Operators ────────────────────────────────────────────────

type FilterOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'isEmpty' | 'isNotEmpty';

const OPERATORS_BY_TYPE: Record<string, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: 'contains', label: 'Contem' },
    { value: 'equals', label: 'Igual a' },
    { value: 'startsWith', label: 'Comeca com' },
    { value: 'endsWith', label: 'Termina com' },
    { value: 'isEmpty', label: 'Vazio' },
    { value: 'isNotEmpty', label: 'Nao vazio' },
  ],
  number: [
    { value: 'equals', label: 'Igual a' },
    { value: 'gt', label: 'Maior que' },
    { value: 'gte', label: 'Maior ou igual' },
    { value: 'lt', label: 'Menor que' },
    { value: 'lte', label: 'Menor ou igual' },
    { value: 'between', label: 'Entre' },
    { value: 'isEmpty', label: 'Vazio' },
    { value: 'isNotEmpty', label: 'Nao vazio' },
  ],
  date: [
    { value: 'equals', label: 'Igual a' },
    { value: 'gt', label: 'Depois de' },
    { value: 'lt', label: 'Antes de' },
    { value: 'between', label: 'Entre' },
    { value: 'isEmpty', label: 'Vazio' },
    { value: 'isNotEmpty', label: 'Nao vazio' },
  ],
  select: [
    { value: 'equals', label: 'Igual a' },
    { value: 'isEmpty', label: 'Vazio' },
    { value: 'isNotEmpty', label: 'Nao vazio' },
  ],
  boolean: [
    { value: 'equals', label: 'Igual a' },
  ],
};

function getOperators(fieldType: string) {
  if (['number', 'currency', 'percentage', 'rating', 'slider'].includes(fieldType)) return OPERATORS_BY_TYPE.number;
  if (['date', 'datetime', 'time'].includes(fieldType)) return OPERATORS_BY_TYPE.date;
  if (['select', 'multiselect', 'zone-diagram'].includes(fieldType)) return OPERATORS_BY_TYPE.select;
  if (fieldType === 'boolean') return OPERATORS_BY_TYPE.boolean;
  return OPERATORS_BY_TYPE.text;
}

// ─── Props ──────────────────────────────────────────────────────────

interface DataTableWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
}

// ─── Component ──────────────────────────────────────────────────────

export function DataTableWidget({ entitySlug, config, title }: DataTableWidgetProps) {
  const t = useTranslations('data');
  const tCommon = useTranslations('common');
  const { hasEntityPermission } = usePermissions();
  const deleteRecord = useDeleteEntityData();

  const ctx = useEntityDataOptional();

  // When outside EntityDataProvider (e.g. dashboard template editor), show mock preview
  if (!ctx) {
    const mockFields = (config.displayFields as string[] || []).slice(0, 6);
    const mockCols = mockFields.length > 0
      ? mockFields
      : ['Campo 1', 'Campo 2', 'Campo 3', 'Campo 4', 'Campo 5'];
    return (
      <WidgetWrapper title={title || 'Tabela de Dados'}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Mock toolbar */}
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <div className="relative flex-1 min-w-[120px] max-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <div className="h-9 pl-8 pr-3 border rounded-md bg-muted/30 flex items-center text-xs text-muted-foreground">
                Buscar...
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-9 px-3 border rounded-md bg-muted/30 flex items-center text-xs text-muted-foreground gap-1">
                <Filter className="h-3.5 w-3.5" /> Filtrar
              </div>
              <div className="h-9 px-3 border rounded-md bg-muted/30 flex items-center text-xs text-muted-foreground gap-1">
                <Columns3 className="h-3.5 w-3.5" /> Colunas
              </div>
              {config.allowCreate !== false && (
                <div className="h-9 px-3 border rounded-md bg-primary/20 flex items-center text-xs text-primary gap-1">
                  <Plus className="h-3.5 w-3.5" /> Criar
                </div>
              )}
            </div>
          </div>
          {/* Mock table */}
          <div className="rounded-md border flex-1 overflow-hidden" style={{ minHeight: '340px' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  {config.allowBatchSelect !== false && (
                    <TableHead className="w-[40px]">
                      <Checkbox disabled />
                    </TableHead>
                  )}
                  {mockCols.map((col, i) => (
                    <TableHead key={i} className="text-xs whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {col}
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, row) => (
                  <TableRow key={row}>
                    {config.allowBatchSelect !== false && (
                      <TableCell><Checkbox disabled /></TableCell>
                    )}
                    {mockCols.map((_, i) => (
                      <TableCell key={i}>
                        <div className={`h-3 rounded bg-muted/60 ${i === 0 ? 'w-24' : i === 1 ? 'w-16' : 'w-20'}`} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Mock footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              {config.enablePagination !== false
                ? `1–${config.pageSize || 25} de 100 registros`
                : '100 registros'}
            </span>
            {config.enablePagination !== false && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="h-7 w-7 border rounded flex items-center justify-center opacity-40"><ChevronsLeft className="h-3.5 w-3.5" /></div>
                <div className="h-7 w-7 border rounded flex items-center justify-center opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></div>
                <span className="text-xs px-2 text-muted-foreground">1 / 4</span>
                <div className="h-7 w-7 border rounded flex items-center justify-center"><ChevronRight className="h-3.5 w-3.5" /></div>
                <div className="h-7 w-7 border rounded flex items-center justify-center"><ChevronsRight className="h-3.5 w-3.5" /></div>
              </div>
            )}
          </div>
        </div>
      </WidgetWrapper>
    );
  }

  return <DataTableWidgetInner entitySlug={entitySlug} config={config} title={title} ctx={ctx} />;
}

function DataTableWidgetInner({ entitySlug, config, title, ctx }: DataTableWidgetProps & { ctx: NonNullable<ReturnType<typeof useEntityDataOptional>> }) {
  const t = useTranslations('data');
  const tCommon = useTranslations('common');
  const { hasEntityPermission } = usePermissions();
  const deleteRecord = useDeleteEntityData();

  const {
    entity,
    allRecords,
    sortedRecords,
    filters,
    setSearchTerm,
    setSortConfig,
    removeRecord,
    refresh,
    isLoading,
  } = ctx;

  // Use DashboardFilterProvider for cross-filter clicks so they sync with other widgets
  const dashFilters = useDashboardFilters();
  const toggleCrossFilter = dashFilters.toggleCrossFilter;

  // Config
  const enablePagination = config.enablePagination !== false;
  const pageSize = config.pageSize || 25;
  const allowCreate = config.allowCreate !== false;
  const allowEdit = config.allowEdit !== false;
  const allowDelete = config.allowDelete !== false;
  const allowExport = config.allowExport !== false;
  const allowImport = config.allowImport !== false;
  const allowBatchSelect = config.allowBatchSelect !== false;

  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [localSearch, setLocalSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<DataRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<DataRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [newFilterField, setNewFilterField] = useState<string>('');
  const [newFilterOperator, setNewFilterOperator] = useState<string>('');
  const [newFilterValue, setNewFilterValue] = useState<unknown>(undefined);
  const [newFilterValue2, setNewFilterValue2] = useState<unknown>(undefined);

  // Fetch published PDF templates for this entity
  useEffect(() => {
    if (!entity?.id) return;
    pdfTemplatesService.getAll({ sourceEntityId: entity.id, isPublished: true })
      .then(res => setPdfTemplates(res.data || []))
      .catch(() => setPdfTemplates([]));
  }, [entity?.id]);

  // Permissions
  const canCreate = allowCreate && hasEntityPermission(entitySlug, 'canCreate');
  const canEdit = allowEdit && hasEntityPermission(entitySlug, 'canUpdate');
  const canDelete = allowDelete && hasEntityPermission(entitySlug, 'canDelete');

  // ─── Cross-entity metadata for filter popover ────────────────────

  // Parent entity metadata (if this is a sub-entity)
  const parentEntitySlug = (entity as unknown as Record<string, unknown>)?.parentEntitySlug as string | null;
  const { data: parentEntityData } = useEntityBySlug(parentEntitySlug || '');

  // Sub-entity fields
  const subEntityFields = useMemo(() => {
    if (!entity?.fields) return [];
    return entity.fields.filter(f => f.type === 'sub-entity');
  }, [entity?.fields]);

  // Child entity metadata (fetched via API, same pattern as data/page.tsx)
  const [childEntitiesFields, setChildEntitiesFields] = useState<Map<string, { name: string; fields: EntityField[] }>>(new Map());
  useEffect(() => {
    if (subEntityFields.length === 0) {
      setChildEntitiesFields(new Map());
      return;
    }
    const fetchAll = async () => {
      const map = new Map<string, { name: string; fields: EntityField[] }>();
      for (const subField of subEntityFields) {
        const subSlug = (subField as unknown as Record<string, unknown>).subEntitySlug as string;
        if (!subSlug) continue;
        try {
          const res = await api.get(`/entities/slug/${subSlug}`);
          const childEntity = res.data;
          const fields = ((childEntity.fields || []) as EntityField[]).filter((f: EntityField) =>
            !['hidden', 'file', 'image', 'json', 'richtext', 'sub-entity'].includes(f.type)
          );
          map.set(subSlug, { name: childEntity.name, fields });
        } catch { /* skip */ }
      }
      setChildEntitiesFields(map);
    };
    fetchAll();
  }, [subEntityFields]);

  // Filterable fields for the filter popover (with cross-entity fields)
  type FilterField = EntityField & { _group?: string; _originalField?: EntityField };
  const filterableFields = useMemo<FilterField[]>(() => {
    const result: FilterField[] = [];

    // Own fields
    if (entity?.fields) {
      const ownFields = entity.fields.filter(f =>
        f.type !== 'hidden' && f.type !== 'section-title' && f.type !== 'action-button' &&
        f.type !== 'file' && f.type !== 'image' && f.type !== 'json' && f.type !== 'richtext' &&
        f.type !== 'sub-entity'
      );
      for (const f of ownFields) {
        result.push({ ...f, _group: entity.name });
      }
    }

    // Parent fields (if sub-entity)
    if (parentEntityData && parentEntitySlug) {
      const parentFields = ((parentEntityData as Record<string, unknown>).fields as EntityField[] || []).filter((f: EntityField) =>
        !['hidden', 'file', 'image', 'json', 'richtext', 'sub-entity'].includes(f.type)
      );
      const parentName = (parentEntityData as Record<string, unknown>).name as string || parentEntitySlug;
      for (const f of parentFields) {
        result.push({
          ...f,
          slug: `parent.${f.slug}`,
          name: `${parentName} > ${f.label || f.name}`,
          _group: parentName,
          _originalField: f,
        });
      }
    }

    // Child entity fields + _hasChildren
    for (const [childSlug, { name: childName, fields }] of childEntitiesFields) {
      // Virtual "has children" field
      result.push({
        slug: `_hasChildren:${childSlug}`,
        name: `Tem ${childName}`,
        type: 'boolean' as EntityField['type'],
        _group: childName,
      } as FilterField);

      for (const f of fields) {
        result.push({
          ...f,
          slug: `child.${childSlug}.${f.slug}`,
          name: `${childName} > ${f.label || f.name}`,
          _group: childName,
          _originalField: f,
        });
      }
    }

    return result;
  }, [entity?.fields, entity?.name, parentEntityData, parentEntitySlug, childEntitiesFields]);

  // Handler to add a slicer filter
  const handleAddSlicerFilter = useCallback(() => {
    if (!newFilterField || !newFilterOperator) return;
    // Operators that don't need a value
    const noValueOps = ['isEmpty', 'isNotEmpty'];
    if (!noValueOps.includes(newFilterOperator) && (newFilterValue === undefined || newFilterValue === null || newFilterValue === '')) return;
    // Resolve the original field type for backend operator resolution
    const field = filterableFields.find(f => f.slug === newFilterField);
    const originalField = (field as FilterField)?._originalField || field;
    const fieldType = originalField?.type || 'text';
    dashFilters.setSlicerFilter(newFilterField, newFilterOperator, newFilterValue, fieldType);
    setNewFilterField('');
    setNewFilterOperator('');
    setNewFilterValue(undefined);
    setNewFilterValue2(undefined);
    setFilterPopoverOpen(false);
  }, [newFilterField, newFilterOperator, newFilterValue, filterableFields, dashFilters]);

  // Virtual meta columns (createdAt, updatedAt, geolocation)
  const metaColumns: EntityField[] = useMemo(() => {
    const cols: EntityField[] = [];
    if (config.showCreatedAt !== false) {
      cols.push({ slug: '__createdAt', name: tCommon('createdAt'), label: tCommon('createdAt'), type: 'datetime' } as EntityField);
    }
    if (config.showUpdatedAt !== false) {
      cols.push({ slug: '__updatedAt', name: tCommon('updatedAt'), label: tCommon('updatedAt'), type: 'datetime' } as EntityField);
    }
    if (config.showGeolocation) {
      cols.push(
        { slug: '__geo_lat', name: 'Latitude', label: 'Latitude', type: 'number' } as EntityField,
        { slug: '__geo_lng', name: 'Longitude', label: 'Longitude', type: 'number' } as EntityField,
        { slug: '__geo_city', name: 'Cidade (GPS)', label: 'Cidade (GPS)', type: 'text' } as EntityField,
        { slug: '__geo_uf', name: 'Estado (GPS)', label: 'Estado (GPS)', type: 'text' } as EntityField,
        { slug: '__geo_address', name: 'Endereco (GPS)', label: 'Endereco (GPS)', type: 'text' } as EntityField,
      );
    }
    return cols;
  }, [tCommon, config.showCreatedAt, config.showUpdatedAt, config.showGeolocation]);

  // Visible fields
  const visibleFields = useMemo(() => {
    if (!entity?.fields) return [];
    let fields = entity.fields.filter(f =>
      f.type !== 'hidden' &&
      f.type !== 'section-title' &&
      f.type !== 'action-button',
    );
    if (config.displayFields && config.displayFields.length > 0) {
      const displayOrder = config.displayFields as string[];
      const fieldMap = new Map(fields.map(f => [f.slug, f]));
      // Preserve order from displayFields config
      fields = displayOrder
        .map(slug => fieldMap.get(slug))
        .filter((f): f is EntityField => !!f);
    }
    // Append meta columns
    fields = [...fields, ...metaColumns];
    return fields.filter(f => !hiddenColumns.has(f.slug));
  }, [entity?.fields, config.displayFields, hiddenColumns, metaColumns]);

  // All toggleable fields
  const allToggleableFields = useMemo(() => {
    if (!entity?.fields) return [];
    let fields = entity.fields.filter(f =>
      f.type !== 'hidden' &&
      f.type !== 'section-title' &&
      f.type !== 'action-button',
    );
    if (config.displayFields && config.displayFields.length > 0) {
      const displayOrder = config.displayFields as string[];
      const fieldMap = new Map(fields.map(f => [f.slug, f]));
      fields = displayOrder
        .map(slug => fieldMap.get(slug))
        .filter((f): f is EntityField => !!f);
    }
    return [...fields, ...metaColumns];
  }, [entity?.fields, config.displayFields, metaColumns]);

  // Pagination
  const totalRecords = sortedRecords.length;
  const totalPages = enablePagination ? Math.max(1, Math.ceil(totalRecords / pageSize)) : 1;
  const safePage = enablePagination ? Math.min(currentPage, totalPages) : 1;

  const displayedRecords = useMemo(() => {
    if (!enablePagination) return sortedRecords;
    const start = (safePage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, safePage, pageSize, enablePagination]);

  // Search handler
  const handleSearch = useCallback((value: string) => {
    setLocalSearch(value);
    setSearchTerm(value);
    setCurrentPage(1);
  }, [setSearchTerm]);

  // Sort handler: asc → desc → reset (tri-state)
  const handleSort = useCallback((fieldSlug: string) => {
    if (filters.sortBy === fieldSlug) {
      if (filters.sortOrder === 'asc') {
        setSortConfig(fieldSlug, 'desc');
      } else {
        // Reset sort
        setSortConfig(config.defaultSortField || 'createdAt', (config.defaultSortOrder as 'asc' | 'desc') || 'desc');
      }
    } else {
      setSortConfig(fieldSlug, 'asc');
    }
  }, [filters.sortBy, filters.sortOrder, setSortConfig, config.defaultSortField, config.defaultSortOrder]);

  // Cross-filter on cell click — uses DashboardFilterProvider to sync with all widgets
  const handleCellClick = useCallback((fieldSlug: string, value: string) => {
    if (!value) return;
    toggleCrossFilter(fieldSlug, value);
  }, [toggleCrossFilter]);

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === displayedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedRecords.map(r => r.id)));
    }
  }, [selectedIds.size, displayedRecords]);

  // CRUD handlers
  const handleCreate = useCallback(() => {
    setEditRecord(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((record: DataRecord) => {
    setEditRecord(record);
    setFormOpen(true);
  }, []);

  const handleDeleteClick = useCallback((record: DataRecord) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!recordToDelete) return;
    try {
      await deleteRecord.mutateAsync({
        entitySlug,
        id: recordToDelete.id,
      });
      removeRecord(recordToDelete.id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(recordToDelete.id);
        return next;
      });
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  }, [recordToDelete, entitySlug, deleteRecord, removeRecord]);

  const handleFormSuccess = useCallback(() => {
    setFormOpen(false);
    setEditRecord(null);
    refresh();
  }, [refresh]);

  // Export
  const handleExport = useCallback((format: 'json' | 'xlsx') => {
    const recordsToExport = selectedIds.size > 0
      ? sortedRecords.filter(r => selectedIds.has(r.id))
      : sortedRecords;

    const entityName = entity?.name || entitySlug;
    if (format === 'json') {
      exportToJson(recordsToExport, entityName);
    } else {
      exportToXlsx(recordsToExport, visibleFields, entityName);
    }
    toast.success(`${recordsToExport.length} registros exportados`);
  }, [selectedIds, sortedRecords, entity?.name, entitySlug, visibleFields]);

  // PDF export
  const handlePdfExport = useCallback(async (template: PdfTemplate) => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const hasSelection = selectedIds.size > 0;
      const ids = hasSelection
        ? Array.from(selectedIds)
        : sortedRecords.map(r => r.id);

      if (template.templateType === 'single') {
        if (ids.length === 0) {
          toast.error('Selecione pelo menos um registro');
          return;
        }
        let success = 0;
        for (const recordId of ids) {
          try {
            const { blob, fileName } = await pdfTemplatesService.generateSingle(template.id, recordId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            success++;
            if (ids.indexOf(recordId) < ids.length - 1) {
              await new Promise(r => setTimeout(r, 500));
            }
          } catch {
            // continue with next
          }
        }
        toast.success(ids.length === 1 ? 'PDF gerado com sucesso' : `${success} de ${ids.length} PDF(s) gerado(s)`);
      } else {
        const { blob, fileName } = await pdfTemplatesService.generateBatch(template.id, {
          ...(hasSelection ? { recordIds: ids } : { useAllRecords: true }),
          mergePdfs: true,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('PDF em lote gerado com sucesso');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  }, [generatingPdf, selectedIds, sortedRecords]);

  // Column toggle
  const toggleColumn = useCallback((slug: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  // Get sort icon
  const getSortIcon = (fieldSlug: string) => {
    if (filters.sortBy !== fieldSlug) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return filters.sortOrder === 'asc'
      ? <ArrowUp className="h-3 w-3" />
      : <ArrowDown className="h-3 w-3" />;
  };

  // Format cell value
  const renderCellValue = (record: DataRecord, field: EntityField) => {
    // Virtual meta columns
    if (field.slug === '__createdAt' || field.slug === '__updatedAt') {
      const dateValue = field.slug === '__createdAt' ? record.createdAt : record.updatedAt;
      if (!dateValue) return <span className="text-muted-foreground">—</span>;
      const formatted = formatFieldValue(dateValue, { type: 'datetime' } as FormatFieldOptions);
      return <span className="truncate max-w-[200px] block text-muted-foreground text-xs">{formatted}</span>;
    }

    // Geolocation meta columns
    if (field.slug.startsWith('__geo_')) {
      const geo = record.data?._geolocation as Record<string, unknown> | undefined;
      if (!geo) return <span className="text-muted-foreground">—</span>;
      const key = field.slug.replace('__geo_', '');
      const geoVal = geo[key];
      if (geoVal === null || geoVal === undefined || geoVal === '') return <span className="text-muted-foreground">—</span>;
      return <span className="truncate max-w-[200px] block text-muted-foreground text-xs">{String(geoVal)}</span>;
    }

    const value = record.data?.[field.slug];
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground">—</span>;
    }

    // Sub-entity: show child count
    if (field.type === 'sub-entity') {
      const fExtra = field as unknown as Record<string, unknown>;
      const subSlug = fExtra.subEntitySlug as string;
      const count = record._childCounts?.[subSlug] ?? 0;
      return (
        <Badge variant="secondary" className="font-normal">
          {count}
        </Badge>
      );
    }

    // Use shared formatter
    const formatted = formatFieldValue(value, { type: field.type } as FormatFieldOptions);
    return <span className="truncate max-w-[200px] block">{formatted}</span>;
  };

  // Entity object for RecordFormDialog
  const entityForDialog = entity
    ? {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        tenantId: '',
        fields: entity.fields as unknown as Entity['fields'],
        settings: entity.settings as Entity['settings'],
      } as Entity
    : null;

  return (
    <WidgetWrapper title={title || entity?.name || entitySlug}>
      <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap flex-shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={localSearch}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Filter */}
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <Filter className="h-4 w-4" />
                Filtrar
                {dashFilters.slicerFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {dashFilters.slicerFilters.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
              <div className="space-y-4">
                <div className="font-medium">Adicionar Filtro</div>
                {/* Field selector */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Campo</Label>
                  <Select value={newFilterField} onValueChange={(value) => {
                    const field = filterableFields.find(f => f.slug === value);
                    if (field) {
                      const origField = (field as FilterField)?._originalField || field;
                      const ops = getOperators(origField.type);
                      setNewFilterField(value);
                      setNewFilterOperator(ops[0]?.value || '');
                      setNewFilterValue(origField.type === 'boolean' ? true : undefined);
                      setNewFilterValue2(undefined);
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar campo" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {(() => {
                        const groups = new Map<string, FilterField[]>();
                        for (const field of filterableFields) {
                          const group = field._group || entity?.name || '';
                          if (!groups.has(group)) groups.set(group, []);
                          groups.get(group)!.push(field);
                        }
                        const entries = Array.from(groups.entries());
                        if (entries.length <= 1) {
                          return filterableFields.map(f => (
                            <SelectItem key={f.slug} value={f.slug}>{f.label || f.name}</SelectItem>
                          ));
                        }
                        return entries.map(([label, fields]) => (
                          <SelectGroup key={label}>
                            <SelectLabel className="text-xs font-semibold text-muted-foreground">{label}</SelectLabel>
                            {fields.map(f => (
                              <SelectItem key={f.slug} value={f.slug}>{f.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                {/* Operator selector */}
                {newFilterField && (() => {
                  const field = filterableFields.find(f => f.slug === newFilterField);
                  const originalField = (field as FilterField)?._originalField || field;
                  const ops = getOperators(originalField?.type || 'text');
                  return (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Condicao</Label>
                      <Select value={newFilterOperator} onValueChange={(v) => { setNewFilterOperator(v); setNewFilterValue(field?.type === 'boolean' ? true : undefined); setNewFilterValue2(undefined); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ops.map(op => (<SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}
                {/* Value input */}
                {newFilterOperator && newFilterOperator !== 'isEmpty' && newFilterOperator !== 'isNotEmpty' && (() => {
                  const field = filterableFields.find(f => f.slug === newFilterField);
                  const originalField = (field as FilterField)?._originalField || field;
                  const ft = originalField?.type || 'text';
                  return (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Valor</Label>
                      {ft === 'boolean' && (
                        <div className="flex items-center gap-3">
                          <Switch checked={newFilterValue === true} onCheckedChange={(checked) => setNewFilterValue(checked)} />
                          <span className="text-sm">{newFilterValue ? 'Sim' : 'Nao'}</span>
                        </div>
                      )}
                      {['number', 'currency', 'percentage', 'rating', 'slider'].includes(ft) && (
                        <div className="flex gap-2">
                          <Input type="number" placeholder="Valor" value={String(newFilterValue || '')} onChange={(e) => setNewFilterValue(e.target.value ? parseFloat(e.target.value) : undefined)} />
                          {newFilterOperator === 'between' && (<><span className="text-muted-foreground self-center">e</span><Input type="number" placeholder="Valor" value={String(newFilterValue2 || '')} onChange={(e) => setNewFilterValue2(e.target.value ? parseFloat(e.target.value) : undefined)} /></>)}
                        </div>
                      )}
                      {['date', 'datetime', 'time'].includes(ft) && (
                        <div className="flex gap-2">
                          <Input type={ft === 'datetime' ? 'datetime-local' : ft === 'time' ? 'time' : 'date'} value={String(newFilterValue || '')} onChange={(e) => setNewFilterValue(e.target.value)} />
                          {newFilterOperator === 'between' && (<><span className="text-muted-foreground self-center">e</span><Input type={ft === 'datetime' ? 'datetime-local' : ft === 'time' ? 'time' : 'date'} value={String(newFilterValue2 || '')} onChange={(e) => setNewFilterValue2(e.target.value)} /></>)}
                        </div>
                      )}
                      {['select', 'multiselect', 'zone-diagram'].includes(ft) && (() => {
                        const optSource = originalField as unknown as Record<string, unknown>;
                        const opts = ft === 'zone-diagram'
                          ? ((optSource?.diagramZones as Array<{ options?: string[] }>)?.flatMap((z) => z.options || []) || []).map((o: string) => ({ value: o, label: o }))
                          : ((optSource?.options as Array<unknown>) || []).map((opt: unknown) => typeof opt === 'string' ? { value: opt, label: opt } : opt as { value: string; label: string });
                        return (
                          <Select value={String(newFilterValue || '')} onValueChange={(v) => setNewFilterValue(v)}>
                            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                            <SelectContent>{opts.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                          </Select>
                        );
                      })()}
                      {['text', 'textarea', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep', 'api-select', 'relation', 'array'].includes(ft) && (
                        <Input placeholder="Valor" value={String(newFilterValue || '')} onChange={(e) => setNewFilterValue(e.target.value)} />
                      )}
                      {ft === 'color' && (
                        <div className="flex items-center gap-2">
                          <input type="color" value={String(newFilterValue || '#000000')} onChange={(e) => setNewFilterValue(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                          <Input placeholder="#000000" value={String(newFilterValue || '')} onChange={(e) => setNewFilterValue(e.target.value)} className="flex-1" />
                        </div>
                      )}
                    </div>
                  );
                })()}
                <Button onClick={handleAddSlicerFilter} className="w-full" disabled={!newFilterField || !newFilterOperator || (!['isEmpty', 'isNotEmpty'].includes(newFilterOperator) && (newFilterValue === undefined || newFilterValue === null || newFilterValue === ''))}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Filtro
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Column visibility */}
          <DropdownMenu open={columnsMenuOpen} onOpenChange={setColumnsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Columns3 className="h-4 w-4 mr-1" />
                {tCommon('columns')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto">
              {allToggleableFields.map(f => (
                <DropdownMenuItem
                  key={f.slug}
                  onClick={(e) => { e.preventDefault(); toggleColumn(f.slug); }}
                  className="gap-2"
                >
                  {hiddenColumns.has(f.slug) ? (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {f.label || f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export */}
          {allowExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Download className="h-4 w-4 mr-1" />
                  {tCommon('export')}
                  {selectedIds.size > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {selectedIds.size}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')}>
                  JSON
                </DropdownMenuItem>
                {pdfTemplates.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {pdfTemplates.map(tpl => {
                      const isSingle = tpl.templateType === 'single';
                      const disabled = isSingle && selectedIds.size === 0;
                      return (
                        <DropdownMenuItem
                          key={tpl.id}
                          onClick={() => !disabled && handlePdfExport(tpl)}
                          onSelect={disabled ? (e) => e.preventDefault() : undefined}
                          className={`gap-2 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <FileText className="h-4 w-4 text-red-600" />
                          <span className="flex-1 truncate">{tpl.name}</span>
                          {disabled && <span className="text-[10px] text-muted-foreground">selecione</span>}
                          {generatingPdf && <Loader2 className="h-3 w-3 animate-spin" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Import */}
          {allowImport && hasEntityPermission(entitySlug, 'canCreate') && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              {tCommon('import')}
            </Button>
          )}

          {/* Create */}
          {canCreate && (
            <Button size="sm" className="h-9" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />
              {tCommon('create')}
            </Button>
          )}
        </div>
      </div>

      {/* Active slicer filters */}
      {dashFilters.slicerFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center mb-2 flex-shrink-0">
          {dashFilters.slicerFilters.map((sf) => {
            // Try to find by exact slug; for cross-entity transformed filters, look up raw slug
            let field = filterableFields.find(f => f.slug === sf.fieldSlug);
            if (!field) {
              // Transformed filter (parent.*/child.*) — strip prefix and look up
              let rawSlug = sf.fieldSlug;
              if (rawSlug.startsWith('parent.')) rawSlug = rawSlug.slice(7);
              else if (rawSlug.startsWith('child.')) {
                const parts = rawSlug.split('.');
                rawSlug = parts.length >= 3 ? parts.slice(2).join('.') : rawSlug;
              }
              field = filterableFields.find(f => f.slug === rawSlug || f.slug.endsWith(`.${rawSlug}`));
            }
            const originalField = (field as FilterField)?._originalField || field;
            const ops = getOperators(originalField?.type || 'text');
            const opLabel = ops.find(o => o.value === sf.operator)?.label || sf.operator;
            const displayName = field?.name || field?.label || sf.fieldSlug;
            return (
              <Badge key={`${sf.entitySlug || ''}-${sf.fieldSlug}`} variant="secondary" className="gap-1 pl-1.5 pr-1 py-0.5 text-[11px]">
                {displayName} {opLabel.toLowerCase()} {sf.operator !== 'isEmpty' && sf.operator !== 'isNotEmpty' && sf.value != null ? String(sf.value) : ''}
                <button onClick={() => dashFilters.removeSlicerFilter(sf.fieldSlug, sf.entitySlug)} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            );
          })}
          <button onClick={() => dashFilters.clearAllFilters()} className="text-[11px] text-muted-foreground hover:text-foreground px-1">
            Limpar filtros
          </button>
        </div>
      )}

      {/* Table — min 10 rows visible */}
      <div className="rounded-md border overflow-auto flex-1" style={{ minHeight: '340px' }}>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {allowBatchSelect && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={displayedRecords.length > 0 && selectedIds.size === displayedRecords.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              {visibleFields.map(field => (
                <TableHead
                  key={field.slug}
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort(field.slug)}
                >
                  <div className="flex items-center gap-1">
                    {field.label || field.name}
                    {getSortIcon(field.slug)}
                  </div>
                </TableHead>
              ))}
              {(canEdit || canDelete) && (
                <TableHead className="w-[80px]" />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={visibleFields.length + (allowBatchSelect ? 1 : 0) + ((canEdit || canDelete) ? 1 : 0)}
                  className="h-24 text-center"
                >
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : displayedRecords.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleFields.length + (allowBatchSelect ? 1 : 0) + ((canEdit || canDelete) ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {filters.searchTerm || filters.fieldFilters.length > 0
                    ? t('noResultsFiltered')
                    : t('noRecords')}
                </TableCell>
              </TableRow>
            ) : (
              displayedRecords.map(record => (
                <TableRow
                  key={record.id}
                  className={selectedIds.has(record.id) ? 'bg-muted/50' : undefined}
                >
                  {allowBatchSelect && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(record.id)}
                        onCheckedChange={() => toggleSelect(record.id)}
                      />
                    </TableCell>
                  )}
                  {visibleFields.map(field => (
                    <TableCell
                      key={field.slug}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => {
                        const val = record.data?.[field.slug];
                        if (val !== null && val !== undefined) {
                          handleCellClick(field.slug, String(
                            typeof val === 'object' && 'value' in (val as Record<string, unknown>)
                              ? (val as Record<string, unknown>).value
                              : val,
                          ));
                        }
                      }}
                    >
                      {renderCellValue(record, field)}
                    </TableCell>
                  ))}
                  {(canEdit || canDelete) && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && (
                            <DropdownMenuItem onClick={() => handleEdit(record)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {tCommon('edit')}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(record)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {tCommon('delete')}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer — always visible, never clipped */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t flex-shrink-0">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {enablePagination && totalRecords > 0
            ? `${((safePage - 1) * pageSize) + 1}–${Math.min(safePage * pageSize, totalRecords)} de ${totalRecords.toLocaleString('pt-BR')}${totalRecords < allRecords.length ? ` (${allRecords.length.toLocaleString('pt-BR')} total)` : ''}`
            : totalRecords > 0
              ? totalRecords < allRecords.length
                ? `${totalRecords.toLocaleString('pt-BR')} de ${allRecords.length.toLocaleString('pt-BR')} registros`
                : `${totalRecords.toLocaleString('pt-BR')} registros`
              : '0 registros'}
          {selectedIds.size > 0 && ` · ${selectedIds.size} selecionado(s)`}
        </span>
        {enablePagination && totalPages > 1 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs px-2 min-w-[50px] text-center text-muted-foreground">
              {safePage} / {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      {entityForDialog && (
        <RecordFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          entity={entityForDialog}
          record={editRecord ? { id: editRecord.id, data: editRecord.data } as unknown as null : null}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirm.message')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRecord.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      {entity && (
        <ImportDialog
          entitySlug={entitySlug}
          entityName={entity.name}
          open={importOpen}
          onOpenChange={setImportOpen}
          onSuccess={() => {
            setImportOpen(false);
            refresh();
          }}
        />
      )}
      </div>
    </WidgetWrapper>
  );
}
