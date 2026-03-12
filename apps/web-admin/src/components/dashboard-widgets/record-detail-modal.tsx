'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useEntityDataItem } from '@/hooks/use-data';
import { Loader2 } from 'lucide-react';

interface RecordDetailModalProps {
  entitySlug: string;
  recordId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FILE_FIELD_TYPES = new Set(['file', 'image', 'photo', 'attachment', 'video']);
const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|svg|bmp)$/i;

function isImageUrl(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return IMAGE_EXTS.test(val) || val.includes('/uploads/') && IMAGE_EXTS.test(val);
}

export function RecordDetailModal({ entitySlug, recordId, open, onOpenChange }: RecordDetailModalProps) {
  const { data: record, isLoading } = useEntityDataItem(entitySlug, recordId);

  const fields = record?.entity?.fields || [];
  const data = (record?.data || {}) as Record<string, unknown>;

  // Categorize fields
  const { regularFields, imageFields } = useMemo(() => {
    const regular: typeof fields = [];
    const images: typeof fields = [];

    for (const field of fields) {
      if (FILE_FIELD_TYPES.has(field.type)) {
        images.push(field);
      } else {
        regular.push(field);
      }
    }
    return { regularFields: regular, imageFields: images };
  }, [fields]);

  // Collect all image URLs
  const imageUrls = useMemo(() => {
    const urls: string[] = [];
    for (const field of imageFields) {
      const val = data[field.slug];
      if (Array.isArray(val)) {
        for (const v of val) {
          const url = typeof v === 'string' ? v : typeof v === 'object' && v && 'url' in v ? (v as { url: string }).url : null;
          if (url && isImageUrl(url)) urls.push(url);
        }
      } else if (typeof val === 'string' && isImageUrl(val)) {
        urls.push(val);
      }
    }
    return urls;
  }, [data, imageFields]);

  // Get a title from the record — first text field or ID
  const recordTitle = useMemo(() => {
    for (const field of fields) {
      if (field.type === 'text' || field.slug === 'nome' || field.slug === 'name' || field.slug === 'titulo' || field.slug === 'chassi') {
        const val = data[field.slug];
        if (val && typeof val === 'string') return val;
        if (val && typeof val === 'object' && 'label' in (val as Record<string, unknown>)) {
          return String((val as { label: string }).label);
        }
      }
    }
    return recordId.slice(0, 8);
  }, [data, fields, recordId]);

  const formatValue = (value: unknown, fieldType: string): string => {
    if (value == null) return '-';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
    if (typeof value === 'number') return value.toLocaleString('pt-BR');
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value
          .map((v) => (typeof v === 'object' && v && 'label' in v ? (v as { label: string }).label : String(v)))
          .join(', ');
      }
      if ('label' in (value as Record<string, unknown>)) return String((value as { label: string }).label);
      if ('value' in (value as Record<string, unknown>)) return String((value as { value: string }).value);
      return JSON.stringify(value);
    }
    if (fieldType === 'date' || fieldType === 'datetime') {
      try {
        return new Date(String(value)).toLocaleDateString('pt-BR');
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Ficha: {recordTitle}</span>
            <Badge variant="outline" className="text-xs font-normal">
              {entitySlug}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Field grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {regularFields.map((field) => {
                const val = data[field.slug];
                if (val == null || val === '') return null;
                return (
                  <div key={field.slug}>
                    <dt className="text-xs text-muted-foreground font-medium mb-0.5">
                      {field.label || field.name}
                    </dt>
                    <dd className="text-sm break-words">
                      {formatValue(val, field.type)}
                    </dd>
                  </div>
                );
              })}
            </div>

            {/* Image gallery */}
            {imageUrls.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Fotos</h4>
                <div className="grid grid-cols-3 gap-2">
                  {imageUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-primary transition-all"
                    >
                      <img
                        src={url}
                        alt={`Foto ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="border-t pt-3 flex items-center gap-4 text-xs text-muted-foreground">
              {record?.createdAt && (
                <span>Criado: {new Date(record.createdAt).toLocaleDateString('pt-BR')}</span>
              )}
              {record?.updatedAt && (
                <span>Atualizado: {new Date(record.updatedAt).toLocaleDateString('pt-BR')}</span>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
