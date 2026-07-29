'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowLeft, Save, Loader2, Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Entity, EntityField, EntitySettings } from '@crm-builder/shared';
import { RecordFormFields } from '@/components/data/record-form-dialog';
import { FieldPickerModal } from './panels/field-picker-modal';
import { OptionsTraitEditor } from './traits/options-trait';
import { AutoFillTraitEditor } from './traits/autofill-trait';
import { WorkflowTraitEditor } from './traits/workflow-trait';
import { ZoneDiagramTraitEditor } from './traits/zone-diagram-trait';

// Tipos que sempre ocupam a linha inteira (espelha o runtime record-form).
export const FULL_WIDTH_TYPES = new Set(['sub-entity', 'zone-diagram', 'section-title']);
const TYPES_WITH_OPTIONS = new Set(['select', 'multiselect', 'checkbox-group', 'radio-group', 'tags']);
const NUMERIC_TYPES = new Set(['number', 'currency', 'percentage', 'slider', 'rating']);
const AUTOFILL_TYPES = new Set(['relation', 'api-select']);

// Lista achatada de tipos para o seletor (label PT-BR).
const FIELD_TYPES: Array<{ value: string; label: string }> = [
  { value: 'text', label: 'Texto' }, { value: 'textarea', label: 'Área de texto' },
  { value: 'richtext', label: 'Texto rico' }, { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' }, { value: 'password', label: 'Senha' },
  { value: 'array', label: 'Lista de textos' }, { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moeda' }, { value: 'percentage', label: 'Porcentagem' },
  { value: 'slider', label: 'Slider' }, { value: 'rating', label: 'Avaliação' },
  { value: 'phone', label: 'Telefone' }, { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' }, { value: 'cep', label: 'CEP' },
  { value: 'date', label: 'Data' }, { value: 'datetime', label: 'Data e hora' },
  { value: 'time', label: 'Hora' }, { value: 'boolean', label: 'Sim/Não' },
  { value: 'select', label: 'Seleção única' }, { value: 'multiselect', label: 'Seleção múltipla' },
  { value: 'checkbox-group', label: 'Grupo checkbox' }, { value: 'radio-group', label: 'Grupo radio' },
  { value: 'tags', label: 'Tags' }, { value: 'color', label: 'Cor' },
  { value: 'relation', label: 'Relação' }, { value: 'sub-entity', label: 'Sub-entidade' },
  { value: 'lookup', label: 'Lookup' },
  { value: 'api-select', label: 'API Select' }, { value: 'user-select', label: 'Seleção usuário' },
  { value: 'file', label: 'Arquivo' }, { value: 'image', label: 'Imagem' },
  { value: 'signature', label: 'Assinatura' },
  { value: 'workflow-status', label: 'Status workflow' }, { value: 'timer', label: 'Cronômetro' },
  { value: 'sla-status', label: 'Status SLA' }, { value: 'action-button', label: 'Botão de ação' },
  { value: 'formula', label: 'Fórmula' }, { value: 'rollup', label: 'Rollup' },
  { value: 'section-title', label: 'Título de seção' }, { value: 'map', label: 'Mapa' },
  { value: 'zone-diagram', label: 'Diagrama de zonas' }, { value: 'json', label: 'JSON' },
  { value: 'hidden', label: 'Oculto' },
];

interface ReactFormBuilderProps {
  entity: Entity;
  onSave: (data: {
    name: string;
    description?: string;
    fields: EntityField[];
    settings?: EntitySettings;
  }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}

function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function uniqueSlug(label: string, fields: EntityField[]): string {
  const base = slugify(label) || 'campo';
  const taken = new Set(fields.map((f) => f.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

// ─── Cartão de campo arrastável (dnd-kit) renderizando o componente REAL ──────
function SortableFieldCard({
  field,
  entity,
  isSelected,
  onSelect,
  onDelete,
}: {
  field: EntityField;
  entity: Entity;
  isSelected: boolean;
  onSelect: (slug: string) => void;
  onDelete: (slug: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.slug,
  });
  const colSpan = FULL_WIDTH_TYPES.has(field.type) ? 12 : field.gridColSpan || 12;
  const singleFieldEntity = {
    ...entity,
    fields: [{ ...field, gridColSpan: 12, gridColStart: undefined }],
  } as Entity;

  return (
    <div
      ref={setNodeRef}
      style={{
        gridColumn: `span ${colSpan}`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={() => onSelect(field.slug)}
      className={cn(
        'relative rounded-md border-2 p-2 pt-6 cursor-pointer transition-colors',
        isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-1 left-1 z-10 p-0.5 rounded text-muted-foreground cursor-grab active:cursor-grabbing hover:bg-muted"
        title="Arraste para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="pointer-events-none">
        <RecordFormFields entity={singleFieldEntity} hideFooter />
      </div>
      {isSelected && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 bg-background/80 text-destructive z-10"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(field.slug);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Painel de propriedades (EntityField puro, mesmos props do runtime) ───────
export function FieldProperties({
  field,
  allFields,
  onChange,
}: {
  field: EntityField;
  allFields: EntityField[];
  onChange: (patch: Partial<EntityField>) => void;
}) {
  const isFullWidth = FULL_WIDTH_TYPES.has(field.type);
  const num = (v: string) => (v === '' ? undefined : Number(v));

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-[11px] uppercase text-muted-foreground tracking-wide">{field.type}</p>
        <p className="font-medium">{field.label || field.name || field.slug}</p>
      </div>

      {/* Geral */}
      <div className="space-y-1.5">
        <Label>Rótulo</Label>
        <Input
          value={field.label || field.name || ''}
          onChange={(e) => onChange({ label: e.target.value, name: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <select
          className="w-full h-9 rounded-md border bg-background px-2"
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as EntityField['type'] })}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {field.type !== 'section-title' && (
        <div className="space-y-1.5">
          <Label>Placeholder</Label>
          <Input value={field.placeholder || ''} onChange={(e) => onChange({ placeholder: e.target.value })} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Texto de ajuda</Label>
        <Input value={field.helpText || ''} onChange={(e) => onChange({ helpText: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <Label>Largura (colunas de 12)</Label>
        <select
          className="w-full h-9 rounded-md border bg-background px-2 disabled:opacity-50"
          value={isFullWidth ? 12 : field.gridColSpan || 12}
          disabled={isFullWidth}
          onChange={(e) => onChange({ gridColSpan: Number(e.target.value) })}
        >
          {[3, 4, 6, 8, 9, 12].map((n) => (
            <option key={n} value={n}>{n} / 12</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Obrigatório</Label>
        <Switch checked={!!field.required} onCheckedChange={(v) => onChange({ required: v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Único</Label>
        <Switch checked={!!field.unique} onCheckedChange={(v) => onChange({ unique: v })} />
      </div>

      {/* Opções (select/multiselect/radio/checkbox/tags) */}
      {TYPES_WITH_OPTIONS.has(field.type) && (
        <div className="space-y-1.5 border-t pt-3">
          <Label>Opções</Label>
          <OptionsTraitEditor
            value={JSON.stringify(field.options || [])}
            onChange={(v) => {
              try {
                onChange({ options: JSON.parse(v) });
              } catch { /* json inválido, ignora */ }
            }}
          />
        </div>
      )}

      {/* Numéricos */}
      {NUMERIC_TYPES.has(field.type) && (
        <div className="grid grid-cols-3 gap-2 border-t pt-3">
          <div className="space-y-1"><Label>Mín</Label><Input type="number" value={field.min ?? ''} onChange={(e) => onChange({ min: num(e.target.value) })} /></div>
          <div className="space-y-1"><Label>Máx</Label><Input type="number" value={field.max ?? ''} onChange={(e) => onChange({ max: num(e.target.value) })} /></div>
          <div className="space-y-1"><Label>Passo</Label><Input type="number" value={field.step ?? ''} onChange={(e) => onChange({ step: num(e.target.value) })} /></div>
        </div>
      )}

      {/* Relation */}
      {field.type === 'relation' && (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1"><Label>Entidade relacionada (slug)</Label><Input value={field.relatedEntitySlug || ''} onChange={(e) => onChange({ relatedEntitySlug: e.target.value })} /></div>
          <div className="space-y-1"><Label>Campo de exibição</Label><Input value={field.relatedDisplayField || ''} onChange={(e) => onChange({ relatedDisplayField: e.target.value })} /></div>
        </div>
      )}

      {/* API select */}
      {field.type === 'api-select' && (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1"><Label>Endpoint</Label><Input value={field.apiEndpoint || ''} placeholder="/corretores" onChange={(e) => onChange({ apiEndpoint: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Campo valor</Label><Input value={field.valueField || ''} placeholder="id" onChange={(e) => onChange({ valueField: e.target.value })} /></div>
            <div className="space-y-1"><Label>Campo label</Label><Input value={field.labelField || ''} placeholder="name" onChange={(e) => onChange({ labelField: e.target.value })} /></div>
          </div>
        </div>
      )}

      {/* Autofill (relation/api-select) */}
      {AUTOFILL_TYPES.has(field.type) && (
        <div className="space-y-1.5 border-t pt-3">
          <Label>Auto-preenchimento</Label>
          <AutoFillTraitEditor
            value={JSON.stringify(field.autoFillFields || [])}
            targetFields={allFields
              .filter((f) => f.slug !== field.slug)
              .map((f) => ({ slug: f.slug, label: f.label || f.name || f.slug }))}
            sourceFieldsJson={JSON.stringify(field.apiFields || [])}
            onChange={(v) => {
              try {
                onChange({ autoFillFields: JSON.parse(v) });
              } catch { /* ignora */ }
            }}
          />
        </div>
      )}

      {/* Sub-entity */}
      {field.type === 'sub-entity' && (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1"><Label>Sub-entidade (slug)</Label><Input value={field.subEntitySlug || ''} onChange={(e) => onChange({ subEntitySlug: e.target.value })} /></div>
          <div className="space-y-1"><Label>Campo pai de exibição</Label><Input value={field.parentDisplayField || ''} onChange={(e) => onChange({ parentDisplayField: e.target.value })} /></div>
        </div>
      )}

      {/* Map */}
      {field.type === 'map' && (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label>Modo</Label>
            <select className="w-full h-9 rounded-md border bg-background px-2" value={field.mapMode || 'both'} onChange={(e) => onChange({ mapMode: e.target.value as EntityField['mapMode'] })}>
              <option value="both">Endereço + Mapa</option>
              <option value="latlng">Lat/Lng</option>
              <option value="address">Apenas endereço</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Altura (px)</Label><Input type="number" value={field.mapHeight ?? ''} onChange={(e) => onChange({ mapHeight: num(e.target.value) })} /></div>
            <div className="space-y-1"><Label>Zoom</Label><Input type="number" value={field.mapDefaultZoom ?? ''} onChange={(e) => onChange({ mapDefaultZoom: num(e.target.value) })} /></div>
          </div>
        </div>
      )}

      {/* Image / File */}
      {(field.type === 'image' || field.type === 'file') && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between"><Label>Múltiplos</Label><Switch checked={!!field.multiple} onCheckedChange={(v) => onChange({ multiple: v })} /></div>
          <div className="space-y-1"><Label>Máx. arquivos</Label><Input type="number" value={field.maxFiles ?? ''} onChange={(e) => onChange({ maxFiles: num(e.target.value) })} /></div>
          {field.type === 'image' && (
            <div className="space-y-1">
              <Label>Fonte</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2" value={field.imageSource || 'both'} onChange={(e) => onChange({ imageSource: e.target.value as EntityField['imageSource'] })}>
                <option value="both">Câmera e Galeria</option>
                <option value="camera">Apenas Câmera</option>
                <option value="gallery">Apenas Galeria</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Workflow-status: editor visual de status */}
      {field.type === 'workflow-status' && (
        <div className="space-y-2 border-t pt-3">
          <Label>Status do workflow</Label>
          <WorkflowTraitEditor
            value={JSON.stringify(field.workflowConfig || {})}
            onChange={(v) => {
              try {
                onChange({ workflowConfig: JSON.parse(v) });
              } catch { /* ignora */ }
            }}
          />
        </div>
      )}

      {/* Zone-diagram: editor visual de zonas sobre a imagem */}
      {field.type === 'zone-diagram' && (
        <div className="space-y-2 border-t pt-3">
          <Label>Diagrama de zonas</Label>
          <ZoneDiagramTraitEditor
            imageValue={field.diagramImage || ''}
            zonesValue={JSON.stringify(field.diagramZones || [])}
            saveModeValue={field.diagramSaveMode || 'object'}
            onChangeImage={(v) => onChange({ diagramImage: v })}
            onChangeZones={(v) => {
              try {
                onChange({ diagramZones: JSON.parse(v) });
              } catch { /* ignora */ }
            }}
            onChangeSaveMode={(v) => onChange({ diagramSaveMode: v as EntityField['diagramSaveMode'] })}
          />
        </div>
      )}

      {/* Configuração avançada por tipo (JSON) — paridade com o editor antigo */}
      {CONFIG_PROP_BY_TYPE[field.type] && (
        <div className="border-t pt-3">
          <JsonRow field={field} propKey={CONFIG_PROP_BY_TYPE[field.type]} label="Configuração (JSON)" onChange={onChange} />
        </div>
      )}

      {/* Regras condicionais (JSON) */}
      <div className="space-y-2 border-t pt-3">
        <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Regras condicionais</p>
        <JsonRow field={field} propKey="visibleIf" label="Visível se (JSON)" onChange={onChange} />
        <JsonRow field={field} propKey="requiredIf" label="Obrigatório se (JSON)" onChange={onChange} />
        <JsonRow field={field} propKey="readOnlyIf" label="Somente leitura se (JSON)" onChange={onChange} />
      </div>

      {/* Valor padrão */}
      {!isFullWidth && (
        <div className="space-y-1.5 border-t pt-3">
          <Label>Valor padrão</Label>
          <Textarea
            rows={2}
            value={field.default == null ? '' : String(field.default)}
            onChange={(e) => onChange({ default: e.target.value || undefined })}
          />
        </div>
      )}
    </div>
  );
}

// Tipo → prop de configuração (objeto). Editamos como JSON (igual ao editor antigo
// fazia p/ a maioria), garantindo que nada se perde ao aposentar o GrapeJS.
const CONFIG_PROP_BY_TYPE: Record<string, keyof EntityField> = {
  timer: 'timerConfig',
  'sla-status': 'slaConfig',
  signature: 'signatureConfig',
  lookup: 'lookupConfig',
  formula: 'formulaConfig',
  rollup: 'rollupConfig',
  'action-button': 'actionButtonConfig',
  'user-select': 'userSelectConfig',
  'checkbox-group': 'checkboxGroupConfig',
  'radio-group': 'radioGroupConfig',
  tags: 'tagsConfig',
};

// Editor de um prop como JSON (não-controlado: parse só no blur p/ não brigar com a digitação).
function JsonRow({
  field,
  propKey,
  label,
  onChange,
}: {
  field: EntityField;
  propKey: keyof EntityField;
  label: string;
  onChange: (patch: Partial<EntityField>) => void;
}) {
  const raw = (field as unknown as Record<string, unknown>)[propKey as string];
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea
        key={`${field.slug}:${String(propKey)}`}
        rows={3}
        className="font-mono text-[11px]"
        defaultValue={raw == null ? '' : JSON.stringify(raw, null, 2)}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (!v) {
            onChange({ [propKey]: undefined } as Partial<EntityField>);
            return;
          }
          try {
            onChange({ [propKey]: JSON.parse(v) } as Partial<EntityField>);
          } catch {
            /* JSON inválido — mantém o que estava, não sobrescreve */
          }
        }}
      />
    </div>
  );
}

/**
 * Builder de formulário/entidade que renderiza os COMPONENTES REAIS no canvas
 * (igual ao dashboard), com dnd-kit p/ reordenar e propriedades por tipo sobre
 * EntityField puro. Variante dnd-kit (a grid é o default); ?editor=dnd ativa esta.
 */
export default function ReactFormBuilder({ entity, onSave, onCancel }: ReactFormBuilderProps) {
  const [fields, setFields] = useState<EntityField[]>(entity.fields || []);
  const [name, setName] = useState(entity.name);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const selected = fields.find((f) => f.slug === selectedSlug) || null;
  const visibleFields = fields.filter((f) => f.type !== 'hidden' && !f.hidden);

  const updateSelected = (patch: Partial<EntityField>) => {
    if (!selectedSlug) return;
    setFields((prev) => prev.map((f) => (f.slug === selectedSlug ? { ...f, ...patch } : f)));
  };

  const deleteField = (slug: string) => {
    setFields((prev) => prev.filter((f) => f.slug !== slug));
    if (selectedSlug === slug) setSelectedSlug(null);
  };

  const addField = (fieldType: string, label: string) => {
    const slug = uniqueSlug(label, fields);
    const nf = { slug, name: label, label, type: fieldType, gridColSpan: 12 } as EntityField;
    setFields((prev) => [...prev, nf]);
    setSelectedSlug(slug);
    setPickerOpen(false);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const visible = fields.filter((f) => f.type !== 'hidden' && !f.hidden);
    const hidden = fields.filter((f) => f.type === 'hidden' || f.hidden);
    const oldIdx = visible.findIndex((f) => f.slug === active.id);
    const newIdx = visible.findIndex((f) => f.slug === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setFields([...arrayMove(visible, oldIdx, newIdx), ...hidden]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, description: entity.description, fields, settings: entity.settings });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="h-14 border-b bg-card flex items-center px-2 sm:px-4 gap-2 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-sm font-semibold bg-transparent border-none outline-none focus:ring-1 focus:ring-ring rounded px-2 py-1 max-w-[260px]"
        />
        <span className="text-xs text-muted-foreground mr-auto">Editor de campos (beta)</span>
        <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Campo</span>
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 sm:mr-1.5 animate-spin" /> : <Save className="h-4 w-4 sm:mr-1.5" />}
          <span className="hidden sm:inline">Salvar</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas: componentes reais + dnd reorder */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/30">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleFields.map((f) => f.slug)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-12 gap-4 max-w-4xl mx-auto bg-card p-6 rounded-lg border">
                {visibleFields.length === 0 && (
                  <p className="col-span-12 text-center text-sm text-muted-foreground py-10">
                    Nenhum campo ainda. Clique em &quot;Campo&quot; para adicionar.
                  </p>
                )}
                {visibleFields.map((field) => (
                  <SortableFieldCard
                    key={field.slug}
                    field={field}
                    entity={entity}
                    isSelected={selectedSlug === field.slug}
                    onSelect={setSelectedSlug}
                    onDelete={deleteField}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Propriedades por tipo (EntityField puro) */}
        <div className="w-72 lg:w-80 border-l bg-card flex-shrink-0 overflow-y-auto p-4">
          {selected ? (
            <FieldProperties field={selected} allFields={fields} onChange={updateSelected} />
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um campo no canvas para editar.</p>
          )}
        </div>
      </div>

      <FieldPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addField} />
    </div>
  );
}
