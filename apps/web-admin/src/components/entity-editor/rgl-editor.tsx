'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Loader2, Undo2, Redo2, Trash2, ArrowLeft, Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Entity, EntityField, EntitySettings } from '@crm-builder/shared';

import { useEditorStore } from './store/editor-store';
import { GridCanvas } from './components/grid-canvas';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { EntityInfoPanel } from './panels/entity-info-panel';
import { FieldPropertiesPanel } from './panels/field-properties-panel';
import { FieldPickerModal } from './panels/field-picker-modal';
import { AutomationTab } from '@/components/entity-automation/automation-tab';
import { entityFieldToGjsProps, gjsPropsToEntityField } from './serialization/field-mappers';

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

export default function EntityEditor({ entity, onSave, onCancel }: EntityEditorProps) {
  const [saving, setSaving] = useState(false);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);

  // Store selectors
  const fields = useEditorStore(s => s.fields);
  const entityName = useEditorStore(s => s.entityName);
  const entityDescription = useEditorStore(s => s.entityDescription);
  const entitySettings = useEditorStore(s => s.entitySettings);
  const selectedFieldId = useEditorStore(s => s.selectedFieldId);
  const pendingField = useEditorStore(s => s.pendingField);
  const initialize = useEditorStore(s => s.initialize);
  const selectField = useEditorStore(s => s.selectField);
  const updateField = useEditorStore(s => s.updateField);
  const clearAll = useEditorStore(s => s.clearAll);
  const setPendingField = useEditorStore(s => s.setPendingField);
  const setEntityName = useEditorStore(s => s.setEntityName);
  const setEntityDescription = useEditorStore(s => s.setEntityDescription);
  const setEntitySettings = useEditorStore(s => s.setEntitySettings);

  // Initialize store when entity changes
  useEffect(() => {
    initialize(
      entity.fields || [],
      entity.name,
      entity.description || '',
      entity.settings || {},
    );
    // Only re-initialize when switching to a different entity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id]);

  // Selected field object
  const selectedField = useMemo(
    () => fields.find(f => f.slug === selectedFieldId) || null,
    [fields, selectedFieldId],
  );

  // Save handler — reads latest state from store directly
  const handleSave = useCallback(async () => {
    const state = useEditorStore.getState();

    setSaving(true);
    try {
      const errors: string[] = [];
      const slugs = new Set<string>();

      if (!state.entityName.trim()) {
        errors.push('Nome da entidade e obrigatorio');
      }

      state.fields.forEach((field, index) => {
        if (!field.slug) {
          errors.push(`Campo ${index + 1}: slug e obrigatorio`);
        }
        if (slugs.has(field.slug)) {
          errors.push(`Campo "${field.slug}": slug duplicado`);
        }
        slugs.add(field.slug);
      });

      if (errors.length > 0) {
        toast.error(`Erros na validacao:\n${errors.join('\n')}`);
        return;
      }

      await onSave({
        name: state.entityName,
        description: state.entityDescription,
        fields: state.fields,
        settings: state.entitySettings,
      });
      toast.success('Entidade salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar entidade');
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  // Keyboard shortcuts
  useKeyboardShortcuts({ onSave: handleSave });

  // Field picker → placement mode
  const handleFieldPickerSelect = useCallback((fieldType: string, label: string) => {
    setPendingField({ type: fieldType, label });
    setFieldPickerOpen(false);
  }, [setPendingField]);

  // Handle field click/deselect in canvas
  const handleFieldClick = useCallback((slug: string) => {
    selectField(slug || null);
  }, [selectField]);

  // Get canvas fields for properties panel (autofill, field-rules, etc.)
  const getCanvasFields = useCallback((): Array<{ slug: string; label: string }> => {
    return useEditorStore.getState().fields.map(f => ({
      slug: f.slug,
      label: f.label || f.name || f.slug,
    }));
  }, []);

  // GjsComponent-compatible proxy so FieldPropertiesPanel can use .get()/.set()
  const fieldProxy = useMemo(() => {
    if (!selectedField) return null;
    const gjsProps: Record<string, unknown> = entityFieldToGjsProps(selectedField);
    return {
      get: (key: string) => gjsProps[key],
      set: (key: string, value: unknown) => { gjsProps[key] = value; },
      trigger: () => {},
      _gjsProps: gjsProps,
    };
  }, [selectedField]);

  // When panel calls onPropertyChange, convert GJS props back to EntityField and update store
  const handlePropertyChange = useCallback(() => {
    if (!selectedFieldId || !fieldProxy) return;
    const entityField = gjsPropsToEntityField(fieldProxy._gjsProps, 0);
    updateField(selectedFieldId, entityField);
  }, [selectedFieldId, fieldProxy, updateField]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ─── Toolbar superior ──────────────────────────────────────────── */}
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
            onClick={() => useEditorStore.temporal.getState().undo()}
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => useEditorStore.temporal.getState().redo()}
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
                clearAll();
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

          <div className="w-px h-6 bg-border mx-1" />

          <span className="text-xs text-muted-foreground hidden sm:inline">
            {fields.length} campos
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

      {/* ─── Layout principal: Canvas | Right Panel ────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas central */}
        <div className="flex-1 min-w-0 overflow-y-auto relative">
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
          <GridCanvas onFieldClick={handleFieldClick} />
        </div>

        {/* Painel direito - Propriedades */}
        <div className="w-64 md:w-72 lg:w-80 border-l bg-card flex flex-col flex-shrink-0 min-w-0">
          {/* Header */}
          <div className="px-4 py-2.5 border-b flex-shrink-0">
            {selectedField ? (
              <>
                <p className="text-sm font-medium truncate">
                  {selectedField.label || selectedField.name || 'Campo'}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  {selectedField.slug || '\u2014'}
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
            {selectedField ? (
              <FieldPropertiesPanel
                key={selectedField.slug}
                component={fieldProxy as any}
                entityId={entity.id}
                getCanvasFields={getCanvasFields}
                onPropertyChange={handlePropertyChange}
              />
            ) : (
              <div className="p-4">
                <EntityInfoPanel
                  name={entityName}
                  slug={entity.slug}
                  description={entityDescription}
                  settings={entitySettings}
                  booleanFields={fields.filter(f => f.type === 'boolean').map(f => ({ slug: f.slug, label: f.label || f.name || f.slug }))}
                  onChangeName={setEntityName}
                  onChangeDescription={setEntityDescription}
                  onChangeSettings={setEntitySettings}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Modal de selecao de campos ────────────────────────────────── */}
      <FieldPickerModal
        open={fieldPickerOpen}
        onClose={() => setFieldPickerOpen(false)}
        onSelect={handleFieldPickerSelect}
      />

      {/* ─── Dialog de automacoes ──────────────────────────────────────── */}
      <Dialog open={automationsOpen} onOpenChange={setAutomationsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <AutomationTab
            entityId={entity.id}
            fields={fields}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
