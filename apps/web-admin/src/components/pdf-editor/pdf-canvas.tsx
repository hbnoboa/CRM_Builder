'use client';

import { useCallback } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type {
  PdfElement,
  PdfHeader,
  PdfFooter,
  PdfTemplateContent,
} from '@/services/pdf-templates.service';
import {
  ElementRenderer,
  HeaderRenderer,
  FooterRenderer,
  getElementIcon,
  getElementLabel,
} from './element-renderers';

// ─── Types ───────────────────────────────────────────────

export type SelectedZone =
  | { type: 'header' }
  | { type: 'footer' }
  | { type: 'element'; id: string }
  | null;

interface PdfCanvasProps {
  content: PdfTemplateContent;
  selected: SelectedZone;
  onSelect: (zone: SelectedZone) => void;
  onChange: (content: PdfTemplateContent) => void;
  pageSize: 'A4' | 'LETTER' | 'LEGAL';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
}

// ─── Sortable Element Wrapper ────────────────────────────

function SortableElement({
  element,
  isSelected,
  onSelect,
  onDelete,
}: {
  element: PdfElement;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const Icon = getElementIcon(element.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-md border-2 transition-colors cursor-pointer',
        isDragging && 'opacity-50 shadow-lg',
        isSelected
          ? 'border-blue-500 bg-blue-50/50'
          : 'border-transparent hover:border-gray-400/30',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Drag handle + type badge */}
      <div
        className={cn(
          'absolute -left-7 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
          isSelected && 'opacity-100',
        )}
      >
        <button
          className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-gray-100"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Element type label (top-right) */}
      <div
        className={cn(
          'absolute -top-2.5 right-2 flex items-center gap-1 px-1.5 py-0 rounded-sm text-[9px] font-medium bg-white border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity',
          isSelected && 'opacity-100',
        )}
      >
        <Icon className="h-3 w-3" />
        {getElementLabel(element.type)}
      </div>

      {/* Delete button (top-right corner) */}
      <div
        className={cn(
          'absolute -top-2.5 -right-2.5 opacity-0 group-hover:opacity-100 transition-opacity',
          isSelected && 'opacity-100',
        )}
      >
        <Button
          variant="destructive"
          size="icon"
          className="h-5 w-5 rounded-full shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Content preview */}
      <div className="p-2">
        <ElementRenderer element={element} />
      </div>
    </div>
  );
}

// ─── Canvas Component ────────────────────────────────────

export function PdfCanvas({
  content,
  selected,
  onSelect,
  onChange,
  pageSize,
  orientation,
}: PdfCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const elements = content.body || [];

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = elements.findIndex((el) => el.id === active.id);
      const newIndex = elements.findIndex((el) => el.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onChange({
          ...content,
          body: arrayMove(elements, oldIndex, newIndex),
        });
      }
    },
    [content, elements, onChange],
  );

  const handleDeleteElement = useCallback(
    (id: string) => {
      onChange({
        ...content,
        body: elements.filter((el) => el.id !== id),
      });
      if (selected?.type === 'element' && selected.id === id) {
        onSelect(null);
      }
    },
    [content, elements, onChange, selected, onSelect],
  );

  // Proportional page dimensions for the canvas preview
  const isLandscape = orientation === 'LANDSCAPE';
  const maxWidth = 640;

  return (
    <div
      className="flex justify-center py-8 px-4"
      onClick={() => onSelect(null)}
    >
      <div
        className="bg-white text-gray-900 rounded-sm shadow-lg border relative"
        style={{
          width: maxWidth,
          minHeight: isLandscape ? 480 : 680,
        }}
      >
        {/* Page size indicator */}
        <div className="absolute -top-6 left-0 text-[10px] text-gray-400">
          {pageSize} {isLandscape ? 'Paisagem' : 'Retrato'}
        </div>

        <div className="flex flex-col h-full" style={{ padding: '24px 32px' }}>
          {/* ─── Header Zone ──────────────────────── */}
          <div
            className={cn(
              'rounded-md border-2 border-dashed p-3 mb-4 cursor-pointer transition-colors',
              selected?.type === 'header'
                ? 'border-blue-500 bg-blue-50/30'
                : 'border-gray-300/30 hover:border-gray-400/40',
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'header' });
            }}
          >
            <HeaderRenderer header={content.header} />
          </div>

          {/* ─── Body Zone (drag-drop elements) ─── */}
          <div className="flex-1 min-h-[200px] pl-8">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={elements.map((el) => el.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {elements.map((element) => (
                    <SortableElement
                      key={element.id}
                      element={element}
                      isSelected={
                        selected?.type === 'element' &&
                        selected.id === element.id
                      }
                      onSelect={() =>
                        onSelect({ type: 'element', id: element.id })
                      }
                      onDelete={() => handleDeleteElement(element.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {elements.length === 0 && (
              <div className="flex items-center justify-center h-40 text-sm text-gray-400 border-2 border-dashed border-gray-300/20 rounded-md">
                Clique em &quot;+&quot; para adicionar elementos
              </div>
            )}
          </div>

          {/* ─── Footer Zone ──────────────────────── */}
          <div
            className={cn(
              'rounded-md border-2 border-dashed p-3 mt-4 cursor-pointer transition-colors',
              selected?.type === 'footer'
                ? 'border-blue-500 bg-blue-50/30'
                : 'border-gray-300/30 hover:border-gray-400/40',
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: 'footer' });
            }}
          >
            <FooterRenderer footer={content.footer} />
          </div>
        </div>
      </div>
    </div>
  );
}
