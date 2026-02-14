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
  MessageSquare,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useTenant } from '@/stores/tenant-context';
import { RecordFormDialog } from './record-form-dialog';
import type { EntityField } from '@/types';

interface SubEntityFieldProps {
  parentRecordId: string;
  subEntitySlug: string;
  subEntityId: string;
  subEntityDisplayFields?: string[];
  label?: string;
  readOnly?: boolean;
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

export default function SubEntityField({
  parentRecordId,
  subEntitySlug,
  subEntityId,
  subEntityDisplayFields,
  label,
  readOnly = false,
}: SubEntityFieldProps) {
  const t = useTranslations('subEntity');
  const tCommon = useTranslations('common');
  const tBool = useTranslations('booleanValues');
  const { tenantId } = useTenant();
  const [subEntity, setSubEntity] = useState<SubEntity | null>(null);
  const [records, setRecords] = useState<SubRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  // Form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SubRecord | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<SubRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load sub-entity definition
  const loadSubEntity = useCallback(async () => {
    try {
      const response = await api.get(`/entities/${subEntityId}`);
      setSubEntity(response.data);
    } catch (error) {
      console.error('Error loading sub-entity:', error);
      toast.error(t('loadError'));
    }
  }, [subEntityId, t]);

  // Load sub-records
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

  // Columns to display
  const displayFields = subEntityDisplayFields && subEntityDisplayFields.length > 0
    ? subEntityDisplayFields
    : (subEntity?.fields || []).slice(0, 4).map(f => f.slug || f.name);

  const getFieldLabel = (slug: string) => {
    const field = subEntity?.fields?.find(f => (f.slug || f.name) === slug);
    return field?.label || field?.name || slug;
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

  // Custom create that passes parentRecordId
  const handleFormSubmitCreate = async (entitySlug: string, data: Record<string, unknown>) => {
    const response = await api.post(`/data/${entitySlug}`, {
      data,
      parentRecordId,
    });
    return response.data;
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
    <div className="space-y-2">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
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
              {records.length}
            </Badge>
          </div>
        </div>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleCreate();
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            {t('new')}
          </Button>
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div className="border rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                {t('noRecords', { name: subEntity?.name || t('subRecords') })}
              </p>
              {!readOnly && (
                <Button type="button" size="sm" variant="outline" onClick={handleCreate}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t('addRecord', { name: subEntity?.name || '' })}
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Table for desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      {displayFields.map(field => (
                        <th key={field} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          {getFieldLabel(field)}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        {t('created')}
                      </th>
                      {!readOnly && (
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-20">
                          {tCommon('actions')}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {records.map(record => (
                      <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                        {displayFields.map(field => (
                          <td key={field} className="px-3 py-2 text-sm max-w-[200px] truncate">
                            {formatCellValue(record.data[field], tBool('yes'), tBool('no'))}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(record.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        {!readOnly && (
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEdit(record)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleDeleteClick(record)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards for mobile */}
              <div className="sm:hidden divide-y">
                {records.map(record => (
                  <div key={record.id} className="p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        {displayFields.map((field, idx) => (
                          <div key={field} className={idx === 0 ? 'font-medium text-sm' : 'text-xs text-muted-foreground'}>
                            {idx > 0 && <span className="text-muted-foreground/60">{getFieldLabel(field)}: </span>}
                            {formatCellValue(record.data[field], tBool('yes'), tBool('no'))}
                          </div>
                        ))}
                        <div className="text-xs text-muted-foreground">
                          {new Date(record.createdAt).toLocaleDateString('pt-BR')}
                          {record.createdBy && ` · ${record.createdBy.name}`}
                        </div>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(record)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteClick(record)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
