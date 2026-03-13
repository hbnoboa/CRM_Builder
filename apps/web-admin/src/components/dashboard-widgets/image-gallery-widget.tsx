'use client';

import { useMemo, useState } from 'react';
import { useAdaptedTopRecords as useEntityTopRecords } from '@/components/entity-data/adapter-hooks';
import { useWidgetFilters } from './dashboard-filter-context';
import { WidgetWrapper } from './widget-wrapper';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { WidgetConfig } from '@crm-builder/shared';
import type { DashboardFilterParams } from '@/hooks/use-dashboard-templates';

interface ImageGalleryWidgetProps {
  entitySlug: string;
  config: WidgetConfig['config'];
  title?: string;
  isEditMode?: boolean;
}

/** Extract image URLs from a field value (string, array, or object). */
function extractUrls(fieldValue: unknown): string[] {
  if (!fieldValue) return [];
  const urls: string[] = [];

  if (typeof fieldValue === 'string') {
    urls.push(fieldValue);
  } else if (Array.isArray(fieldValue)) {
    for (const item of fieldValue) {
      if (typeof item === 'string') urls.push(item);
      else if (typeof item === 'object' && item) {
        const obj = item as Record<string, unknown>;
        const url = obj.url || obj.path || obj.src;
        if (typeof url === 'string') urls.push(url);
      }
    }
  } else if (typeof fieldValue === 'object') {
    const obj = fieldValue as Record<string, unknown>;
    const url = obj.url || obj.path || obj.src;
    if (typeof url === 'string') urls.push(url);
  }

  return urls;
}

/** Build child-entity filters from parent widget filters.
 *  Converts direct field filters to parent.* prefix so the backend
 *  resolves them via parentRecordId.
 */
function buildChildFilters(parentFilters: DashboardFilterParams): DashboardFilterParams {
  if (!parentFilters.filters) return { dateStart: parentFilters.dateStart, dateEnd: parentFilters.dateEnd };

  try {
    const parsed: Array<{ fieldSlug: string; operator: string; value: unknown }> = JSON.parse(parentFilters.filters);
    const childFilterItems = parsed.map((f) => {
      if (f.fieldSlug.startsWith('parent.') || f.fieldSlug.startsWith('child.')) {
        // child.* filters become direct filters for the child entity
        if (f.fieldSlug.startsWith('child.')) {
          const parts = f.fieldSlug.split('.');
          return { ...f, fieldSlug: parts.slice(2).join('.') };
        }
        return f;
      }
      // Direct parent field → parent.* for child entity
      return { ...f, fieldSlug: `parent.${f.fieldSlug}` };
    });
    return {
      filters: JSON.stringify(childFilterItems),
      dateStart: parentFilters.dateStart,
      dateEnd: parentFilters.dateEnd,
    };
  } catch {
    return { dateStart: parentFilters.dateStart, dateEnd: parentFilters.dateEnd };
  }
}

export function ImageGalleryWidget({ entitySlug, config, title, isEditMode }: ImageGalleryWidgetProps) {
  const allImageFields = useMemo(() => {
    if (config.imageFields && config.imageFields.length > 0) return config.imageFields;
    if (config.imageField) return [config.imageField];
    return [];
  }, [config.imageFields, config.imageField]);

  const childImageFields = config.childImageFields || [];
  const childEntitySlug = config.childEntitySlug;
  const hasChildConfig = !!childEntitySlug && childImageFields.length > 0;

  const galleryColumns = config.galleryColumns || 3;
  const dashFilters = useWidgetFilters();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fetch main entity records
  const { data: mainData, isLoading: mainLoading, error: mainError } = useEntityTopRecords(
    allImageFields.length > 0 ? entitySlug : undefined,
    {
      limit: config.limit || 50,
      sortBy: config.sortBy || 'createdAt',
      sortOrder: config.sortOrder || 'desc',
      ...dashFilters,
    },
  );

  // Build child filters from parent's dashboard filters
  const childDashFilters = useMemo(() => buildChildFilters(dashFilters), [dashFilters]);

  // Fetch child entity records (e.g., NCs photos)
  const { data: childData, isLoading: childLoading, error: childError } = useEntityTopRecords(
    hasChildConfig ? childEntitySlug : undefined,
    {
      limit: config.limit || 50,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ...childDashFilters,
    },
  );

  const isLoading = mainLoading || childLoading;
  const error = mainError || childError;

  // Collect all images: main entity + child entity
  const images = useMemo(() => {
    const result: { url: string; source: string }[] = [];

    // Main entity photos
    if (mainData) {
      for (const record of mainData) {
        for (const field of allImageFields) {
          const urls = extractUrls(record.data[field]);
          for (const url of urls) {
            result.push({ url, source: entitySlug });
          }
        }
      }
    }

    // Child entity photos
    if (childData && hasChildConfig) {
      for (const record of childData) {
        for (const field of childImageFields) {
          const urls = extractUrls(record.data[field]);
          for (const url of urls) {
            result.push({ url, source: childEntitySlug! });
          }
        }
      }
    }

    return result;
  }, [mainData, childData, allImageFields, childImageFields, entitySlug, childEntitySlug, hasChildConfig]);

  if (allImageFields.length === 0 && !hasChildConfig) {
    return (
      <WidgetWrapper title={title} isEditMode={isEditMode}>
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
          Clique em ⚙ e selecione o campo de imagem
        </div>
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper
      title={title}
      isEditMode={isEditMode}
      isLoading={isLoading}
      error={error ? 'Erro ao carregar dados' : null}
    >
      <div className="overflow-auto h-full p-1">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${galleryColumns}, 1fr)` }}
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              className="relative aspect-square rounded-md overflow-hidden border bg-muted/30 hover:ring-2 hover:ring-primary/50 transition-all"
              onClick={() => !isEditMode && setSelectedImage(img.url)}
              type="button"
            >
              <img
                src={img.url}
                alt={`Imagem ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
          {images.length === 0 && (
            <div className={`text-center py-4 text-xs text-muted-foreground`} style={{ gridColumn: `1 / -1` }}>
              Sem imagens
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          {selectedImage && (
            <img src={selectedImage} alt="Imagem ampliada" className="w-full h-auto rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </WidgetWrapper>
  );
}
