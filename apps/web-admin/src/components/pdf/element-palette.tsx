'use client';

import { useDraggable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import {
  Type,
  Image,
  Square,
  Minus,
  Table,
  QrCode,
  Barcode,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const elementTypes = [
  { type: 'text', icon: Type },
  { type: 'image', icon: Image },
  { type: 'rectangle', icon: Square },
  { type: 'line', icon: Minus },
  { type: 'table', icon: Table },
  { type: 'qrcode', icon: QrCode },
  { type: 'barcode', icon: Barcode },
] as const;

interface DraggableElementProps {
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

function DraggableElement({ type, icon: Icon, label }: DraggableElementProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: {
      type,
      fromPalette: true,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-border bg-card cursor-grab transition-all',
        'hover:border-primary hover:bg-primary/5',
        isDragging && 'opacity-50 cursor-grabbing ring-2 ring-primary'
      )}
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

interface ElementPaletteProps {
  className?: string;
}

export function ElementPalette({ className }: ElementPaletteProps) {
  const t = useTranslations('pdfTemplates.editor.elements');

  return (
    <div className={cn('p-4', className)}>
      <h3 className="text-sm font-medium mb-3">
        {useTranslations('pdfTemplates.editor')('elementPalette')}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {elementTypes.map(({ type, icon }) => (
          <DraggableElement
            key={type}
            type={type}
            icon={icon}
            label={t(type)}
          />
        ))}
      </div>
    </div>
  );
}
