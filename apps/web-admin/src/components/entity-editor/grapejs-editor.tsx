'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GjsEditor, { Canvas } from '@grapesjs/react';
import grapesjs, { type Editor, type Component as GjsComponent } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import { useTheme } from 'next-themes';
import { Save, Loader2, Undo2, Redo2, Trash2, ArrowLeft, Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
import type { Entity, EntityField, EntitySettings } from '@crm-builder/shared';

import { createEditorConfig } from './config/editor-config';
import { editorStyles, getCanvasCss } from './config/theme';
import { registerAllComponents } from './components';
import { registerAllBlocks } from './blocks';
import { serializeToGjs, type GjsProjectData } from './serialization/serialize';
import { deserializeFromGjs } from './serialization/deserialize';
import { EntityInfoPanel } from './panels/entity-info-panel';
import { FieldPropertiesPanel } from './panels/field-properties-panel';
import { FieldPickerModal } from './panels/field-picker-modal';
import { AutomationTab } from '@/components/entity-automation/automation-tab';

// Constantes de layout do grid
const GRID_GAP = 16; // gap do grid em px

/**
 * Funcao centralizada para atualizar layout de uma grid-cell.
 * Fonte unica de verdade — usada em resize, drag-drop e trait change.
 * NAO usa setClass() — delega para updateGridSpan que usa classList.
 */
function syncCellLayout(cell: GjsComponent, colSpan: number) {
  // 1. Atualizar model da cell (dispara updateGridSpan)
  cell.set('colSpan', colSpan);

  // 2. Atualizar o campo dentro da cell — SEM silent para que traits atualize
  const field = cell.components().find(
    (c: GjsComponent) => c.get('type')?.startsWith('crm-field'),
  );
  if (field) {
    field.set('fieldColSpan', String(colSpan));
  }
}

/**
 * Remove cells vazias de uma row e redistribui as restantes.
 * Tambem remove a row se ficar completamente vazia.
 */
function cleanupRow(row: GjsComponent) {
  const allCells = row.components().filter(
    (c: GjsComponent) => c.get('type') === 'grid-cell',
  );
  // Remover cells que nao tem campo dentro
  const emptyCells = allCells.filter(
    (c: GjsComponent) => !c.components().find(
      (comp: GjsComponent) => comp.get('type')?.startsWith('crm-field'),
    ),
  );
  emptyCells.forEach((c: GjsComponent) => c.remove());

  // Redistribuir restantes
  const remaining = row.components().filter(
    (c: GjsComponent) => c.get('type') === 'grid-cell',
  );
  if (remaining.length === 0) {
    row.remove();
    return;
  }
  const span = Math.max(1, Math.floor(12 / remaining.length));
  remaining.forEach((cell: GjsComponent, i: number) => {
    const s = i === remaining.length - 1
      ? 12 - span * (remaining.length - 1)
      : span;
    syncCellLayout(cell, s);
  });
}

interface EntityEditorProps {
  entity: Entity;
  onSave: (data: {
    name: string;
    description: string;
    fields: EntityField[];
    settings: EntitySettings;
  }) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => Promise<void> | void;
}

export default function EntityEditor({ entity, onSave, onCancel, onDelete }: EntityEditorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const editorRef = useRef<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<GjsComponent | null>(null);
  const [, forceUpdate] = useState(0);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [fieldCount, setFieldCount] = useState(entity.fields?.length || 0);
  const [pendingField, setPendingField] = useState<{ type: string; label: string } | null>(null);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable entity info
  const [entityName, setEntityName] = useState(entity.name);
  const [entityDescription, setEntityDescription] = useState(entity.description || '');
  const [entitySettings, setEntitySettings] = useState<EntitySettings>(entity.settings || {});

  // Conta campos no canvas
  const updateFieldCount = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const wrapper = editor.getWrapper();
    if (!wrapper) return;
    let count = 0;
    wrapper.components().forEach((row: GjsComponent) => {
      if (row.get('type') !== 'grid-row') return;
      row.components().forEach((cell: GjsComponent) => {
        if (cell.get('type') !== 'grid-cell') return;
        cell.components().forEach((comp: GjsComponent) => {
          if (comp.get('type')?.startsWith('crm-field')) count++;
        });
      });
    });
    setFieldCount(count);
  }, []);

  // Handler para quando um campo e selecionado na modal — entra em placement mode
  const handleFieldPickerSelect = useCallback((fieldType: string, label: string) => {
    setPendingField({ type: fieldType, label });
    setFieldPickerOpen(false);
  }, []);

  // Cria o campo numa posicao especifica (afterRowIndex) ou no final (-1)
  const createFieldAtPosition = useCallback((fieldType: string, label: string, afterRowIndex: number) => {
    const editor = editorRef.current;
    if (!editor) return;

    const slug = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    const wrapper = editor.getWrapper();
    if (!wrapper) return;

    const rowDef = {
      type: 'grid-row',
      components: [{
        type: 'grid-cell',
        colSpan: 12,
        attributes: { class: 'grid-cell col-span-12' },
        components: [{
          type: `crm-field-${fieldType}`,
          fieldType: fieldType,
          fieldLabel: label,
          fieldName: slug,
          fieldColSpan: '12',
        }],
      }],
    };

    const rows = afterRowIndex >= 0
      ? wrapper.append(rowDef, { at: afterRowIndex })
      : wrapper.append(rowDef);

    const addedField = rows?.[0]?.components()?.at(0)?.components()?.at(0);
    if (addedField) {
      editor.select(addedField);
    }
  }, []);

  // Collect all field slugs from the canvas for FieldPropertiesPanel
  const getCanvasFields = useCallback((): Array<{ slug: string; label: string }> => {
    const editor = editorRef.current;
    if (!editor) return [];
    const fields: Array<{ slug: string; label: string }> = [];
    const wrapper = editor.getWrapper();
    if (!wrapper) return fields;

    const iterate = (comp: GjsComponent) => {
      if (comp.get('type')?.startsWith('crm-field')) {
        const slug = (comp.get('fieldName') as string) || '';
        const label = (comp.get('fieldLabel') as string) || slug;
        if (slug) fields.push({ slug, label });
      }
      comp.components().forEach((c: GjsComponent) => iterate(c));
    };
    wrapper.components().forEach((c: GjsComponent) => iterate(c));
    return fields;
  }, []);

  const handleEditorInit = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Registrar components e blocks
    registerAllComponents(editor);
    registerAllBlocks(editor);

    // ─── Injetar CSS direto no iframe do canvas ───────────────────────
    const injectCss = () => {
      const frame = editor.Canvas.getFrameEl();
      if (!frame) return false;
      const doc = frame.contentDocument;
      if (!doc) return false;
      // Remover estilo anterior se existir
      const existing = doc.getElementById('crm-canvas-styles');
      if (existing) existing.remove();
      const style = doc.createElement('style');
      style.id = 'crm-canvas-styles';
      style.textContent = getCanvasCss(isDark);
      doc.head.appendChild(style);
      return true;
    };

    // Injetar apos o canvas carregar
    editor.on('canvas:frame:load', injectCss);
    // Retry com intervalos crescentes para computadores lentos
    const retryDelays = [100, 300, 600, 1200, 2500];
    retryDelays.forEach((delay) => {
      setTimeout(() => {
        const frame = editor.Canvas.getFrameEl();
        const doc = frame?.contentDocument;
        if (doc && !doc.getElementById('crm-canvas-styles')) {
          injectCss();
        }
      }, delay);
    });

    // Carregar dados da entidade
    const projectData = serializeToGjs(entity.fields || []);
    editor.loadProjectData(projectData);
    setTimeout(updateFieldCount, 100);

    // ─── Track selected component ───────────────────────────────────
    editor.on('component:selected', (component: GjsComponent) => {
      if (component.get('type')?.startsWith('crm-field')) {
        setSelectedComponent(component);
      } else {
        setSelectedComponent(null);
      }
    });

    editor.on('component:deselected', () => {
      setSelectedComponent(null);
    });

    // ─── Atualizar contagem de campos ao adicionar/remover ──────────────
    editor.on('component:add', () => setTimeout(updateFieldCount, 50));
    editor.on('component:remove', () => setTimeout(updateFieldCount, 50));

    // ─── Auto-wrap: campo solto fora de grid-cell ─────────────────────
    // Guard: quando fazemos row.append() dentro do handler, dispara outro
    // component:add. O guard previne reentrada.
    let _addGuard = false;

    editor.on('component:add', (component: GjsComponent) => {
      if (_addGuard) return;
      const type = component.get('type') || '';
      if (!type.startsWith('crm-field')) return;

      const parent = component.parent();
      if (!parent) return;
      const parentType = parent.get('type');

      // Se ja esta numa celula sozinho, OK — nao precisa reestruturar
      if (parentType === 'grid-cell') {
        const siblings = parent.components().filter(
          (c: GjsComponent) => c.get('type')?.startsWith('crm-field'),
        );
        if (siblings.length <= 1) return;
      }

      // Capturar info de posicao AGORA (indices podem mudar depois)
      const dropIndex = parent.components().indexOf(component);
      let prevCell: GjsComponent | null = null;
      if (parentType === 'grid-row') {
        for (let i = dropIndex - 1; i >= 0; i--) {
          const child = parent.components().at(i);
          if (child && child.get('type') === 'grid-cell' &&
              child.components().find((f: GjsComponent) => f.get('type')?.startsWith('crm-field'))) {
            prevCell = child;
            break;
          }
        }
      }
      const parentRef = parent;
      const cellIndexRef = parentType === 'grid-cell'
        ? parent.parent()?.components().indexOf(parent) ?? -1
        : -1;
      const rowRef = parentType === 'grid-cell' ? parent.parent() : null;

      // Esconder o componente imediatamente para evitar flash visual
      const viewEl = component.view?.el;
      if (viewEl) viewEl.style.display = 'none';

      // Deferir para proximo tick — GrapeJS termina de criar o view,
      // garantindo que component.remove() limpa o DOM corretamente.
      // Sem isto, o view pode nao existir e o DOM fica orfao (ghost).
      setTimeout(() => {
        if (!component.parent()) return; // Ja foi removido por outro handler

        _addGuard = true;
        try {
          const fieldJson = component.toJSON();
          component.remove(); // View existe agora, DOM limpo corretamente

          // Caso 1: dentro de grid-cell com 2+ campos
          if (parentType === 'grid-cell') {
            const row = rowRef;
            if (!row || row.get('type') !== 'grid-row') return;

            const existingCells = row.components().filter(
              (c: GjsComponent) => c.get('type') === 'grid-cell',
            );
            const cellCount = existingCells.length + 1;
            const newSpan = Math.max(1, Math.floor(12 / cellCount));
            existingCells.forEach((cell: GjsComponent) => syncCellLayout(cell, newSpan));

            const lastCellSpan = 12 - newSpan * existingCells.length;
            const finalSpan = lastCellSpan > 0 ? lastCellSpan : newSpan;
            const insertAt = Math.min(cellIndexRef + 1, existingCells.length);

            const newCells = row.append({
              type: 'grid-cell',
              colSpan: finalSpan,
              attributes: { class: `grid-cell col-span-${finalSpan}` },
              components: [fieldJson],
            }, { at: insertAt });

            const addedField = newCells?.[0]?.components()?.at(0);
            if (addedField) {
              addedField.set('fieldColSpan', String(finalSpan));
              editor.select(addedField);
            }
            return;
          }

          // Caso 2: dentro de grid-row
          if (parentType === 'grid-row') {
            // Remover cells vazias (campo pode ter sido arrastado de cell na mesma row)
            parentRef.components().filter(
              (c: GjsComponent) => c.get('type') === 'grid-cell' && c.components().length === 0,
            ).forEach((c: GjsComponent) => c.remove());

            const existingCells = parentRef.components().filter(
              (c: GjsComponent) => c.get('type') === 'grid-cell',
            );

            // Se nao restaram cells, criar cell diretamente na row
            if (existingCells.length === 0) {
              const newCells = parentRef.append({
                type: 'grid-cell',
                colSpan: 12,
                attributes: { class: 'grid-cell col-span-12' },
                components: [fieldJson],
              });
              const f = newCells?.[0]?.components()?.at(0);
              if (f) { f.set('fieldColSpan', '12'); editor.select(f); }
              return;
            }

            const cellCount = existingCells.length + 1;
            const newSpan = Math.max(1, Math.floor(12 / cellCount));
            existingCells.forEach((cell: GjsComponent) => syncCellLayout(cell, newSpan));

            const lastCellSpan = 12 - newSpan * existingCells.length;
            const finalSpan = lastCellSpan > 0 ? lastCellSpan : newSpan;

            let insertAt: number;
            if (prevCell) {
              const prevIndex = existingCells.indexOf(prevCell);
              insertAt = prevIndex >= 0 ? prevIndex + 1 : existingCells.length;
            } else {
              insertAt = 0;
            }

            const newCells = parentRef.append({
              type: 'grid-cell',
              colSpan: finalSpan,
              attributes: { class: `grid-cell col-span-${finalSpan}` },
              components: [fieldJson],
            }, { at: insertAt });

            const addedField = newCells?.[0]?.components()?.at(0);
            if (addedField) {
              addedField.set('fieldColSpan', String(finalSpan));
              editor.select(addedField);
            }
            return;
          }

          // Caso 3: solto no wrapper — criar nova row preservando posicao
          const wrapper = parentRef;
          const insertAt = Math.min(Math.max(0, dropIndex), wrapper.components().length);

          const rows = wrapper.append({
            type: 'grid-row',
            components: [{
              type: 'grid-cell',
              colSpan: 12,
              attributes: { class: 'grid-cell col-span-12' },
              components: [fieldJson],
            }],
          }, { at: insertAt });

          const addedField = rows?.[0]?.components()?.at(0)?.components()?.at(0);
          if (addedField) {
            addedField.set('fieldColSpan', '12');
            editor.select(addedField);
          }
        } finally {
          _addGuard = false;
        }
      }, 0);
    });

    // ─── Resize centralizado: converter px → colSpan/rowSpan ────────
    let resizeIndicator: HTMLDivElement | null = null;

    editor.on('component:resize', ({ component, type }: { component: GjsComponent; type: string }) => {
      if (!component.get('type')?.startsWith('crm-field')) return;
      if (type === 'start') {
        const doc = editor.Canvas.getFrameEl()?.contentDocument;
        if (doc) {
          resizeIndicator = doc.createElement('div');
          resizeIndicator.className = 'crm-resize-indicator';
          doc.body.appendChild(resizeIndicator);
        }
      }
    });

    editor.on('component:resize:update', ({ component, rect, updateStyle, pointer }: {
      component: GjsComponent;
      rect: { w: number; h: number };
      updateStyle: (s: Record<string, string>) => void;
      pointer: { x: number; y: number };
    }) => {
      if (!component.get('type')?.startsWith('crm-field')) return;
      const cell = component.parent();
      if (!cell || cell.get('type') !== 'grid-cell') return;
      const row = cell.parent();
      if (!row || row.get('type') !== 'grid-row') return;
      const rowEl = row.view?.el;
      if (!rowEl) return;

      const rowWidth = rowEl.getBoundingClientRect().width;
      const colWidth = (rowWidth - GRID_GAP * 11) / 12;
      let newColSpan = Math.min(12, Math.max(1,
        Math.round((rect.w + GRID_GAP) / (colWidth + GRID_GAP)),
      ));

      // Ajustar celulas irmas para que o total sempre some 12
      const allCells = row.components().filter(
        (c: GjsComponent) => c.get('type') === 'grid-cell',
      );
      const MIN_COL = 2; // largura minima de cada celula irma

      if (allCells.length > 1) {
        const otherCells = allCells.filter((c: GjsComponent) => c !== cell);
        const maxForResized = 12 - otherCells.length * MIN_COL;
        newColSpan = Math.min(newColSpan, maxForResized);
        newColSpan = Math.max(MIN_COL, newColSpan);

        const remaining = 12 - newColSpan;
        const perOther = Math.floor(remaining / otherCells.length);

        syncCellLayout(cell, newColSpan);
        otherCells.forEach((other: GjsComponent, i: number) => {
          const span = i === otherCells.length - 1
            ? remaining - perOther * (otherCells.length - 1)
            : perOther;
          syncCellLayout(other, Math.max(MIN_COL, span));
        });
      } else {
        syncCellLayout(cell, newColSpan);
      }

      if (resizeIndicator) {
        resizeIndicator.textContent = `${newColSpan}/12`;
        resizeIndicator.style.left = `${pointer.x + 15}px`;
        resizeIndicator.style.top = `${pointer.y - 30}px`;
        resizeIndicator.style.display = 'block';
      }

      // Prevenir GrapeJS de aplicar inline styles
      updateStyle({});
    });

    editor.on('component:resize:end', ({ component }: { component: GjsComponent }) => {
      if (resizeIndicator) {
        resizeIndicator.remove();
        resizeIndicator = null;
      }
      if (!component.get('type')?.startsWith('crm-field')) return;

      // Limpar qualquer inline style residual
      const el = component.view?.el;
      if (el) {
        el.style.width = '';
        el.style.height = '';
      }
      const style = component.getStyle();
      delete style.width;
      delete style.height;
      component.setStyle(style);
    });

    // ─── Limpar inline styles e cells/rows vazias apos drag ─────────
    editor.on('component:drag:end', (comp: GjsComponent) => {
      const el = comp?.view?.el;
      if (el) {
        el.style.position = '';
        el.style.top = '';
        el.style.left = '';
        el.style.width = '';
        el.style.height = '';
      }

      // Limpar cells/rows vazias e elementos orfaos em TODO o canvas
      // (a row de origem pode ter ficado com cell vazia apos o drag)
      setTimeout(() => {
        const wrapper = editor.getWrapper();
        if (!wrapper) return;

        // 1. Model-level: remover campos orfaos (soltos fora de grid-cell)
        wrapper.components().forEach((row: GjsComponent) => {
          if (row.get('type') !== 'grid-row') return;
          const orphans = row.components().filter(
            (c: GjsComponent) => c.get('type')?.startsWith('crm-field'),
          );
          orphans.forEach((c: GjsComponent) => c.remove());
        });
        // Orfaos no wrapper
        wrapper.components().filter(
          (c: GjsComponent) => c.get('type')?.startsWith('crm-field'),
        ).forEach((c: GjsComponent) => c.remove());

        // 2. Limpar cells/rows vazias
        const allRows = wrapper.components().filter(
          (c: GjsComponent) => c.get('type') === 'grid-row',
        );
        // Iterar de tras pra frente pois cleanupRow pode remover rows
        for (let i = allRows.length - 1; i >= 0; i--) {
          cleanupRow(allRows[i]);
        }

        // 3. DOM-level: remover filhos de grid-row que nao sao grid-cell
        const frame = editor.Canvas.getFrameEl();
        const doc = frame?.contentDocument;
        if (doc) {
          doc.querySelectorAll('.grid-row').forEach((rowEl) => {
            Array.from(rowEl.children).forEach((child) => {
              if (!(child as HTMLElement).classList?.contains('grid-cell')) {
                child.remove();
              }
            });
          });
        }
      }, 150);
    });

    // Atalhos de teclado
    editor.Keymaps.add('save', 'ctrl+s', () => handleSave());
    editor.Keymaps.add('duplicate', 'ctrl+d', () => {
      const selected = editor.getSelected();
      if (selected?.get('type')?.startsWith('crm-field')) {
        // Duplicar o campo em uma nova row abaixo
        const fieldJson = selected.toJSON();
        const baseName = fieldJson.fieldName || 'campo';
        fieldJson.fieldName = `${baseName}_copy`;
        fieldJson.fieldLabel = `${fieldJson.fieldLabel || ''} (copia)`;

        const wrapper = editor.getWrapper();
        if (!wrapper) return;

        // Encontrar a row atual para inserir depois dela
        let currentRow = selected.parent();
        if (currentRow?.get('type') === 'grid-cell') currentRow = currentRow.parent();

        const colSpan = parseInt(String(selected.get('fieldColSpan')), 10) || 12;

        const newRowDef = {
          type: 'grid-row',
          components: [{
            type: 'grid-cell',
            colSpan,
            attributes: { class: `grid-cell col-span-${colSpan}` },
            components: [fieldJson],
          }],
        };

        let addedRows;
        if (currentRow && currentRow.get('type') === 'grid-row') {
          // Inserir depois da row atual
          const rowIndex = wrapper.components().indexOf(currentRow);
          addedRows = wrapper.append(newRowDef, { at: rowIndex + 1 });
        } else {
          addedRows = wrapper.append(newRowDef);
        }

        const addedField = addedRows?.[0]?.components()?.at(0)?.components()?.at(0);
        if (addedField) {
          addedField.set('fieldColSpan', String(colSpan));
          editor.select(addedField);
        }
      }
    });
  }, [entity, isDark, updateFieldCount]);

  // ─── Placement mode: Escape to cancel ─────────────────────────────
  useEffect(() => {
    if (!pendingField) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingField(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [pendingField]);

  // ─── Placement mode: inject CSS + click handler into canvas ──────
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const frame = editor.Canvas.getFrameEl();
    const doc = frame?.contentDocument;
    if (!doc) return;

    // Manage placement CSS in canvas iframe
    const existingStyle = doc.getElementById('crm-placement-styles');
    if (!pendingField) {
      // Remove placement styles when not in placement mode
      if (existingStyle) existingStyle.remove();
      doc.body.classList.remove('placement-mode');
      return;
    }

    // Add placement mode class and styles
    doc.body.classList.add('placement-mode');

    if (!existingStyle) {
      const style = doc.createElement('style');
      style.id = 'crm-placement-styles';
      style.textContent = `
        body.placement-mode {
          cursor: crosshair !important;
        }
        body.placement-mode * {
          cursor: crosshair !important;
        }
        body.placement-mode .grid-row {
          position: relative;
        }
        body.placement-mode .grid-row::before {
          content: '';
          display: block;
          position: absolute;
          top: -6px;
          left: 0;
          right: 0;
          height: 4px;
          background: #3b82f6;
          border-radius: 2px;
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 100;
          pointer-events: all;
        }
        body.placement-mode .grid-row:hover::before {
          opacity: 0.6;
        }
        body.placement-mode .grid-row:last-child::after {
          content: '';
          display: block;
          position: absolute;
          bottom: -6px;
          left: 0;
          right: 0;
          height: 4px;
          background: #3b82f6;
          border-radius: 2px;
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 100;
          pointer-events: all;
        }
        body.placement-mode .grid-row:last-child:hover::after {
          opacity: 0.6;
        }
        /* Dim the canvas content slightly */
        body.placement-mode > [data-gjs-type="wrapper"] {
          opacity: 0.85;
        }
      `;
      doc.head.appendChild(style);
    }

    // Click handler inside canvas
    const clickHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const wrapper = editor.getWrapper();
      if (!wrapper) return;

      // Find which row was clicked near
      const allRowEls = doc.querySelectorAll('.grid-row');
      let insertIndex = wrapper.components().length; // Default: end

      for (let i = 0; i < allRowEls.length; i++) {
        const rowEl = allRowEls[i];
        const rect = rowEl.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
          // Insert before this row
          insertIndex = i;
          break;
        }
      }

      createFieldAtPosition(pendingField.type, pendingField.label, insertIndex);
      setPendingField(null);
    };

    doc.addEventListener('click', clickHandler, true);
    return () => {
      doc.removeEventListener('click', clickHandler, true);
    };
  }, [pendingField, createFieldAtPosition]);

  const handleSave = useCallback(async () => {
    if (!editorRef.current) return;

    setSaving(true);
    try {
      const projectData = editorRef.current.getProjectData() as unknown as GjsProjectData;
      const fields = deserializeFromGjs(projectData);

      const errors: string[] = [];
      const slugs = new Set<string>();

      if (!entityName.trim()) {
        errors.push('Nome da entidade e obrigatorio');
      }

      fields.forEach((field, index) => {
        if (!field.name && !field.slug) {
          errors.push(`Campo ${index + 1}: slug e obrigatorio`);
        }
        const slug = field.slug || field.name;
        if (slugs.has(slug)) {
          errors.push(`Campo "${slug}": slug duplicado`);
        }
        slugs.add(slug);
      });

      if (errors.length > 0) {
        toast.error(`Erros na validacao:\n${errors.join('\n')}`);
        return;
      }

      await onSave({
        name: entityName,
        description: entityDescription,
        fields,
        settings: entitySettings,
      });
      toast.success('Entidade salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar entidade');
    } finally {
      setSaving(false);
    }
  }, [onSave, entityName, entityDescription, entitySettings]);

  // Get current fields for the automations dialog (deserialized from canvas)
  const getCurrentFields = useCallback((): EntityField[] => {
    if (!editorRef.current) return entity.fields || [];
    try {
      const projectData = editorRef.current.getProjectData() as unknown as GjsProjectData;
      return deserializeFromGjs(projectData);
    } catch {
      return entity.fields || [];
    }
  }, [entity.fields]);

  // Whether the selected component is a CRM field
  const isFieldSelected = selectedComponent?.get('type')?.startsWith('crm-field') || false;

  return (
    <div className="h-screen flex flex-col bg-background">
      <style>{editorStyles}</style>

      {/* Toolbar superior */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{entityName}</h1>
            <span className="text-xs text-muted-foreground">{entity.slug}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setFieldPickerOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Adicionar Campo</span>
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => editorRef.current?.runCommand('core:undo')}
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => editorRef.current?.runCommand('core:redo')}
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (confirm('Remover todos os campos do canvas?')) {
                editorRef.current?.runCommand('core:canvas-clear');
              }
            }}
            title="Limpar canvas"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setAutomationsOpen(true)}
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Automacoes</span>
          </Button>

          {onDelete && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Excluir Tabela</span>
              </Button>
            </>
          )}

          <div className="w-px h-6 bg-border mx-1" />

          <span className="text-xs text-muted-foreground hidden sm:inline">
            {fieldCount} campos
          </span>

          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Layout principal: Canvas | Right Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Hidden containers (GrapeJS needs blocks for drag-drop, traits hidden) */}
        <div className="gjs-blocks-hidden hidden" />
        <div id="gjs-traits-hidden" className="hidden" />

        {/* Canvas central */}
        <div className="flex-1 overflow-hidden bg-muted relative">
          {/* Placement mode banner */}
          {pendingField && (
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-3 py-2.5 px-4 bg-blue-500 text-white text-sm shadow-md">
              <span>
                Clique no canvas para inserir <strong>{pendingField.label}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-white hover:bg-blue-600 hover:text-white text-xs"
                onClick={() => setPendingField(null)}
              >
                Cancelar (Esc)
              </Button>
            </div>
          )}
          <GjsEditor
            grapesjs={grapesjs}
            options={createEditorConfig('.gjs-editor-container')}
            onEditor={handleEditorInit}
          >
            <Canvas className="h-full" />
          </GjsEditor>
        </div>

        {/* Painel direito - Propriedades */}
        <div className="w-64 md:w-72 lg:w-80 border-l bg-card flex flex-col flex-shrink-0 min-w-0">
          {/* Header */}
          <div className="px-4 py-2.5 border-b flex-shrink-0">
            {isFieldSelected ? (
              <>
                <p className="text-sm font-medium truncate">
                  {(selectedComponent?.get('fieldLabel') as string) || 'Campo'}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  {(selectedComponent?.get('fieldName') as string) || '—'}
                </p>
              </>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">
                Propriedades da Entidade
              </p>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isFieldSelected && selectedComponent ? (
              <FieldPropertiesPanel
                key={selectedComponent.cid}
                component={selectedComponent}
                entityId={entity.id}
                getCanvasFields={getCanvasFields}
                onPropertyChange={() => forceUpdate((n) => n + 1)}
              />
            ) : (
              <div className="p-4">
                <EntityInfoPanel
                  name={entityName}
                  slug={entity.slug}
                  description={entityDescription}
                  settings={entitySettings}
                  onChangeName={setEntityName}
                  onChangeDescription={setEntityDescription}
                  onChangeSettings={setEntitySettings}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de selecao de campos */}
      <FieldPickerModal
        open={fieldPickerOpen}
        onClose={() => setFieldPickerOpen(false)}
        onSelect={handleFieldPickerSelect}
      />

      {/* Dialog de automacoes */}
      <Dialog open={automationsOpen} onOpenChange={setAutomationsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <AutomationTab
            entityId={entity.id}
            fields={getCurrentFields()}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmacao de exclusao */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tabela?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tabela &quot;{entityName}&quot;?
              Todos os dados relacionados serao perdidos. Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                setDeleting(true);
                try {
                  await onDelete?.();
                } catch {
                  setDeleting(false);
                  setDeleteDialogOpen(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
