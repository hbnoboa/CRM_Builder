'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GjsEditor, { Canvas } from '@grapesjs/react';
import grapesjs, { type Editor, type Component as GjsComponent } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import { useTheme } from 'next-themes';
import { Save, Loader2, Undo2, Redo2, Trash2, ArrowLeft, Info, Zap, Columns3, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { Entity, EntityField, EntitySettings } from '@crm-builder/shared';

import { createEditorConfig } from './config/editor-config';
import { editorStyles, getCanvasCss } from './config/theme';
import { registerAllComponents } from './components';
import { registerAllBlocks } from './blocks';
import { serializeToGjs, type GjsProjectData } from './serialization/serialize';
import { deserializeFromGjs } from './serialization/deserialize';
import { type PortalTraitType } from './traits';
import { OptionsTraitEditor } from './traits/options-trait';
import { EntitySelectTraitEditor } from './traits/entity-select-trait';
import { WorkflowTraitEditor } from './traits/workflow-trait';
import { ZoneDiagramTraitEditor } from './traits/zone-diagram-trait';
import { EntityInfoPanel } from './panels/entity-info-panel';
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
}

interface PortalTarget {
  container: HTMLElement;
  type: PortalTraitType;
  propName: string;
  traitId: string;
}

export default function EntityEditor({ entity, onSave, onCancel }: EntityEditorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const editorRef = useRef<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [rightTab, setRightTab] = useState<'traits' | 'info' | 'automations'>('traits');
  const [portalTargets, setPortalTargets] = useState<PortalTarget[]>([]);
  const selectedComponentRef = useRef<GjsComponent | null>(null);
  const [, forceUpdate] = useState(0);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [fieldCount, setFieldCount] = useState(entity.fields?.length || 0);

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

  // Handler para quando um campo e selecionado na modal
  const handleFieldPickerSelect = useCallback((fieldType: string, label: string) => {
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

    // Criar nova row com o campo
    const rows = wrapper.append({
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
    });

    const addedField = rows?.[0]?.components()?.at(0)?.components()?.at(0);
    if (addedField) {
      editor.select(addedField);
    }
  }, []);

  // Scan the traits panel DOM for portal containers
  const scanForPortals = useCallback(() => {
    const containers = document.querySelectorAll('.crm-trait-portal');
    const targets: PortalTarget[] = [];
    containers.forEach((el) => {
      const type = el.getAttribute('data-trait-portal') as PortalTraitType;
      const propName = el.getAttribute('data-trait-prop') || '';
      const traitId = el.getAttribute('data-trait-id') || '';
      if (type && propName) {
        targets.push({ container: el as HTMLElement, type, propName, traitId });
      }
    });
    setPortalTargets(targets);
  }, []);

  const handleEditorInit = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Registrar components e blocks
    registerAllComponents(editor);
    registerAllBlocks(editor);

    // ─── Injetar CSS direto no iframe do canvas ───────────────────────
    const injectCss = () => {
      const frame = editor.Canvas.getFrameEl();
      if (!frame) return;
      const doc = frame.contentDocument;
      if (!doc) return;
      // Remover estilo anterior se existir
      const existing = doc.getElementById('crm-canvas-styles');
      if (existing) existing.remove();
      const style = doc.createElement('style');
      style.id = 'crm-canvas-styles';
      style.textContent = getCanvasCss(isDark);
      doc.head.appendChild(style);
    };

    // Injetar apos o canvas carregar
    editor.on('canvas:frame:load', injectCss);
    // Tambem tentar injetar agora (caso o frame ja esteja pronto)
    setTimeout(injectCss, 200);

    // Carregar dados da entidade
    const projectData = serializeToGjs(entity.fields || []);
    editor.loadProjectData(projectData);
    setTimeout(updateFieldCount, 100);

    // ─── Track selected component for portals ───────────────────────
    editor.on('component:selected', (component: GjsComponent) => {
      selectedComponentRef.current = component;
      // Auto-switch to traits tab when selecting a field
      if (component.get('type')?.startsWith('crm-field')) {
        setRightTab('traits');
      }
      setTimeout(() => scanForPortals(), 80);
    });

    editor.on('component:deselected', () => {
      selectedComponentRef.current = null;
      setPortalTargets([]);
    });

    editor.on('trait:custom', () => {
      setTimeout(() => scanForPortals(), 80);
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
      const newColSpan = Math.min(12, Math.max(1,
        Math.round((rect.w + GRID_GAP) / (colWidth + GRID_GAP)),
      ));

      syncCellLayout(cell, newColSpan);

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
  }, [entity, isDark, scanForPortals, updateFieldCount]);

  // MutationObserver to detect portal containers appearing in the traits panel
  useEffect(() => {
    const traitsContainer = document.querySelector('.traits-container');
    if (!traitsContainer) return;

    const observer = new MutationObserver(() => {
      if (selectedComponentRef.current) {
        scanForPortals();
      }
    });

    observer.observe(traitsContainer, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [scanForPortals]);

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

  // ─── Portal rendering helpers ─────────────────────────────────────

  const getComponentProp = (prop: string): string => {
    return (selectedComponentRef.current?.get(prop) as string) || '';
  };

  const setComponentProp = (prop: string, value: string) => {
    const comp = selectedComponentRef.current;
    if (!comp) return;
    comp.set(prop, value);
    comp.trigger(`change:${prop}`);
    forceUpdate((n) => n + 1);
  };

  function renderTraitPortal(target: PortalTarget) {
    const comp = selectedComponentRef.current;
    if (!comp) return null;

    switch (target.type) {
      case 'crm-options-editor':
        return (
          <OptionsTraitEditor
            value={getComponentProp(target.propName)}
            onChange={(v) => setComponentProp(target.propName, v)}
          />
        );

      case 'crm-entity-select': {
        const isSubEntity = target.propName === 'fieldSubEntityId';
        const slugProp = isSubEntity ? 'fieldSubEntitySlug' : 'fieldRelatedEntitySlug';
        const displayProp = isSubEntity ? 'fieldParentDisplayField' : 'fieldDisplayField';

        return (
          <EntitySelectTraitEditor
            entityIdValue={getComponentProp(target.propName)}
            entitySlugValue={getComponentProp(slugProp)}
            displayFieldValue={getComponentProp(displayProp)}
            onChangeEntityId={(v) => setComponentProp(target.propName, v)}
            onChangeEntitySlug={(v) => setComponentProp(slugProp, v)}
            onChangeDisplayField={(v) => setComponentProp(displayProp, v)}
          />
        );
      }

      case 'crm-workflow-editor':
        return (
          <WorkflowTraitEditor
            value={getComponentProp(target.propName)}
            onChange={(v) => setComponentProp(target.propName, v)}
          />
        );

      case 'crm-zone-diagram-editor':
        return (
          <ZoneDiagramTraitEditor
            imageValue={getComponentProp('fieldDiagramImage')}
            zonesValue={getComponentProp('fieldDiagramZones')}
            saveModeValue={getComponentProp('fieldDiagramSaveMode')}
            onChangeImage={(v) => setComponentProp('fieldDiagramImage', v)}
            onChangeZones={(v) => setComponentProp('fieldDiagramZones', v)}
            onChangeSaveMode={(v) => setComponentProp('fieldDiagramSaveMode', v)}
          />
        );

      default:
        return null;
    }
  }

  // Get current fields for the automations panel (deserialized from canvas)
  const getCurrentFields = useCallback((): EntityField[] => {
    if (!editorRef.current) return entity.fields || [];
    try {
      const projectData = editorRef.current.getProjectData() as unknown as GjsProjectData;
      return deserializeFromGjs(projectData);
    } catch {
      return entity.fields || [];
    }
  }, [entity.fields]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <style>{editorStyles}</style>

      {/* Toolbar superior */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{entityName}</h1>
            <span className="text-xs text-muted-foreground">{entity.slug}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editorRef.current?.runCommand('core:undo')}
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editorRef.current?.runCommand('core:redo')}
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
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

          <span className="text-xs text-muted-foreground hidden md:inline">
            {fieldCount} campos
          </span>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Layout principal: Blocks | Canvas | Traits/Info/Automations */}
      <div className="flex-1 flex overflow-hidden">
        {/* Painel esquerdo - Blocos + Botao de adicionar */}
        <div className="w-64 border-r bg-card overflow-y-auto flex-shrink-0">
          <div className="p-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 mb-3"
              onClick={() => setFieldPickerOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Adicionar Campo
            </Button>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <Columns3 className="h-4 w-4" />
              Arraste para o canvas
            </h2>
          </div>
          <div className="blocks-container" />
        </div>

        {/* Canvas central */}
        <div className="flex-1 overflow-hidden bg-muted">
          <GjsEditor
            grapesjs={grapesjs}
            options={createEditorConfig('.gjs-editor-container')}
            onEditor={handleEditorInit}
          >
            <Canvas className="h-full" />
          </GjsEditor>
        </div>

        {/* Painel direito - Traits / Info / Automations */}
        <div className="w-80 border-l bg-card overflow-y-auto flex-shrink-0">
          <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as typeof rightTab)}>
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="traits" className="flex-1 text-xs gap-1">
                <Columns3 className="h-3 w-3" />
                Propriedades
              </TabsTrigger>
              <TabsTrigger value="info" className="flex-1 text-xs gap-1">
                <Info className="h-3 w-3" />
                Info
              </TabsTrigger>
              <TabsTrigger value="automations" className="flex-1 text-xs gap-1">
                <Zap className="h-3 w-3" />
                Automacoes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="traits" className="m-0">
              <div className="traits-container" />
            </TabsContent>

            <TabsContent value="info" className="m-0 p-3">
              <EntityInfoPanel
                name={entityName}
                slug={entity.slug}
                description={entityDescription}
                settings={entitySettings}
                onChangeName={setEntityName}
                onChangeDescription={setEntityDescription}
                onChangeSettings={setEntitySettings}
              />
            </TabsContent>

            <TabsContent value="automations" className="m-0 p-3">
              <AutomationTab
                entityId={entity.id}
                fields={getCurrentFields()}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* React Portals for custom trait editors */}
      {portalTargets.map((target) =>
        createPortal(
          <div key={target.traitId}>{renderTraitPortal(target)}</div>,
          target.container,
        ),
      )}

      {/* Modal de selecao de campos */}
      <FieldPickerModal
        open={fieldPickerOpen}
        onClose={() => setFieldPickerOpen(false)}
        onSelect={handleFieldPickerSelect}
      />
    </div>
  );
}
