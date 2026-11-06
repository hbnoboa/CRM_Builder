'use client';

import { useEffect, useRef, useState } from 'react';
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
import { useEntities } from '@/hooks/use-entities';
import { withoutSystemFields } from '@/lib/system-fields';
import { FIELD_GROUPS, FIELD_KINDS, fieldKind } from '@/lib/field-catalog';
import { OptionsTraitEditor } from './traits/options-trait';
import { AutoFillTraitEditor } from './traits/autofill-trait';
import { WorkflowTraitEditor } from './traits/workflow-trait';
import { ZoneDiagramTraitEditor } from './traits/zone-diagram-trait';

// Tipos que sempre ocupam a linha inteira (espelha o runtime record-form).
export const FULL_WIDTH_TYPES = new Set(['sub-entity', 'zone-diagram', 'section-title']);
const TYPES_WITH_OPTIONS = new Set(['select', 'multiselect', 'checkbox-group', 'radio-group', 'tags']);
const NUMERIC_TYPES = new Set(['number', 'currency', 'percentage', 'slider', 'rating']);
const AUTOFILL_TYPES = new Set(['relation', 'api-select']);

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
  currentEntitySlug,
  autoFocusName,
}: {
  field: EntityField;
  allFields: EntityField[];
  onChange: (patch: Partial<EntityField>) => void;
  currentEntitySlug?: string;
  /** Campo recem-adicionado: ja deixa o nome selecionado para renomear. */
  autoFocusName?: boolean;
}) {
  const isFullWidth = FULL_WIDTH_TYPES.has(field.type);
  const num = (v: string) => (v === '' ? undefined : Number(v));
  const kind = fieldKind(field.type);
  const KindIcon = kind.icon;
  const { data: entitiesPage } = useEntities({ limit: 200 });
  const otherTables = (entitiesPage?.data || []).filter((e) => e.slug !== currentEntitySlug);
  const pickTable = (slug: string) => otherTables.find((e) => e.slug === slug);
  const span = isFullWidth ? 12 : field.gridColSpan || 12;
  const nameRef = useRef<HTMLInputElement>(null);
  // Depois que o seletor fecha (ele devolve o foco ao botao), seleciona o nome para renomear.
  useEffect(() => {
    if (!autoFocusName) return;
    const id = setTimeout(() => { nameRef.current?.focus(); nameRef.current?.select(); }, 250);
    return () => clearTimeout(id);
  }, [autoFocusName]);

  return (
    <div className="space-y-4 text-sm" data-testid="field-properties">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-nav-active text-nav-active-foreground">
          <KindIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{field.label || field.name || field.slug}</p>
          <p className="truncate text-xs text-muted-foreground">{kind.label}</p>
        </div>
      </div>

      {/* Geral */}
      <div className="space-y-1.5">
        <Label>Nome do campo</Label>
        <Input
          value={field.label || field.name || ''}
          placeholder="Ex.: Placa, Valor do serviço"
          onChange={(e) => onChange({ label: e.target.value, name: e.target.value })}
          data-testid="field-label-input"
          ref={nameRef}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <select
          className="w-full h-9 rounded-md border bg-background px-2"
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as EntityField['type'] })}
        >
          {FIELD_GROUPS.map((g) => (
            <optgroup key={g.key} label={g.label}>
              {FIELD_KINDS.filter((k) => k.group === g.key).map((k) => (
                <option key={k.type} value={k.type}>{k.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {kind.description && <p className="text-xs text-muted-foreground">{kind.description}</p>}
      </div>

      {!isFullWidth && (
        <div className="space-y-1.5">
          <Label>Largura no formulário</Label>
          <div className="grid grid-cols-5 gap-1" role="group" aria-label="Largura">
            {WIDTHS.map((w) => (
              <button
                key={w.span}
                type="button"
                aria-pressed={span === w.span}
                onClick={() => onChange({ gridColSpan: w.span })}
                className={cn(
                  'rounded-md border px-1 py-1.5 text-xs transition-colors',
                  span === w.span ? 'border-primary bg-nav-active font-medium text-nav-active-foreground' : 'hover:bg-muted',
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {field.type !== 'section-title' && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label>Obrigatório</Label>
              <p className="text-xs text-muted-foreground">Não deixa salvar sem preencher.</p>
            </div>
            <Switch checked={!!field.required} onCheckedChange={(v) => onChange({ required: v })} />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label>Não pode repetir</Label>
              <p className="text-xs text-muted-foreground">Dois registros não podem ter o mesmo valor.</p>
            </div>
            <Switch checked={!!field.unique} onCheckedChange={(v) => onChange({ unique: v })} />
          </div>
        </div>
      )}

      {/* Opções (select/multiselect/radio/checkbox/tags) */}
      {TYPES_WITH_OPTIONS.has(field.type) && (
        <div className="space-y-1.5 border-t pt-3">
          <Label>Opções</Label>
          <p className="text-xs text-muted-foreground">Dê uma cor para cada opção: ela aparece nas listas e nos painéis.</p>
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
          <div className="space-y-1"><Label>Mínimo</Label><Input type="number" value={field.min ?? ''} onChange={(e) => onChange({ min: num(e.target.value) })} /></div>
          <div className="space-y-1"><Label>Máximo</Label><Input type="number" value={field.max ?? ''} onChange={(e) => onChange({ max: num(e.target.value) })} /></div>
          <div className="space-y-1"><Label>De quanto em quanto</Label><Input type="number" value={field.step ?? ''} onChange={(e) => onChange({ step: num(e.target.value) })} /></div>
        </div>
      )}

      {/* Ligacao com outra tabela */}
      {field.type === 'relation' && (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label>Escolher registros da tabela</Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2"
              value={field.relatedEntitySlug || ''}
              onChange={(e) => {
                const t = pickTable(e.target.value);
                onChange({ relatedEntitySlug: e.target.value || undefined, relatedEntityId: t?.id, relatedDisplayField: undefined });
              }}
              data-testid="relation-table-select"
            >
              <option value="">Selecione a tabela...</option>
              {otherTables.map((e) => <option key={e.id} value={e.slug}>{e.name}</option>)}
            </select>
          </div>
          {field.relatedEntitySlug && (
            <div className="space-y-1">
              <Label>Mostrar pelo campo</Label>
              <select
                className="w-full h-9 rounded-md border bg-background px-2"
                value={field.relatedDisplayField || ''}
                onChange={(e) => onChange({ relatedDisplayField: e.target.value || undefined })}
              >
                <option value="">Automático (primeiro campo de texto)</option>
                {(pickTable(field.relatedEntitySlug)?.fields || []).map((f) => (
                  <option key={f.slug} value={f.slug}>{f.label || f.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Lista de itens dentro (sub-tabela) */}
      {field.type === 'sub-entity' && (
        <div className="space-y-2 border-t pt-3">
          <div className="space-y-1">
            <Label>Os itens ficam na tabela</Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2"
              value={field.subEntitySlug || ''}
              onChange={(e) => {
                const t = pickTable(e.target.value);
                onChange({ subEntitySlug: e.target.value || undefined, subEntityId: t?.id });
              }}
              data-testid="sub-entity-table-select"
            >
              <option value="">Selecione a tabela...</option>
              {otherTables.map((e) => <option key={e.id} value={e.slug}>{e.name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Crie antes a tabela dos itens (ex.: &quot;Item da OS&quot;) e escolha aqui.</p>
          </div>
          <div className="space-y-1">
            <Label>Nos itens, identificar este registro pelo campo</Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2"
              value={field.parentDisplayField || ''}
              onChange={(e) => onChange({ parentDisplayField: e.target.value || undefined })}
            >
              <option value="">Automático</option>
              {allFields.filter((f) => f.slug !== field.slug && !FULL_WIDTH_TYPES.has(f.type)).map((f) => (
                <option key={f.slug} value={f.slug}>{f.label || f.name}</option>
              ))}
            </select>
          </div>
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

      {/* Valor padrão */}
      {!isFullWidth && !NO_DEFAULT_TYPES.has(field.type) && (
        <div className="space-y-1.5 border-t pt-3">
          <Label>Já vem preenchido com</Label>
          <Textarea
            rows={2}
            value={field.default == null ? '' : String(field.default)}
            onChange={(e) => onChange({ default: e.target.value || undefined })}
          />
        </div>
      )}

      <details className="group rounded-lg border px-3 py-2">
        <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
          Configurações avançadas
        </summary>
        <div className="mt-3 space-y-3">
          {field.type !== 'section-title' && (
            <div className="space-y-1.5">
              <Label>Texto de exemplo dentro do campo</Label>
              <Input value={field.placeholder || ''} onChange={(e) => onChange({ placeholder: e.target.value })} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Dica abaixo do campo</Label>
            <Input value={field.helpText || ''} onChange={(e) => onChange({ helpText: e.target.value })} />
          </div>
          <p className="text-[11px] text-muted-foreground">Código interno: <code>{field.slug}</code></p>
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
        </div>
      </details>
    </div>
  );
}

// Tipos em que "ja vem preenchido" nao faz sentido (arquivo, foto, assinatura...)
const NO_DEFAULT_TYPES = new Set(['image', 'file', 'signature', 'map', 'json', 'action-button', 'timer', 'sla-status', 'formula', 'rollup']);

const WIDTHS = [
  { span: 3, label: '¼' },
  { span: 4, label: '⅓' },
  { span: 6, label: 'Metade' },
  { span: 8, label: '⅔' },
  { span: 12, label: 'Inteira' },
];

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
  const [fields, setFields] = useState<EntityField[]>(() => withoutSystemFields(entity.fields));
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
    <div className="flex flex-col h-full">
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
            <FieldProperties field={selected} allFields={fields} onChange={updateSelected} currentEntitySlug={entity.slug} />
          ) : (
            <p className="text-sm text-muted-foreground">Selecione um campo no canvas para editar.</p>
          )}
        </div>
      </div>

      <FieldPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addField} />
    </div>
  );
}
