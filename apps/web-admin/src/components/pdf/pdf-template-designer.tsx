'use client';

import { useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { usePdfEditorStore, generateElementId, defaultElements } from '@/stores/pdf-editor-store';
import { ElementPalette } from './element-palette';
import { FieldMapper } from './field-mapper';
import { PropertiesPanel } from './properties-panel';
import { EditorToolbar } from './editor-toolbar';
import type { PdfTemplate, PdfElement, Entity } from '@/types';

const PdfCanvas = dynamic(() => import('./pdf-canvas').then((mod) => mod.PdfCanvas), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center bg-muted/30">Carregando canvas...</div>,
});

interface PdfTemplateDesignerProps {
  template: PdfTemplate;
  entity: Entity | null;
  onSave: (elements: PdfElement[]) => Promise<void>;
  onPreview: () => void;
  isSaving?: boolean;
}

export function PdfTemplateDesigner({
  template,
  entity,
  onSave,
  onPreview,
  isSaving = false,
}: PdfTemplateDesignerProps) {
  const {
    elements,
    selectedId,
    setElements,
    addElement,
  } = usePdfEditorStore();

  const selectedElement = elements.find((el) => el.name === selectedId) || null;

  // Initialize elements from template
  useEffect(() => {
    if (template.schemas && Array.isArray(template.schemas) && template.schemas.length > 0) {
      // schemas[0] contains the elements for page 1
      const pageElements = template.schemas[0] as PdfElement[];
      if (Array.isArray(pageElements)) {
        setElements(pageElements);
      }
    } else {
      setElements([]);
    }
  }, [template.id, setElements]);

  // Configure sensors for drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    // Only handle drops on the canvas
    if (!over || over.id !== 'canvas') return;

    const data = active.data.current as {
      type: string;
      fieldSlug?: string;
      fieldLabel?: string;
      fromPalette?: boolean;
      fromField?: boolean;
    };

    if (!data) return;

    // Get drop position relative to canvas
    // For now, use a default position (can be improved with actual drop coordinates)
    const dropX = 100;
    const dropY = 100 + elements.length * 30;

    // Create new element
    const defaults = defaultElements[data.type] || defaultElements.text;
    const newElement: PdfElement = {
      name: generateElementId(data.type),
      type: data.type as PdfElement['type'],
      position: { x: dropX, y: dropY },
      width: defaults.width || 100,
      height: defaults.height || 24,
      ...(data.fieldSlug && { fieldSlug: data.fieldSlug }),
      ...(defaults.fontSize && { fontSize: defaults.fontSize }),
      ...(defaults.fontColor && { fontColor: defaults.fontColor }),
      ...(defaults.fontWeight && { fontWeight: defaults.fontWeight }),
      ...(defaults.alignment && { alignment: defaults.alignment }),
      ...(defaults.backgroundColor && { backgroundColor: defaults.backgroundColor }),
      ...(defaults.borderColor && { borderColor: defaults.borderColor }),
      ...(defaults.borderWidth && { borderWidth: defaults.borderWidth }),
    };

    addElement(newElement);
  }, [elements.length, addElement]);

  const handleSave = useCallback(async () => {
    await onSave(elements);
  }, [elements, onSave]);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        {/* Toolbar */}
        <EditorToolbar
          templateName={template.name}
          onSave={handleSave}
          onPreview={onPreview}
          isSaving={isSaving}
        />

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Element palette */}
          <div className="w-48 border-r bg-card flex-shrink-0 overflow-auto">
            <ElementPalette />
          </div>

          {/* Center - Canvas */}
          <PdfCanvas />

          {/* Right sidebar - Fields + Properties */}
          <div className="w-72 border-l bg-card flex-shrink-0 flex flex-col overflow-hidden">
            {/* Field mapper (top half) */}
            <div className="flex-1 border-b overflow-hidden">
              <FieldMapper entity={entity} />
            </div>

            {/* Properties panel (bottom half) */}
            <div className="flex-1 overflow-hidden">
              <PropertiesPanel
                element={selectedElement}
                entityFields={entity?.fields || []}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {/* Visual feedback during drag */}
      </DragOverlay>
    </DndContext>
  );
}
