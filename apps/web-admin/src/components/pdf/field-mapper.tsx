'use client';

import { useDraggable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import {
  Type,
  Hash,
  Calendar,
  Mail,
  Phone,
  Link,
  Image,
  ToggleLeft,
  List,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Entity, EntityField } from '@/types';

// Map field types to icons
const fieldTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type,
  textarea: Type,
  richtext: Type,
  number: Hash,
  currency: Hash,
  percentage: Hash,
  date: Calendar,
  datetime: Calendar,
  time: Calendar,
  email: Mail,
  phone: Phone,
  url: Link,
  image: Image,
  file: Image,
  boolean: ToggleLeft,
  select: List,
  multiselect: List,
  map: MapPin,
};

interface DraggableFieldProps {
  field: EntityField;
}

function DraggableField({ field }: DraggableFieldProps) {
  const Icon = fieldTypeIcons[field.type] || Type;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-${field.slug}`,
    data: {
      type: field.type === 'image' ? 'image' : 'text',
      fieldSlug: field.slug,
      fieldLabel: field.label,
      fromField: true,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card cursor-grab transition-all text-sm',
        'hover:border-primary hover:bg-primary/5',
        isDragging && 'opacity-50 cursor-grabbing ring-2 ring-primary'
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="truncate">{field.label || field.slug}</span>
      <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
        {field.type}
      </span>
    </div>
  );
}

interface FieldMapperProps {
  entity: Entity | null;
  className?: string;
}

export function FieldMapper({ entity, className }: FieldMapperProps) {
  const t = useTranslations('pdfTemplates.editor');

  if (!entity) {
    return (
      <div className={cn('p-4', className)}>
        <h3 className="text-sm font-medium mb-3">{t('fieldPalette')}</h3>
        <p className="text-sm text-muted-foreground">
          Nenhuma entidade vinculada
        </p>
      </div>
    );
  }

  const fields = entity.fields || [];

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="p-4 border-b">
        <h3 className="text-sm font-medium">{t('fieldPalette')}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {entity.name} ({fields.length} campos)
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum campo definido
            </p>
          ) : (
            fields.map((field) => (
              <DraggableField key={field.slug} field={field} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
