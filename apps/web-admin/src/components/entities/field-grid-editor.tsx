'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  GripVertical, Maximize2, Trash2, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, ArrowLeftRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Field } from '@/types';

// ─── Constants ─────────────────────────────────────────────────────────────
const GRID_COLS = 12;
const MIN_COL_SPAN = 1;

const fieldTypeIcons: Record<string, string> = {
  text: 'Aa', textarea: '¶', richtext: '📝', password: '🔒',
  number: '#', currency: 'R$', percentage: '%', slider: '🎚', rating: '⭐',
  email: '@', phone: '📞', url: '🔗',
  cpf: '🪪', cnpj: '🏢', cep: '📮',
  date: '📅', datetime: '🕐', time: '⏰',
  boolean: '☑', select: '▼', multiselect: '☰', color: '🎨',
  relation: '🔗', 'api-select': '⚡',
  file: '📎', image: '🖼', json: '{}', hidden: '👁',
  map: '🗺️',
};

const fieldTypeLabels: Record<string, string> = {
  text: 'Texto', textarea: 'Texto Longo', richtext: 'Rich Text', password: 'Senha',
  number: 'Número', currency: 'Moeda', percentage: '%', slider: 'Slider', rating: 'Avaliação',
  email: 'Email', phone: 'Telefone', url: 'URL',
  cpf: 'CPF', cnpj: 'CNPJ', cep: 'CEP',
  date: 'Data', datetime: 'Data/Hora', time: 'Hora',
  boolean: 'Sim/Não', select: 'Seleção', multiselect: 'Multi', color: 'Cor',
  relation: 'Relação', 'api-select': 'API Select',
  file: 'Arquivo', image: 'Imagem', json: 'JSON', hidden: 'Oculto',
  map: 'Mapa',
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface GridCell {
  fieldIndex: number;
  colStart: number; // 0-based column start
  colSpan: number;
}

interface GridRow {
  cells: GridCell[];
}

interface GapSegment {
  colStart: number;
  colSpan: number;
}

interface FieldGridEditorProps {
  fields: Partial<Field>[];
  onFieldsChange: (fields: Partial<Field>[]) => void;
  onFieldSelect?: (index: number) => void;
  selectedFieldIndex?: number | null;
}

type DragState =
  | { type: 'resize-right'; fieldIndex: number; sourceRow: number; startX: number; startColSpan: number }
  | { type: 'resize-left'; fieldIndex: number; sourceRow: number; startX: number; startColStart: number; startColSpan: number }
  | null;

// ─── Helpers ───────────────────────────────────────────────────────────────
function buildGridFromFields(fields: Partial<Field>[]): GridRow[] {
  const rows: GridRow[] = [];
  const fieldsByRow: Record<number, { index: number; field: Partial<Field> }[]> = {};

  fields.forEach((field, index) => {
    const row = field.gridRow || 0;
    if (!fieldsByRow[row]) fieldsByRow[row] = [];
    fieldsByRow[row].push({ index, field });
  });

  const rowKeys = Object.keys(fieldsByRow).map(Number).sort((a, b) => {
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
  });

  for (const rowKey of rowKeys) {
    const fieldsInRow = fieldsByRow[rowKey];
    const cells: GridCell[] = [];
    let nextCol = 0;

    for (const { index, field } of fieldsInRow) {
      const colSpan = field.gridColSpan || 12;
      const colStart = field.gridColStart ? field.gridColStart - 1 : nextCol;

      if (colStart + colSpan > 12) {
        if (cells.length > 0) rows.push({ cells: [...cells] });
        cells.length = 0;
        cells.push({ fieldIndex: index, colStart: 0, colSpan: Math.min(colSpan, 12) });
        nextCol = Math.min(colSpan, 12);
      } else {
        cells.push({ fieldIndex: index, colStart, colSpan });
        nextCol = colStart + colSpan;
      }
    }
    if (cells.length > 0) rows.push({ cells });
  }

  return rows;
}

function snapToGrid(value: number): number {
  return Math.max(MIN_COL_SPAN, Math.min(GRID_COLS, Math.round(value)));
}

function getGaps(row: GridRow): GapSegment[] {
  const gaps: GapSegment[] = [];
  const sorted = [...row.cells].sort((a, b) => a.colStart - b.colStart);
  let pos = 0;
  for (const cell of sorted) {
    if (cell.colStart > pos) {
      gaps.push({ colStart: pos, colSpan: cell.colStart - pos });
    }
    pos = cell.colStart + cell.colSpan;
  }
  if (pos < GRID_COLS) {
    gaps.push({ colStart: pos, colSpan: GRID_COLS - pos });
  }
  return gaps;
}

function recalculateGridRows(fields: Partial<Field>[], grid: GridRow[]): Partial<Field>[] {
  const updated = [...fields];
  grid.forEach((row, rowIdx) => {
    row.cells.forEach((cell) => {
      if (updated[cell.fieldIndex]) {
        updated[cell.fieldIndex] = {
          ...updated[cell.fieldIndex],
          gridRow: rowIdx + 1,
          gridColSpan: cell.colSpan,
          gridColStart: cell.colStart + 1,
        };
      }
    });
  });
  return updated;
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function FieldGridEditor({
  fields,
  onFieldsChange,
  onFieldSelect,
  selectedFieldIndex,
}: FieldGridEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<GridRow[]>([]);
  const [dragState, setDragState] = useState<DragState>(null);
  const [dropTarget, setDropTarget] = useState<{
    rowIndex: number;
    position: 'before' | 'after' | 'new-row';
    cellIndex?: number;
  } | null>(null);

  useEffect(() => {
    setGrid(buildGridFromFields(fields));
  }, [fields]);

  const getColWidth = useCallback(() => {
    if (!containerRef.current) return 60;
    return containerRef.current.clientWidth / GRID_COLS;
  }, []);

  const commitGrid = useCallback((newGrid: GridRow[]) => {
    onFieldsChange(recalculateGridRows(fields, newGrid));
  }, [fields, onFieldsChange]);

  // ── Resize RIGHT ───────────────────────────────────────────────────────
  const handleResizeRightStart = useCallback((
    e: React.MouseEvent,
    fieldIndex: number,
    rowIndex: number,
    colSpan: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({ type: 'resize-right', fieldIndex, sourceRow: rowIndex, startX: e.clientX, startColSpan: colSpan });
  }, []);

  // ── Resize LEFT ────────────────────────────────────────────────────────
  const handleResizeLeftStart = useCallback((
    e: React.MouseEvent,
    fieldIndex: number,
    rowIndex: number,
    colStart: number,
    colSpan: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({ type: 'resize-left', fieldIndex, sourceRow: rowIndex, startX: e.clientX, startColStart: colStart, startColSpan: colSpan });
  }, []);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const colWidth = getColWidth();

      if (dragState.type === 'resize-right') {
        const dx = e.clientX - dragState.startX;
        const colDelta = Math.round(dx / colWidth);
        let newSpan = dragState.startColSpan + colDelta;

        const row = grid[dragState.sourceRow];
        if (row) {
          const cell = row.cells.find(c => c.fieldIndex === dragState.fieldIndex);
          if (cell) {
            const maxSpan = GRID_COLS - cell.colStart;
            const sorted = [...row.cells].sort((a, b) => a.colStart - b.colStart);
            const cellIdx = sorted.findIndex(c => c.fieldIndex === dragState.fieldIndex);

            // Auto-adjust neighbor
            if (cellIdx < sorted.length - 1) {
              const nextCell = sorted[cellIdx + 1];
              const nextEnd = nextCell.colStart + nextCell.colSpan;
              const boundary = nextCell.colStart - cell.colStart;

              if (newSpan > boundary) {
                const overflow = newSpan - boundary;
                const nextNewSpan = nextCell.colSpan - overflow;
                const nextNewStart = cell.colStart + newSpan;
                if (nextNewSpan >= MIN_COL_SPAN && nextNewStart + nextNewSpan <= GRID_COLS) {
                  // Shrink neighbor
                  setGrid(prev => prev.map((r, ri) => ({
                    cells: r.cells.map(c => {
                      if (ri === dragState.sourceRow && c.fieldIndex === dragState.fieldIndex) {
                        return { ...c, colSpan: Math.max(MIN_COL_SPAN, Math.min(newSpan, maxSpan)) };
                      }
                      if (ri === dragState.sourceRow && c.fieldIndex === nextCell.fieldIndex) {
                        return { ...c, colStart: nextNewStart, colSpan: nextNewSpan };
                      }
                      return c;
                    }),
                  })));
                  return;
                } else {
                  // Can't shrink more, limit to max
                  newSpan = nextEnd - cell.colStart - MIN_COL_SPAN;
                }
              }
              newSpan = Math.min(newSpan, maxSpan);
            } else {
              newSpan = Math.min(newSpan, maxSpan);
            }
          }
        }
        newSpan = Math.max(MIN_COL_SPAN, Math.min(GRID_COLS, newSpan));

        setGrid(prev => prev.map((r, ri) => ({
          cells: r.cells.map(c => {
            if (ri === dragState.sourceRow && c.fieldIndex === dragState.fieldIndex) {
              return { ...c, colSpan: newSpan };
            }
            return c;
          }),
        })));
      }

      if (dragState.type === 'resize-left') {
        const dx = e.clientX - dragState.startX;
        const colDelta = Math.round(dx / colWidth);
        let newStart = dragState.startColStart + colDelta;
        const rightEdge = dragState.startColStart + dragState.startColSpan;
        let newSpan = rightEdge - newStart;

        const row = grid[dragState.sourceRow];
        if (row) {
          const sorted = [...row.cells].sort((a, b) => a.colStart - b.colStart);
          const cellIdx = sorted.findIndex(c => c.fieldIndex === dragState.fieldIndex);

          // Auto-adjust previous neighbor
          if (cellIdx > 0) {
            const prevCell = sorted[cellIdx - 1];
            const prevEnd = prevCell.colStart + prevCell.colSpan;

            if (newStart < prevEnd) {
              const overlap = prevEnd - newStart;
              const prevNewSpan = prevCell.colSpan - overlap;
              if (prevNewSpan >= MIN_COL_SPAN) {
                setGrid(prev => prev.map((r, ri) => ({
                  cells: r.cells.map(c => {
                    if (ri === dragState.sourceRow && c.fieldIndex === dragState.fieldIndex) {
                      return { ...c, colStart: newStart, colSpan: rightEdge - newStart };
                    }
                    if (ri === dragState.sourceRow && c.fieldIndex === prevCell.fieldIndex) {
                      return { ...c, colSpan: prevNewSpan };
                    }
                    return c;
                  }),
                })));
                return;
              } else {
                newStart = prevCell.colStart + MIN_COL_SPAN;
                newSpan = rightEdge - newStart;
              }
            }
          }

          newStart = Math.max(0, newStart);
          newSpan = rightEdge - newStart;
        }

        newSpan = Math.max(MIN_COL_SPAN, newSpan);
        newStart = Math.max(0, rightEdge - newSpan);

        setGrid(prev => prev.map((r, ri) => ({
          cells: r.cells.map(c => {
            if (ri === dragState.sourceRow && c.fieldIndex === dragState.fieldIndex) {
              return { ...c, colStart: newStart, colSpan: newSpan };
            }
            return c;
          }),
        })));
      }
    };

    const handleMouseUp = () => {
      // Snap all values
      const newGrid = grid.map((r, ri) => ({
        cells: r.cells.map(c => {
          if (ri === dragState.sourceRow) {
            return { ...c, colSpan: snapToGrid(c.colSpan), colStart: Math.max(0, Math.round(c.colStart)) };
          }
          return c;
        }),
      }));
      commitGrid(newGrid);
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, grid, commitGrid, getColWidth]);

  // ── Drag-and-drop reorder ──────────────────────────────────────────────
  const handleDragFieldStart = useCallback((e: React.DragEvent, fieldIndex: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ fieldIndex }));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOverNewRow = useCallback((e: React.DragEvent, rowIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ rowIndex, position: 'new-row' });
  }, []);

  const handleDragOverGap = useCallback((e: React.DragEvent, rowIndex: number, gapColStart: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ rowIndex, position: 'after', cellIndex: gapColStart });
  }, []);

  const handleDropOnGap = useCallback((e: React.DragEvent, targetRowIndex: number, gapColStart: number, gapColSpan: number) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { fieldIndex: sourceFieldIdx } = data;

      const newGrid = grid.map(r => ({ cells: [...r.cells] }));
      let sourceCell: GridCell | null = null;
      for (const row of newGrid) {
        const idx = row.cells.findIndex(c => c.fieldIndex === sourceFieldIdx);
        if (idx !== -1) { sourceCell = row.cells.splice(idx, 1)[0]; break; }
      }
      if (!sourceCell) return;

      const cleaned = newGrid.filter(r => r.cells.length > 0);
      const tRow = Math.min(targetRowIndex, cleaned.length - 1);
      if (tRow >= 0 && cleaned[tRow]) {
        sourceCell.colStart = gapColStart;
        sourceCell.colSpan = Math.min(sourceCell.colSpan, gapColSpan);
        if (sourceCell.colSpan < MIN_COL_SPAN) sourceCell.colSpan = Math.min(MIN_COL_SPAN, gapColSpan);
        cleaned[tRow].cells.push(sourceCell);
        cleaned[tRow].cells.sort((a, b) => a.colStart - b.colStart);
      } else {
        sourceCell.colStart = 0;
        sourceCell.colSpan = 12;
        cleaned.push({ cells: [sourceCell] });
      }
      commitGrid(cleaned);
    } catch { /* ignore */ }
    setDropTarget(null);
  }, [grid, commitGrid]);

  const handleDrop = useCallback((e: React.DragEvent, targetRowIndex: number) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { fieldIndex: sourceFieldIdx } = data;

      if (!dropTarget) return;

      const newGrid = grid.map(r => ({ cells: [...r.cells] }));
      let sourceCell: GridCell | null = null;
      for (const row of newGrid) {
        const idx = row.cells.findIndex(c => c.fieldIndex === sourceFieldIdx);
        if (idx !== -1) { sourceCell = row.cells.splice(idx, 1)[0]; break; }
      }
      if (!sourceCell) return;

      const cleaned = newGrid.filter(r => r.cells.length > 0);

      if (dropTarget.position === 'new-row') {
        const insertAt = Math.min(dropTarget.rowIndex, cleaned.length);
        sourceCell.colSpan = 12;
        sourceCell.colStart = 0;
        cleaned.splice(insertAt, 0, { cells: [sourceCell] });
      } else {
        const tRow = Math.min(targetRowIndex, cleaned.length - 1);
        if (tRow >= 0 && cleaned[tRow]) {
          const row = cleaned[tRow];
          const gaps = getGaps({ cells: row.cells });
          const bestGap = gaps.find(g => g.colSpan >= MIN_COL_SPAN);
          if (bestGap) {
            sourceCell.colStart = bestGap.colStart;
            sourceCell.colSpan = Math.min(sourceCell.colSpan, bestGap.colSpan);
            row.cells.push(sourceCell);
            row.cells.sort((a, b) => a.colStart - b.colStart);
          } else {
            sourceCell.colSpan = 12;
            sourceCell.colStart = 0;
            cleaned.splice(tRow + 1, 0, { cells: [sourceCell] });
          }
        } else {
          cleaned.push({ cells: [{ ...sourceCell, colSpan: 12, colStart: 0 }] });
        }
      }
      commitGrid(cleaned);
    } catch { /* ignore */ }
    setDropTarget(null);
  }, [grid, commitGrid, dropTarget]);

  const handleDragEnd = useCallback(() => { setDropTarget(null); }, []);

  // ── Nudge field (move left/right by 1 col) ────────────────────────────
  const nudgeField = useCallback((fieldIndex: number, rowIndex: number, direction: -1 | 1) => {
    const newGrid = grid.map(r => ({ cells: [...r.cells] }));
    const row = newGrid[rowIndex];
    if (!row) return;
    const cellIdx = row.cells.findIndex(c => c.fieldIndex === fieldIndex);
    if (cellIdx === -1) return;
    const cell = row.cells[cellIdx];
    const newStart = cell.colStart + direction;
    if (newStart < 0 || newStart + cell.colSpan > GRID_COLS) return;
    for (const other of row.cells) {
      if (other.fieldIndex === fieldIndex) continue;
      const otherEnd = other.colStart + other.colSpan;
      const newEnd = newStart + cell.colSpan;
      if (newStart < otherEnd && newEnd > other.colStart) return;
    }
    cell.colStart = newStart;
    commitGrid(newGrid);
  }, [grid, commitGrid]);

  // ── Move ROW up/down ───────────────────────────────────────────────────
  const moveRowUp = useCallback((rowIndex: number) => {
    if (rowIndex <= 0) return;
    const newGrid = grid.map(r => ({ cells: [...r.cells] }));
    const temp = newGrid[rowIndex];
    newGrid[rowIndex] = newGrid[rowIndex - 1];
    newGrid[rowIndex - 1] = temp;
    commitGrid(newGrid);
  }, [grid, commitGrid]);

  const moveRowDown = useCallback((rowIndex: number) => {
    if (rowIndex >= grid.length - 1) return;
    const newGrid = grid.map(r => ({ cells: [...r.cells] }));
    const temp = newGrid[rowIndex];
    newGrid[rowIndex] = newGrid[rowIndex + 1];
    newGrid[rowIndex + 1] = temp;
    commitGrid(newGrid);
  }, [grid, commitGrid]);

  // ── Swap fields within a row ───────────────────────────────────────────
  const swapFieldInRow = useCallback((fieldIndex: number, rowIndex: number, direction: -1 | 1) => {
    const newGrid = grid.map(r => ({ cells: [...r.cells] }));
    const row = newGrid[rowIndex];
    if (!row) return;
    const sorted = [...row.cells].sort((a, b) => a.colStart - b.colStart);
    const idx = sorted.findIndex(c => c.fieldIndex === fieldIndex);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    const cellA = row.cells.find(c => c.fieldIndex === sorted[idx].fieldIndex)!;
    const cellB = row.cells.find(c => c.fieldIndex === sorted[targetIdx].fieldIndex)!;

    if (direction === -1) {
      const newAStart = cellB.colStart;
      const newBStart = cellB.colStart + cellA.colSpan;
      if (newBStart + cellB.colSpan > GRID_COLS) return;
      cellA.colStart = newAStart;
      cellB.colStart = newBStart;
    } else {
      const newBStart = cellA.colStart;
      const newAStart = cellA.colStart + cellB.colSpan;
      if (newAStart + cellA.colSpan > GRID_COLS) return;
      cellB.colStart = newBStart;
      cellA.colStart = newAStart;
    }
    commitGrid(newGrid);
  }, [grid, commitGrid]);

  // ── Move field to new row ──────────────────────────────────────────────
  const moveToNewRow = useCallback((fieldIndex: number) => {
    const newGrid = grid.map(r => ({ cells: [...r.cells] }));
    let cell: GridCell | null = null;
    for (const row of newGrid) {
      const idx = row.cells.findIndex(c => c.fieldIndex === fieldIndex);
      if (idx !== -1) { cell = row.cells.splice(idx, 1)[0]; break; }
    }
    if (!cell) return;
    const cleaned = newGrid.filter(r => r.cells.length > 0);
    cell.colSpan = 12;
    cell.colStart = 0;
    cleaned.push({ cells: [cell] });
    commitGrid(cleaned);
  }, [grid, commitGrid]);

  // ── Quick resize with auto-adjust ──────────────────────────────────────
  const setFieldWidth = useCallback((fieldIndex: number, rowIndex: number, newSpan: number) => {
    const newGrid = grid.map(r => ({ cells: [...r.cells] }));
    const row = newGrid[rowIndex];
    if (!row) return;
    const cell = row.cells.find(c => c.fieldIndex === fieldIndex);
    if (!cell) return;

    const maxSpan = GRID_COLS - cell.colStart;
    newSpan = Math.min(newSpan, maxSpan);

    const sorted = [...row.cells].sort((a, b) => a.colStart - b.colStart);
    const cIdx = sorted.findIndex(c => c.fieldIndex === fieldIndex);

    // Auto-adjust next field
    if (cIdx < sorted.length - 1) {
      const nextCell = row.cells.find(c => c.fieldIndex === sorted[cIdx + 1].fieldIndex)!;
      const newEnd = cell.colStart + newSpan;
      if (newEnd > nextCell.colStart) {
        const nextEnd = nextCell.colStart + nextCell.colSpan;
        const newNextStart = newEnd;
        const newNextSpan = nextEnd - newNextStart;
        if (newNextSpan >= MIN_COL_SPAN) {
          nextCell.colStart = newNextStart;
          nextCell.colSpan = newNextSpan;
        } else {
          newSpan = nextCell.colStart - cell.colStart;
        }
      }
    }

    cell.colSpan = Math.max(MIN_COL_SPAN, newSpan);
    commitGrid(newGrid);
  }, [grid, commitGrid]);

  // ── Remove field ───────────────────────────────────────────────────────
  const handleRemoveField = useCallback((fieldIndex: number) => {
    onFieldsChange(fields.filter((_, i) => i !== fieldIndex));
  }, [fields, onFieldsChange]);

  // ─── Rendering ─────────────────────────────────────────────────────────
  const colWidthPercent = 100 / GRID_COLS;

  const renderWidthIndicator = (colSpan: number) => {
    if (colSpan === 12) return '100%';
    if (colSpan === 9) return '75%';
    if (colSpan === 8) return '66%';
    if (colSpan === 6) return '50%';
    if (colSpan === 4) return '33%';
    if (colSpan === 3) return '25%';
    return `${colSpan}/${GRID_COLS}`;
  };

  return (
    <div className="space-y-1">
      {/* Column ruler */}
      <div className="flex mb-2 px-0.5" ref={containerRef}>
        {Array.from({ length: GRID_COLS }).map((_, i) => (
          <div
            key={i}
            className="text-center text-[9px] text-muted-foreground/50 border-x border-dashed border-muted-foreground/10"
            style={{ width: `${colWidthPercent}%` }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      <div className="space-y-1.5">
        {grid.map((row, rowIdx) => {
          const sortedCells = [...row.cells].sort((a, b) => a.colStart - b.colStart);

          type RenderItem =
            | { kind: 'cell'; cell: GridCell }
            | { kind: 'gap'; gap: GapSegment };

          const items: RenderItem[] = [];
          let pos = 0;

          for (const cell of sortedCells) {
            if (cell.colStart > pos) {
              items.push({ kind: 'gap', gap: { colStart: pos, colSpan: cell.colStart - pos } });
            }
            items.push({ kind: 'cell', cell });
            pos = cell.colStart + cell.colSpan;
          }
          if (pos < GRID_COLS) {
            items.push({ kind: 'gap', gap: { colStart: pos, colSpan: GRID_COLS - pos } });
          }

          return (
            <React.Fragment key={rowIdx}>
              {/* Drop zone before row */}
              <div
                className={`h-1.5 rounded-full mx-1 transition-all ${
                  dropTarget?.rowIndex === rowIdx && dropTarget?.position === 'new-row'
                    ? 'bg-primary/40 h-8 border-2 border-dashed border-primary flex items-center justify-center'
                    : 'hover:bg-muted-foreground/10'
                }`}
                onDragOver={(e) => handleDragOverNewRow(e, rowIdx)}
                onDrop={(e) => handleDrop(e, rowIdx)}
              >
                {dropTarget?.rowIndex === rowIdx && dropTarget?.position === 'new-row' && (
                  <span className="text-xs text-primary font-medium">Soltar aqui (nova linha)</span>
                )}
              </div>

              {/* Row */}
              <div className="relative group/row">
                {/* Row controls (left side) */}
                <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity z-10">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={`h-4 w-4 rounded flex items-center justify-center transition-colors ${
                            rowIdx > 0 ? 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground' : 'opacity-20 cursor-not-allowed text-muted-foreground'
                          }`}
                          onClick={() => moveRowUp(rowIdx)}
                          disabled={rowIdx <= 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">Mover linha para cima</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <span className="text-[9px] text-muted-foreground/40 font-mono">L{rowIdx + 1}</span>

                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={`h-4 w-4 rounded flex items-center justify-center transition-colors ${
                            rowIdx < grid.length - 1 ? 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground' : 'opacity-20 cursor-not-allowed text-muted-foreground'
                          }`}
                          onClick={() => moveRowDown(rowIdx)}
                          disabled={rowIdx >= grid.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">Mover linha para baixo</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Grid background */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: GRID_COLS }).map((_, i) => (
                    <div
                      key={i}
                      className="border-x border-dashed border-muted-foreground/5 h-full"
                      style={{ width: `${colWidthPercent}%` }}
                    />
                  ))}
                </div>

                {/* CSS Grid row */}
                <div
                  className="grid relative"
                  style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gap: '2px' }}
                >
                  {items.map((item) => {
                    if (item.kind === 'gap') {
                      const { gap } = item;
                      const isDropOnGap = dropTarget?.rowIndex === rowIdx &&
                        dropTarget?.position === 'after' &&
                        dropTarget?.cellIndex === gap.colStart;

                      return (
                        <div
                          key={`gap-${gap.colStart}`}
                          className={`
                            min-h-[68px] border-2 border-dashed rounded-lg flex items-center justify-center
                            transition-all cursor-default
                            ${isDropOnGap
                              ? 'border-primary bg-primary/10'
                              : 'border-muted-foreground/10 hover:border-muted-foreground/25 hover:bg-muted/30'
                            }
                          `}
                          style={{ gridColumn: `${gap.colStart + 1} / span ${gap.colSpan}` }}
                          onDragOver={(e) => handleDragOverGap(e, rowIdx, gap.colStart)}
                          onDrop={(e) => handleDropOnGap(e, rowIdx, gap.colStart, gap.colSpan)}
                        >
                          <span className="text-muted-foreground/30 font-mono text-[10px] select-none">
                            {gap.colSpan} col{gap.colSpan > 1 ? 's' : ''}
                          </span>
                        </div>
                      );
                    }

                    const { cell } = item;
                    const field = fields[cell.fieldIndex];
                    if (!field) return null;
                    const icon = fieldTypeIcons[field.type || 'text'] || '?';
                    const typeLabel = fieldTypeLabels[field.type || 'text'] || field.type;
                    const isSelected = selectedFieldIndex === cell.fieldIndex;
                    const isDragging = dragState?.fieldIndex === cell.fieldIndex;
                    const isResizing = dragState !== null && dragState.fieldIndex === cell.fieldIndex;

                    const canNudgeLeft = cell.colStart > 0 &&
                      !sortedCells.some(c => c.fieldIndex !== cell.fieldIndex &&
                        c.colStart + c.colSpan > cell.colStart - 1 && c.colStart <= cell.colStart - 1);
                    const canNudgeRight = cell.colStart + cell.colSpan < GRID_COLS &&
                      !sortedCells.some(c => c.fieldIndex !== cell.fieldIndex &&
                        c.colStart < cell.colStart + cell.colSpan + 1 &&
                        c.colStart + c.colSpan > cell.colStart + cell.colSpan);

                    const cellSortIdx = sortedCells.findIndex(c => c.fieldIndex === cell.fieldIndex);
                    const canSwapLeft = cellSortIdx > 0;
                    const canSwapRight = cellSortIdx < sortedCells.length - 1;

                    return (
                      <div
                        key={`cell-${cell.fieldIndex}`}
                        className={`
                          relative rounded-lg border-2 transition-all cursor-pointer group/cell
                          ${isSelected ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20' : 'border-muted-foreground/20 hover:border-muted-foreground/40 bg-background'}
                          ${isDragging ? 'opacity-50' : ''}
                          ${isResizing ? 'ring-2 ring-blue-400/50' : ''}
                        `}
                        style={{ gridColumn: `${cell.colStart + 1} / span ${cell.colSpan}` }}
                        draggable
                        onDragStart={(e) => handleDragFieldStart(e, cell.fieldIndex)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onFieldSelect?.(cell.fieldIndex)}
                      >
                        {/* Left resize handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize group/resizeleft hover:bg-orange-400/30 rounded-l-lg transition-colors z-10"
                          onMouseDown={(e) => handleResizeLeftStart(e, cell.fieldIndex, rowIdx, cell.colStart, cell.colSpan)}
                        >
                          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-muted-foreground/20 group-hover/resizeleft:bg-orange-500 rounded-full transition-colors" />
                        </div>

                        {/* Field content */}
                        <div className="p-2.5 min-h-[68px] flex flex-col">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab flex-shrink-0" />
                            <span className="text-sm flex-shrink-0">{icon}</span>
                            <span className="text-xs font-medium truncate flex-1">
                              {field.label || field.name || '(sem nome)'}
                            </span>
                            {field.required && (
                              <span className="text-destructive text-[10px] font-bold flex-shrink-0">*</span>
                            )}
                          </div>

                          <div className="h-7 bg-muted/50 rounded border border-muted-foreground/10 text-[10px] flex items-center px-2 text-muted-foreground/60 truncate">
                            {field.placeholder || typeLabel}
                          </div>

                          {/* Controls bar */}
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="flex items-center gap-0.5">
                              {/* Swap left */}
                              {sortedCells.length > 1 && (
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        className={`h-4 w-4 rounded flex items-center justify-center transition-colors ${
                                          canSwapLeft ? 'bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/40 text-blue-600 dark:text-blue-400' : 'opacity-20 cursor-not-allowed text-muted-foreground'
                                        }`}
                                        onClick={(e) => { e.stopPropagation(); if (canSwapLeft) swapFieldInRow(cell.fieldIndex, rowIdx, -1); }}
                                        disabled={!canSwapLeft}
                                      >
                                        <ArrowLeftRight className="h-2.5 w-2.5 -scale-x-100" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">Trocar com campo à esquerda</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                              {/* Nudge left */}
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={`h-4 w-4 rounded flex items-center justify-center transition-colors ${
                                        canNudgeLeft ? 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground' : 'opacity-20 cursor-not-allowed text-muted-foreground'
                                      }`}
                                      onClick={(e) => { e.stopPropagation(); if (canNudgeLeft) nudgeField(cell.fieldIndex, rowIdx, -1); }}
                                      disabled={!canNudgeLeft}
                                    >
                                      <ChevronLeft className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs">Mover 1 col para esquerda</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
                                {cell.colStart > 0 ? `col ${cell.colStart + 1} · ` : ''}{renderWidthIndicator(cell.colSpan)}
                              </Badge>

                              {/* Nudge right */}
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={`h-4 w-4 rounded flex items-center justify-center transition-colors ${
                                        canNudgeRight ? 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground' : 'opacity-20 cursor-not-allowed text-muted-foreground'
                                      }`}
                                      onClick={(e) => { e.stopPropagation(); if (canNudgeRight) nudgeField(cell.fieldIndex, rowIdx, 1); }}
                                      disabled={!canNudgeRight}
                                    >
                                      <ChevronRight className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs">Mover 1 col para direita</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {/* Swap right */}
                              {sortedCells.length > 1 && (
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        className={`h-4 w-4 rounded flex items-center justify-center transition-colors ${
                                          canSwapRight ? 'bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/40 text-blue-600 dark:text-blue-400' : 'opacity-20 cursor-not-allowed text-muted-foreground'
                                        }`}
                                        onClick={(e) => { e.stopPropagation(); if (canSwapRight) swapFieldInRow(cell.fieldIndex, rowIdx, 1); }}
                                        disabled={!canSwapRight}
                                      >
                                        <ArrowLeftRight className="h-2.5 w-2.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">Trocar com campo à direita</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>

                            {/* Quick size buttons */}
                            <div className="flex items-center gap-0.5">
                              <TooltipProvider delayDuration={200}>
                                {[
                                  { span: 3, label: '25%' },
                                  { span: 4, label: '33%' },
                                  { span: 6, label: '50%' },
                                  { span: 12, label: '100%' },
                                ].map(({ span, label }) => (
                                  <Tooltip key={span}>
                                    <TooltipTrigger asChild>
                                      <button
                                        className={`h-4 px-1 rounded text-[8px] font-mono transition-colors ${
                                          cell.colSpan === span ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground'
                                        }`}
                                        onClick={(e) => { e.stopPropagation(); setFieldWidth(cell.fieldIndex, rowIdx, span); }}
                                      >
                                        {label}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">{label} da linha</TooltipContent>
                                  </Tooltip>
                                ))}
                              </TooltipProvider>
                            </div>
                          </div>
                        </div>

                        {/* Right resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group/resize hover:bg-blue-400/30 rounded-r-lg transition-colors z-10"
                          onMouseDown={(e) => handleResizeRightStart(e, cell.fieldIndex, rowIdx, cell.colSpan)}
                        >
                          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-muted-foreground/20 group-hover/resize:bg-blue-500 rounded-full transition-colors" />
                        </div>

                        {/* Actions on hover */}
                        <div className="absolute -top-2 -right-2 opacity-0 group-hover/cell:opacity-100 transition-opacity flex gap-0.5 z-20">
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                                  onClick={(e) => { e.stopPropagation(); handleRemoveField(cell.fieldIndex); }}
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">Remover campo</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {row.cells.length > 1 && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="h-5 w-5 rounded-full bg-muted-foreground/80 text-background flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                                    onClick={(e) => { e.stopPropagation(); moveToNewRow(cell.fieldIndex); }}
                                  >
                                    <Maximize2 className="h-2.5 w-2.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">Mover para nova linha</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Drop zone after last row */}
        <div
          className={`h-1.5 rounded-full mx-1 transition-all ${
            dropTarget?.rowIndex === grid.length && dropTarget?.position === 'new-row'
              ? 'bg-primary/40 h-8 border-2 border-dashed border-primary flex items-center justify-center'
              : 'hover:bg-muted-foreground/10'
          }`}
          onDragOver={(e) => handleDragOverNewRow(e, grid.length)}
          onDrop={(e) => handleDrop(e, grid.length)}
        >
          {dropTarget?.rowIndex === grid.length && dropTarget?.position === 'new-row' && (
            <span className="text-xs text-primary font-medium">Soltar aqui (nova linha)</span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {grid.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-sm mb-2">Nenhum campo definido ainda</p>
          <p className="text-xs">Adicione campos e arraste para organizar o layout</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] text-muted-foreground/60 border-t border-muted-foreground/10">
        <span className="flex items-center gap-1">
          <GripVertical className="h-3 w-3" /> Arraste para reordenar
        </span>
        <span className="flex items-center gap-1">
          <div className="w-0.5 h-3 bg-blue-400/50 rounded" /> Borda direita = resize
        </span>
        <span className="flex items-center gap-1">
          <div className="w-0.5 h-3 bg-orange-400/50 rounded" /> Borda esquerda = resize
        </span>
        <span className="flex items-center gap-1">
          <ChevronUp className="h-3 w-3" /><ChevronDown className="h-3 w-3" /> Mover linha
        </span>
        <span className="flex items-center gap-1">
          <ArrowLeftRight className="h-3 w-3" /> Trocar posição
        </span>
        <span>Vizinhos se ajustam ao redimensionar</span>
      </div>
    </div>
  );
}
