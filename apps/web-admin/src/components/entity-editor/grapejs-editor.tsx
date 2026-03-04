'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GjsEditor, { Canvas } from '@grapesjs/react';
import grapesjs, { type Editor, type Component as GjsComponent } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import { useTheme } from 'next-themes';
import { Save, Loader2, Undo2, Redo2, Trash2, ArrowLeft, Info, Zap, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { Entity, EntityField, EntitySettings } from '@crm-builder/shared';

import { createEditorConfig } from './config/editor-config';
import { editorStyles } from './config/theme';
import { registerAllComponents } from './components';
import { registerAllBlocks } from './blocks';
import { serializeToGjs } from './serialization/serialize';
import { deserializeFromGjs } from './serialization/deserialize';
import { type PortalTraitType } from './traits';
import { OptionsTraitEditor } from './traits/options-trait';
import { EntitySelectTraitEditor } from './traits/entity-select-trait';
import { WorkflowTraitEditor } from './traits/workflow-trait';
import { EntityInfoPanel } from './panels/entity-info-panel';
import { AutomationTab } from '@/components/entity-automation/automation-tab';

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

  // Editable entity info
  const [entityName, setEntityName] = useState(entity.name);
  const [entityDescription, setEntityDescription] = useState(entity.description || '');
  const [entitySettings, setEntitySettings] = useState<EntitySettings>(entity.settings || {});

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

    // Carregar dados da entidade
    const projectData = serializeToGjs(entity.fields || []);
    editor.loadProjectData(projectData);

    // ─── Track selected component for portals ───────────────────────
    editor.on('component:selected', (component: GjsComponent) => {
      selectedComponentRef.current = component;
      setTimeout(() => scanForPortals(), 80);
    });

    editor.on('component:deselected', () => {
      selectedComponentRef.current = null;
      setPortalTargets([]);
    });

    editor.on('trait:custom', () => {
      setTimeout(() => scanForPortals(), 80);
    });

    // ─── Auto-wrap: campo solto fora de grid-cell ─────────────────────
    editor.on('component:add', (component: GjsComponent) => {
      const type = component.get('type') || '';
      if (!type.startsWith('crm-field')) return;

      const parent = component.parent();
      if (!parent) return;
      const parentType = parent.get('type');

      if (parentType === 'grid-cell') return;

      if (parentType === 'grid-row') {
        const fieldJson = component.toJSON();
        component.remove();

        const existingCells = parent.components().filter(
          (c: GjsComponent) => c.get('type') === 'grid-cell',
        );
        const cellCount = existingCells.length + 1;
        const newSpan = Math.max(1, Math.floor(12 / cellCount));

        existingCells.forEach((cell: GjsComponent) => {
          cell.set('colSpan', newSpan);
          cell.setClass(['grid-cell', `col-span-${newSpan}`]);
        });

        const lastCellSpan = 12 - newSpan * existingCells.length;

        const newCells = parent.append({
          type: 'grid-cell',
          colSpan: lastCellSpan > 0 ? lastCellSpan : newSpan,
          attributes: { class: `grid-cell col-span-${lastCellSpan > 0 ? lastCellSpan : newSpan}` },
          components: [fieldJson],
        });

        const addedField = newCells?.[0]?.components()?.at(0);
        if (addedField) editor.select(addedField);
        return;
      }

      // Caso 1: solto no wrapper (root) ou qualquer outro lugar
      const fieldJson = component.toJSON();
      component.remove();

      const wrapper = editor.getWrapper();
      if (!wrapper) return;

      const rows = wrapper.append({
        type: 'grid-row',
        components: [{
          type: 'grid-cell',
          colSpan: 12,
          attributes: { class: 'grid-cell col-span-12' },
          components: [fieldJson],
        }],
      });

      const addedField = rows?.[0]?.components()?.at(0)?.components()?.at(0);
      if (addedField) editor.select(addedField);
    });

    // Atalhos de teclado
    editor.Keymaps.add('save', 'ctrl+s', () => handleSave());
    editor.Keymaps.add('duplicate', 'ctrl+d', () => {
      const selected = editor.getSelected();
      if (selected?.get('type')?.startsWith('crm-field')) {
        const parent = selected.parent();
        if (parent) {
          const cloned = selected.clone();
          const baseName = cloned.get('fieldName') || 'campo';
          cloned.set('fieldName', `${baseName}_copy`);
          cloned.set('fieldLabel', `${cloned.get('fieldLabel') || ''} (copia)`);
          parent.append(cloned);
          editor.select(cloned);
        }
      }
    });
  }, [entity, scanForPortals]);

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
      const projectData = editorRef.current.getProjectData();
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

      default:
        return null;
    }
  }

  // Get current fields for the automations panel (deserialized from canvas)
  const getCurrentFields = useCallback((): EntityField[] => {
    if (!editorRef.current) return entity.fields || [];
    try {
      const projectData = editorRef.current.getProjectData();
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
        {/* Painel esquerdo - Blocos */}
        <div className="w-64 border-r bg-card overflow-y-auto flex-shrink-0">
          <div className="p-3">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
              <Columns3 className="h-4 w-4" />
              Campos
            </h2>
          </div>
          <div className="blocks-container" />
        </div>

        {/* Canvas central */}
        <div className="flex-1 overflow-hidden bg-muted/30">
          <GjsEditor
            grapesjs={grapesjs}
            options={createEditorConfig('.gjs-editor-container', isDark)}
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
              <div className="traits-container p-3" />
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
    </div>
  );
}
