'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Line, Transformer, Group } from 'react-konva';
import { useDroppable } from '@dnd-kit/core';
import { usePdfEditorStore, snapToGrid, generateElementId, defaultElements } from '@/stores/pdf-editor-store';
import type { PdfElement } from '@/types';
import type Konva from 'konva';

interface PdfCanvasProps {
  onDrop?: (x: number, y: number, data: { type: string; fieldSlug?: string; fieldLabel?: string }) => void;
}

export function PdfCanvas({ onDrop }: PdfCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const {
    elements,
    selectedId,
    zoom,
    showGrid,
    snapToGrid: snapEnabled,
    gridSize,
    pageWidth,
    pageHeight,
    setSelectedId,
    updateElement,
  } = usePdfEditorStore();

  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas',
  });

  // Update transformer when selection changes
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;

    const stage = stageRef.current;
    const transformer = transformerRef.current;

    if (selectedId) {
      const selectedNode = stage.findOne(`#${selectedId}`);
      if (selectedNode) {
        transformer.nodes([selectedNode]);
        transformer.getLayer()?.batchDraw();
        return;
      }
    }

    transformer.nodes([]);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, elements]);

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Click on empty area - deselect
    if (e.target === e.currentTarget) {
      setSelectedId(null);
    }
  }, [setSelectedId]);

  const handleElementClick = useCallback((elementId: string) => {
    setSelectedId(elementId);
  }, [setSelectedId]);

  const handleDragEnd = useCallback((elementId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    updateElement(elementId, {
      position: {
        x: snapToGrid(node.x(), gridSize, snapEnabled),
        y: snapToGrid(node.y(), gridSize, snapEnabled),
      },
    });
  }, [updateElement, gridSize, snapEnabled]);

  const handleTransformEnd = useCallback((elementId: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and apply to width/height
    node.scaleX(1);
    node.scaleY(1);

    updateElement(elementId, {
      position: {
        x: snapToGrid(node.x(), gridSize, snapEnabled),
        y: snapToGrid(node.y(), gridSize, snapEnabled),
      },
      width: Math.max(20, snapToGrid(node.width() * scaleX, gridSize, snapEnabled)),
      height: Math.max(20, snapToGrid(node.height() * scaleY, gridSize, snapEnabled)),
    });
  }, [updateElement, gridSize, snapEnabled]);

  const renderElement = (element: PdfElement) => {
    const isSelected = selectedId === element.name;
    const commonProps = {
      id: element.name,
      x: element.position.x,
      y: element.position.y,
      width: element.width,
      height: element.height,
      draggable: true,
      onClick: () => handleElementClick(element.name),
      onTap: () => handleElementClick(element.name),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(element.name, e),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(element.name, e),
    };

    switch (element.type) {
      case 'text':
        return (
          <Group key={element.name} {...commonProps}>
            <Rect
              width={element.width}
              height={element.height}
              fill="transparent"
              stroke={isSelected ? '#3b82f6' : 'transparent'}
              strokeWidth={1}
              dash={[4, 4]}
            />
            <Text
              text={element.fieldSlug ? `{{${element.fieldSlug}}}` : element.staticValue || 'Texto'}
              width={element.width}
              height={element.height}
              fontSize={element.fontSize || 12}
              fill={element.fontColor || '#000000'}
              fontStyle={element.fontWeight === 'bold' ? 'bold' : 'normal'}
              align={element.alignment || 'left'}
              verticalAlign="middle"
              listening={false}
            />
          </Group>
        );

      case 'image':
        return (
          <Rect
            key={element.name}
            {...commonProps}
            fill="#f3f4f6"
            stroke={isSelected ? '#3b82f6' : '#d1d5db'}
            strokeWidth={isSelected ? 2 : 1}
            cornerRadius={4}
          />
        );

      case 'rectangle':
        return (
          <Rect
            key={element.name}
            {...commonProps}
            fill={element.backgroundColor || 'transparent'}
            stroke={element.borderColor || '#000000'}
            strokeWidth={element.borderWidth || 1}
          />
        );

      case 'line':
        return (
          <Line
            key={element.name}
            id={element.name}
            x={element.position.x}
            y={element.position.y}
            points={[0, 0, element.width, 0]}
            stroke={element.borderColor || '#000000'}
            strokeWidth={element.borderWidth || 1}
            draggable
            onClick={() => handleElementClick(element.name)}
            onTap={() => handleElementClick(element.name)}
            onDragEnd={(e) => handleDragEnd(element.name, e)}
          />
        );

      case 'table':
        return (
          <Group key={element.name} {...commonProps}>
            <Rect
              width={element.width}
              height={element.height}
              fill="#ffffff"
              stroke={isSelected ? '#3b82f6' : '#000000'}
              strokeWidth={isSelected ? 2 : 1}
            />
            {/* Table header */}
            <Rect
              width={element.width}
              height={24}
              fill="#f3f4f6"
              stroke="#000000"
              strokeWidth={1}
            />
            <Text
              text="Tabela"
              width={element.width}
              height={24}
              fontSize={10}
              fill="#666666"
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          </Group>
        );

      case 'qrcode':
        return (
          <Group key={element.name} {...commonProps}>
            <Rect
              width={element.width}
              height={element.height}
              fill="#ffffff"
              stroke={isSelected ? '#3b82f6' : '#000000'}
              strokeWidth={isSelected ? 2 : 1}
            />
            <Text
              text="QR"
              width={element.width}
              height={element.height}
              fontSize={14}
              fill="#666666"
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          </Group>
        );

      case 'barcode':
        return (
          <Group key={element.name} {...commonProps}>
            <Rect
              width={element.width}
              height={element.height}
              fill="#ffffff"
              stroke={isSelected ? '#3b82f6' : '#000000'}
              strokeWidth={isSelected ? 2 : 1}
            />
            {/* Simple barcode visualization */}
            {Array.from({ length: 15 }).map((_, i) => (
              <Rect
                key={i}
                x={5 + i * 9}
                y={5}
                width={i % 3 === 0 ? 4 : 2}
                height={element.height - 10}
                fill="#000000"
                listening={false}
              />
            ))}
          </Group>
        );

      default:
        return null;
    }
  };

  // Generate grid lines
  const gridLines = [];
  if (showGrid) {
    // Vertical lines
    for (let i = 0; i <= pageWidth; i += gridSize) {
      gridLines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, pageHeight]}
          stroke="#e5e7eb"
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    // Horizontal lines
    for (let i = 0; i <= pageHeight; i += gridSize) {
      gridLines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, pageWidth, i]}
          stroke="#e5e7eb"
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
  }

  return (
    <div
      ref={setNodeRef}
      className="flex-1 overflow-auto bg-muted/50 p-8"
      style={{ minHeight: 400 }}
    >
      <div
        className="mx-auto shadow-lg"
        style={{
          width: pageWidth * zoom,
          height: pageHeight * zoom,
          backgroundColor: isOver ? '#f0f9ff' : '#ffffff',
          transition: 'background-color 0.2s',
        }}
      >
        <Stage
          ref={stageRef}
          width={pageWidth * zoom}
          height={pageHeight * zoom}
          scaleX={zoom}
          scaleY={zoom}
          onClick={handleStageClick}
          onTap={handleStageClick}
        >
          <Layer>
            {/* Page background */}
            <Rect
              x={0}
              y={0}
              width={pageWidth}
              height={pageHeight}
              fill="#ffffff"
              listening={false}
            />

            {/* Grid */}
            {gridLines}

            {/* Elements */}
            {elements.map(renderElement)}

            {/* Transformer for selected element */}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                // Minimum size
                if (newBox.width < 20 || newBox.height < 20) {
                  return oldBox;
                }
                return newBox;
              }}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
              rotateEnabled={false}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
