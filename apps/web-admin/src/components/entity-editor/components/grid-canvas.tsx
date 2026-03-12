'use client';

import { useCallback, useMemo, useRef } from 'react';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useEditorStore, fieldsToLayout } from '../store/editor-store';
import { FieldPreview } from './field-preview';

// Exact fit: label(12px) + gap(2px) + input(28px) = 42px + 2px breathing = 44
const ROW_HEIGHT = 44;
const MARGIN_X = 10;
const MARGIN_Y = 8;

// Resize handle styles
const gridStyles = `
.react-grid-item > .react-resizable-handle {
  z-index: 10;
}
.react-grid-item > .react-resizable-handle::after {
  border-right-color: hsl(var(--muted-foreground) / 0.4) !important;
  border-bottom-color: hsl(var(--muted-foreground) / 0.4) !important;
}
.react-grid-item:hover > .react-resizable-handle::after {
  border-right-color: hsl(var(--primary)) !important;
  border-bottom-color: hsl(var(--primary)) !important;
}
`;

interface GridCanvasProps {
  onFieldClick: (slug: string) => void;
}

export function GridCanvas({ onFieldClick }: GridCanvasProps) {
  const fields = useEditorStore(s => s.fields);
  const selectedFieldId = useEditorStore(s => s.selectedFieldId);
  const updateLayout = useEditorStore(s => s.updateLayout);
  const pendingField = useEditorStore(s => s.pendingField);
  const addField = useEditorStore(s => s.addField);
  const setPendingField = useEditorStore(s => s.setPendingField);

  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: widthRef, width } = useContainerWidth();

  const layout = useMemo(() => fieldsToLayout(fields), [fields]);

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      updateLayout(newLayout);
    },
    [updateLayout],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!pendingField) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clickY = e.clientY - rect.top + container.scrollTop;
      const targetRow = Math.floor(clickY / (ROW_HEIGHT + MARGIN_Y));
      addField(pendingField.type, pendingField.label, targetRow);
      setPendingField(null);
    },
    [pendingField, addField, setPendingField],
  );

  const handleFieldClick = useCallback(
    (slug: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (pendingField) return;
      onFieldClick(slug);
    },
    [onFieldClick, pendingField],
  );

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (pendingField) {
        handleCanvasClick(e);
        return;
      }
      if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.react-grid-layout')) {
        const isGridItem = (e.target as HTMLElement).closest('.react-grid-item');
        if (!isGridItem) {
          onFieldClick('');
        }
      }
    },
    [onFieldClick, pendingField, handleCanvasClick],
  );

  // Subtract padding (p-4 = 16px each side = 32px)
  const gridWidth = width ? width - 32 : 540;

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-auto bg-muted/30 p-4 ${pendingField ? 'cursor-crosshair' : ''}`}
      onClick={handleBackgroundClick}
    >
      <style dangerouslySetInnerHTML={{ __html: gridStyles }} />
      <div
        ref={widthRef}
        className="mx-auto max-w-xl rounded-lg bg-background border border-border shadow-sm p-4"
      >
        {fields.length === 0 && !pendingField ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground gap-3">
            <span className="text-4xl">📝</span>
            <p className="text-sm">Nenhum campo adicionado</p>
            <p className="text-xs text-muted-foreground/70">
              Use o botao &quot;Adicionar Campo&quot; para comecar
            </p>
          </div>
        ) : (
          <GridLayout
            layout={layout}
            cols={12}
            rowHeight={ROW_HEIGHT}
            width={gridWidth}
            margin={[MARGIN_X, MARGIN_Y]}
            containerPadding={[0, 0]}
            compactType="vertical"
            isDraggable={!pendingField}
            isResizable={!pendingField}
            resizeHandles={['e', 'se']}
            draggableHandle=".field-drag-handle"
            onLayoutChange={handleLayoutChange}
            useCSSTransforms
          >
            {fields.map(field => (
              <div
                key={field.slug}
                className="group/item"
              >
                <FieldPreview
                  field={field}
                  isSelected={selectedFieldId === field.slug}
                  onClick={() => handleFieldClick(field.slug, { stopPropagation: () => {} } as React.MouseEvent)}
                />
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </div>
  );
}
