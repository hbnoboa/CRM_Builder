'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Search,
  ArrowUpDown,
  Calendar,
  Clock,
  User,
  Filter,
  LayoutList,
  LayoutGrid,
  Timeline as TimelineIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { RecordFormDialog } from './record-form-dialog';
import { cn } from '@/lib/utils';
import type { EntityField } from '@/types';

interface SubEntityFieldEnhancedProps {
  parentRecordId: string;
  subEntitySlug: string;
  subEntityId: string;
  subEntityDisplayFields?: string[];
  label?: string;
  readOnly?: boolean;
  variant?: 'table' | 'cards' | 'timeline'; // New: display variants
  enableSearch?: boolean;
  enableSort?: boolean;
  enableFilter?: boolean;
}

interface SubEntity {
  id: string;
  name: string;
  slug: string;
  fields: EntityField[];
}

interface SubRecord {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string; email: string };
}

type SortField = 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

function formatCellValue(val: unknown, boolYes: string, boolNo: string): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'object' && val !== null) {
    if ('label' in (val as Record<string, unknown>)) return String((val as Record<string, unknown>).label);
    if ('value' in (val as Record<string, unknown>)) return String((val as Record<string, unknown>).value);
    if (Array.isArray(val)) return val.map(v => formatCellValue(v, boolYes, boolNo)).join(', ');
    return JSON.stringify(val);
  }
  if (typeof val === 'boolean') return val ? boolYes : boolNo;
  return String(val);
}

function getStatusBadgeVariant(status: unknown): 'default' | 'secondary' | 'destructive' | 'outline' {
  const statusStr = String(status).toLowerCase();
  if (statusStr.includes('conclu') || statusStr.includes('complete')) return 'default';
  if (statusStr.includes('pendent') || statusStr.includes('aguard')) return 'secondary';
  if (statusStr.includes('cancel') || statusStr.includes('rejeita')) return 'destructive';
  return 'outline';
}

export default function SubEntityFieldEnhanced({
  parentRecordId,
  subEntitySlug,
  subEntityId,
  subEntityDisplayFields,
  label,
  readOnly = false,
  variant = 'cards',
  enableSearch = true,
  enableSort = true,
  enableFilter = false,
}: SubEntityFieldEnhancedProps) {
  const t = useTranslations('subEntity');
  const tCommon = useTranslations('common');
  const tBool = useTranslations('booleanValues');
  const { tenantId } = useTenant();

  const [subEntity, setSubEntity] = useState<SubEntity | null>(null);
  const [records, setRecords] = useState<SubRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<SubRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  // UI state
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'timeline'>(variant);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SubRecord | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<SubRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSubEntity = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (tenantId) params.tenantId = tenantId;
      const response = await api.get('/entities', { params });
      const allEntities = Array.isArray(response.data) ? response.data : response.data?.data || [];
      const found = allEntities.find((e: SubEntity) => e.slug === subEntitySlug || e.id === subEntityId);
      if (found) {
        setSubEntity(found);
      }
    } catch (error) {
      console.error('Error loading sub-entity:', error);
      toast.error(t('loadError'));
    }
  }, [subEntitySlug, subEntityId, tenantId, t]);

  const loadRecords = useCallback(async () => {
    if (!subEntitySlug || !parentRecordId) return;
    setLoading(true);
    try {
      const response = await api.get(`/data/${subEntitySlug}`, {
        params: { parentRecordId, limit: 100 },
      });
      const list = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setRecords(list);
    } catch (error) {
      console.error('Error loading sub-records:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [subEntitySlug, parentRecordId]);

  useEffect(() => {
    loadSubEntity();
    loadRecords();
  }, [loadSubEntity, loadRecords]);

  // Filter and sort records
  useEffect(() => {
    let filtered = [...records];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(record => {
        const searchableText = displayFields
          .map(field => formatCellValue(record.data[field], tBool('yes'), tBool('no')))
          .join(' ')
          .toLowerCase();
        return searchableText.includes(searchQuery.toLowerCase());
      });
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const modifier = sortOrder === 'asc' ? 1 : -1;
      return aVal < bVal ? -modifier : modifier;
    });

    setFilteredRecords(filtered);
  }, [records, searchQuery, sortField, sortOrder]);

  const displayFields = subEntityDisplayFields && subEntityDisplayFields.length > 0
    ? subEntityDisplayFields
    : (subEntity?.fields || []).slice(0, 4).map(f => f.slug || f.name);

  const getFieldLabel = (slug: string) => {
    const field = subEntity?.fields?.find(f => (f.slug || f.name) === slug);
    return field?.label || field?.name || slug;
  };

  const getFieldType = (slug: string) => {
    const field = subEntity?.fields?.find(f => (f.slug || f.name) === slug);
    return field?.type || 'text';
  };

  const handleCreate = () => {
    setSelectedRecord(null);
    setFormOpen(true);
  };

  const handleEdit = (record: SubRecord) => {
    setSelectedRecord(record);
    setFormOpen(true);
  };

  const handleDeleteClick = (record: SubRecord) => {
    setRecordToDelete(record);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete || !subEntitySlug) return;
    setDeleting(true);
    try {
      await api.delete(`/data/${subEntitySlug}/${recordToDelete.id}`);
      setRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
      toast.success(t('recordRemoved'));
    } catch (error) {
      console.error('Error deleting sub-record:', error);
      toast.error(t('removeError'));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleFormSuccess = () => {
    loadRecords();
  };

  if (!subEntity && !loading) {
    return (
      <div className="border rounded-lg p-4 text-center text-muted-foreground">
        <AlertCircle className="h-5 w-5 mx-auto mb-2" />
        <p className="text-sm">{t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with enhanced controls */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-2 cursor-pointer group flex-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-500" />
            <span className="font-medium text-sm">
              {label || subEntity?.name || t('subRecords')}
            </span>
            <Badge variant="secondary" className="text-xs h-5">
              {filteredRecords.length}
              {searchQuery && ` / ${records.length}`}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          {expanded && (
            <div className="flex items-center border rounded-md">
              <Button
                type="button"
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-r-none"
                onClick={() => setViewMode('table')}
                title="Tabela"
              >
                <LayoutList className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-none border-x"
                onClick={() => setViewMode('cards')}
                title="Cards"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-l-none"
                onClick={() => setViewMode('timeline')}
                title="Timeline"
              >
                <TimelineIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {!readOnly && (
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-7 text-xs"
              onClick={handleCreate}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('new')}
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {expanded && (enableSearch || enableSort) && (
        <div className="flex items-center gap-2">
          {enableSearch && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('search') || 'Buscar...'}
                className="h-7 text-xs pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {enableSort && (
            <Select value={`${sortField}-${sortOrder}`} onValueChange={(val) => {
              const [field, order] = val.split('-') as [SortField, SortOrder];
              setSortField(field);
              setSortOrder(order);
            }}>
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">Mais recentes</SelectItem>
                <SelectItem value="createdAt-asc">Mais antigos</SelectItem>
                <SelectItem value="updatedAt-desc">Atualizados recentes</SelectItem>
                <SelectItem value="updatedAt-asc">Atualizados antigos</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Content */}
      {expanded && (
        <div className="border rounded-lg overflow-hidden bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/20 mb-3" />
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {searchQuery ? 'Nenhum resultado encontrado' : t('noRecords', { name: subEntity?.name || t('subRecords') })}
              </p>
              {searchQuery ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSearchQuery('')}
                  className="mt-2"
                >
                  Limpar busca
                </Button>
              ) : !readOnly && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCreate}
                  className="mt-2"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t('addRecord', { name: subEntity?.name || '' })}
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* TABLE VIEW */}
              {viewMode === 'table' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        {displayFields.map(field => (
                          <th key={field} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                            {getFieldLabel(field)}
                          </th>
                        ))}
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {t('created')}
                          </div>
                        </th>
                        {!readOnly && (
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground w-24">
                            {tCommon('actions')}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredRecords.map(record => (
                        <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                          {displayFields.map(field => {
                            const value = record.data[field];
                            const formatted = (record as Record<string, unknown>)._formatted?.[field] as string ?? formatCellValue(value, tBool('yes'), tBool('no'));
                            const fieldType = getFieldType(field);

                            return (
                              <td key={field} className="px-4 py-3 text-sm">
                                {fieldType === 'select' && formatted !== '-' ? (
                                  <Badge variant={getStatusBadgeVariant(value)} className="text-xs">
                                    {formatted}
                                  </Badge>
                                ) : (
                                  <span className="truncate block max-w-[200px]">{formatted}</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground">
                                {new Date(record.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                              {record.createdBy && (
                                <span className="text-xs text-muted-foreground/60">
                                  {record.createdBy.name}
                                </span>
                              )}
                            </div>
                          </td>
                          {!readOnly && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEdit(record)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteClick(record)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* CARDS VIEW */}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                  {filteredRecords.map(record => (
                    <Card key={record.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {(record as Record<string, unknown>)._formatted?.[displayFields[0]] as string ?? formatCellValue(record.data[displayFields[0]], tBool('yes'), tBool('no'))}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(record.createdAt).toLocaleDateString('pt-BR')}
                              {record.createdBy && (
                                <>
                                  <span>•</span>
                                  <User className="h-3 w-3" />
                                  {record.createdBy.name}
                                </>
                              )}
                            </div>
                          </div>
                          {!readOnly && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(record)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteClick(record)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        {displayFields.slice(1).map(field => {
                          const value = record.data[field];
                          const formatted = (record as Record<string, unknown>)._formatted?.[field] as string ?? formatCellValue(value, tBool('yes'), tBool('no'));
                          const fieldType = getFieldType(field);

                          return (
                            <div key={field} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">
                                {getFieldLabel(field)}:
                              </span>
                              {fieldType === 'select' && formatted !== '-' ? (
                                <Badge variant={getStatusBadgeVariant(value)} className="text-xs">
                                  {formatted}
                                </Badge>
                              ) : (
                                <span className="text-xs font-medium truncate max-w-[60%]">
                                  {formatted}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* TIMELINE VIEW */}
              {viewMode === 'timeline' && (
                <div className="p-4 space-y-0">
                  {filteredRecords.map((record, idx) => {
                    const isLast = idx === filteredRecords.length - 1;
                    const statusField = displayFields.find(f => getFieldType(f) === 'select');
                    const status = statusField ? record.data[statusField] : null;

                    return (
                      <div key={record.id} className="flex gap-4 group">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full border-2 mt-2",
                            status ? "bg-primary border-primary" : "bg-muted border-muted-foreground"
                          )} />
                          {!isLast && (
                            <div className="w-0.5 flex-1 bg-border my-1" />
                          )}
                        </div>

                        {/* Content */}
                        <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                          <Card className="group-hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="flex-1">
                                  <div className="font-medium text-sm mb-1">
                                    {(record as Record<string, unknown>)._formatted?.[displayFields[0]] as string ?? formatCellValue(record.data[displayFields[0]], tBool('yes'), tBool('no'))}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(record.createdAt).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                    {record.createdBy && (
                                      <>
                                        <span>•</span>
                                        <User className="h-3 w-3" />
                                        {record.createdBy.name}
                                      </>
                                    )}
                                  </div>
                                </div>
                                {!readOnly && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleEdit(record)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteClick(record)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                {displayFields.slice(1).map(field => {
                                  const value = record.data[field];
                                  const formatted = (record as Record<string, unknown>)._formatted?.[field] as string ?? formatCellValue(value, tBool('yes'), tBool('no'));
                                  const fieldType = getFieldType(field);

                                  return (
                                    <div key={field} className="flex flex-col gap-0.5">
                                      <span className="text-xs text-muted-foreground">
                                        {getFieldLabel(field)}
                                      </span>
                                      {fieldType === 'select' && formatted !== '-' ? (
                                        <Badge variant={getStatusBadgeVariant(value)} className="text-xs w-fit">
                                          {formatted}
                                        </Badge>
                                      ) : (
                                        <span className="text-sm font-medium truncate">
                                          {formatted}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Record Form Dialog */}
      {subEntity && (
        <RecordFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          entity={{
            id: subEntity.id,
            name: subEntity.name,
            slug: subEntity.slug,
            fields: subEntity.fields || [],
          }}
          record={selectedRecord}
          onSuccess={handleFormSuccess}
          parentRecordId={selectedRecord ? undefined : parentRecordId}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm.message', { name: subEntity?.name || t('subRecords') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
