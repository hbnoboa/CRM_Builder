'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Component as GjsComponent } from 'grapesjs';

import { OptionsTraitEditor } from '../traits/options-trait';
import { EntitySelectTraitEditor } from '../traits/entity-select-trait';
import { WorkflowTraitEditor } from '../traits/workflow-trait';
import { ZoneDiagramTraitEditor } from '../traits/zone-diagram-trait';
import { AutoFillTraitEditor, OnChangeAutoFillTraitEditor } from '../traits/autofill-trait';
import { FieldRulesTraitEditor } from '../traits/field-rules-trait';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layout components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        {title}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="px-4 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

function PropSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <Label className="text-xs cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Reusable prop input components (encapsulate local state)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TextPropInput({
  component,
  name,
  label,
  placeholder,
  mono,
  onUpdate,
}: {
  component: GjsComponent;
  name: string;
  label: string;
  placeholder?: string;
  mono?: boolean;
  onUpdate: () => void;
}) {
  const [value, setValue] = useState(
    () => (component.get(name) as string) || '',
  );
  return (
    <PropRow label={label}>
      <Input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          component.set(name, e.target.value);
          component.trigger(`change:${name}`);
        }}
        onBlur={onUpdate}
        className={cn('h-8 text-sm', mono && 'font-mono text-xs')}
        placeholder={placeholder}
      />
    </PropRow>
  );
}

function TextareaPropInput({
  component,
  name,
  label,
  placeholder,
  mono,
  onUpdate,
}: {
  component: GjsComponent;
  name: string;
  label: string;
  placeholder?: string;
  mono?: boolean;
  onUpdate: () => void;
}) {
  const [value, setValue] = useState(
    () => (component.get(name) as string) || '',
  );
  return (
    <PropRow label={label}>
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          component.set(name, e.target.value);
          component.trigger(`change:${name}`);
        }}
        onBlur={onUpdate}
        className={cn(
          'text-sm min-h-[60px] resize-none',
          mono && 'font-mono text-xs',
        )}
        placeholder={placeholder}
        rows={3}
      />
    </PropRow>
  );
}

function NumberPropInput({
  component,
  name,
  label,
  min,
  max,
  placeholder,
  onUpdate,
}: {
  component: GjsComponent;
  name: string;
  label: string;
  min?: number;
  max?: number;
  placeholder?: string;
  onUpdate: () => void;
}) {
  const raw = component.get(name);
  const [value, setValue] = useState(() =>
    raw !== undefined && raw !== '' ? String(raw) : '',
  );
  return (
    <PropRow label={label}>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          const num = e.target.value === '' ? '' : Number(e.target.value);
          component.set(name, num);
          component.trigger(`change:${name}`);
        }}
        onBlur={onUpdate}
        className="h-8 text-sm"
        min={min}
        max={max}
        placeholder={placeholder}
      />
    </PropRow>
  );
}

const NONE_SENTINEL = '__none__';

function SelectPropInput({
  component,
  name,
  label,
  options,
  onUpdate,
}: {
  component: GjsComponent;
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  onUpdate: () => void;
}) {
  const currentValue = (component.get(name) as string) || '';

  // Ensure current value is in options (for custom values)
  const allOptions = currentValue && !options.some((o) => o.value === currentValue)
    ? [...options, { value: currentValue, label: currentValue }]
    : options;

  // Map empty string values to sentinel for Radix Select compatibility
  const mappedOptions = allOptions.map((o) => ({
    value: o.value || NONE_SENTINEL,
    label: o.label,
  }));
  const mappedValue = currentValue || NONE_SENTINEL;

  return (
    <PropRow label={label}>
      <Select
        value={mappedValue}
        onValueChange={(v) => {
          const real = v === NONE_SENTINEL ? '' : v;
          component.set(name, real);
          component.trigger(`change:${name}`);
          onUpdate();
        }}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {mappedOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </PropRow>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Field type options for the type selector
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FIELD_TYPE_GROUPS: Array<{ group: string; types: Array<{ value: string; label: string }> }> = [
  {
    group: 'Texto',
    types: [
      { value: 'text', label: 'Texto' },
      { value: 'textarea', label: 'Area de texto' },
      { value: 'richtext', label: 'Texto rico' },
      { value: 'email', label: 'Email' },
      { value: 'url', label: 'URL' },
      { value: 'password', label: 'Senha' },
      { value: 'array', label: 'Lista de textos' },
    ],
  },
  {
    group: 'Numeros',
    types: [
      { value: 'number', label: 'Numero' },
      { value: 'currency', label: 'Moeda' },
      { value: 'percentage', label: 'Porcentagem' },
      { value: 'slider', label: 'Slider' },
      { value: 'rating', label: 'Avaliacao' },
    ],
  },
  {
    group: 'Contato',
    types: [
      { value: 'phone', label: 'Telefone' },
      { value: 'cpf', label: 'CPF' },
      { value: 'cnpj', label: 'CNPJ' },
      { value: 'cep', label: 'CEP' },
    ],
  },
  {
    group: 'Data/Hora',
    types: [
      { value: 'date', label: 'Data' },
      { value: 'datetime', label: 'Data e hora' },
      { value: 'time', label: 'Hora' },
    ],
  },
  {
    group: 'Selecao',
    types: [
      { value: 'boolean', label: 'Sim/Nao' },
      { value: 'select', label: 'Selecao unica' },
      { value: 'multiselect', label: 'Selecao multipla' },
      { value: 'checkbox-group', label: 'Grupo checkbox' },
      { value: 'radio-group', label: 'Grupo radio' },
      { value: 'tags', label: 'Tags' },
      { value: 'color', label: 'Cor' },
    ],
  },
  {
    group: 'Relacoes',
    types: [
      { value: 'relation', label: 'Relacao' },
      { value: 'sub-entity', label: 'Sub-entidade' },
      { value: 'lookup', label: 'Lookup' },
      { value: 'api-select', label: 'API Select' },
      { value: 'user-select', label: 'Selecao usuario' },
    ],
  },
  {
    group: 'Arquivos',
    types: [
      { value: 'file', label: 'Arquivo' },
      { value: 'image', label: 'Imagem' },
      { value: 'signature', label: 'Assinatura' },
    ],
  },
  {
    group: 'Workflow',
    types: [
      { value: 'workflow-status', label: 'Status workflow' },
      { value: 'timer', label: 'Cronometro' },
      { value: 'sla-status', label: 'Status SLA' },
      { value: 'action-button', label: 'Botao de acao' },
    ],
  },
  {
    group: 'Calculados',
    types: [
      { value: 'formula', label: 'Formula' },
      { value: 'rollup', label: 'Rollup' },
    ],
  },
  {
    group: 'Layout',
    types: [
      { value: 'section-title', label: 'Titulo de secao' },
      { value: 'map', label: 'Mapa' },
      { value: 'zone-diagram', label: 'Diagrama de zona' },
    ],
  },
  {
    group: 'Outros',
    types: [
      { value: 'json', label: 'JSON' },
      { value: 'hidden', label: 'Oculto' },
    ],
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Type-specific trait configs (simple traits only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SimpleTraitConfig {
  name: string;
  label: string;
  control: 'input' | 'number' | 'select' | 'switch' | 'textarea';
  placeholder?: string;
  mono?: boolean;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
}

const TYPE_SIMPLE_TRAITS: Record<string, SimpleTraitConfig[]> = {
  text: [
    { name: 'fieldMaxLength', label: 'Tamanho maximo', control: 'number', min: 1 },
    {
      name: 'fieldTextTransform', label: 'Transformacao', control: 'select',
      options: [
        { value: '', label: 'Nenhuma' },
        { value: 'uppercase', label: 'MAIUSCULAS' },
        { value: 'lowercase', label: 'minusculas' },
        { value: 'titlecase', label: 'Titulo' },
      ],
    },
  ],
  textarea: [
    { name: 'fieldRows', label: 'Linhas', control: 'number', min: 2, max: 20 },
    { name: 'fieldMaxLength', label: 'Tamanho maximo', control: 'number', min: 1 },
  ],
  array: [
    { name: 'fieldMaxItems', label: 'Max itens', control: 'number', min: 1 },
  ],
  number: [
    { name: 'fieldMin', label: 'Minimo', control: 'number' },
    { name: 'fieldMax', label: 'Maximo', control: 'number' },
    { name: 'fieldStep', label: 'Incremento', control: 'number' },
  ],
  currency: [
    {
      name: 'fieldPrefix', label: 'Moeda', control: 'select',
      options: [
        { value: 'R$', label: 'R$ (Real)' },
        { value: '$', label: '$ (Dolar)' },
        { value: '€', label: '€ (Euro)' },
        { value: '£', label: '£ (Libra)' },
        { value: '¥', label: '¥ (Yen)' },
      ],
    },
    { name: 'fieldDecimalPlaces', label: 'Casas decimais', control: 'number', min: 0, max: 4 },
  ],
  percentage: [
    { name: 'fieldMin', label: 'Minimo', control: 'number' },
    { name: 'fieldMax', label: 'Maximo', control: 'number' },
    { name: 'fieldDecimalPlaces', label: 'Casas decimais', control: 'number', min: 0, max: 4 },
  ],
  slider: [
    { name: 'fieldMin', label: 'Minimo', control: 'number' },
    { name: 'fieldMax', label: 'Maximo', control: 'number' },
    { name: 'fieldStep', label: 'Incremento', control: 'number' },
  ],
  rating: [
    { name: 'fieldMax', label: 'Nota maxima', control: 'number', min: 1, max: 10 },
  ],
  date: [
    { name: 'fieldDisablePast', label: 'Bloquear datas passadas', control: 'switch' },
    { name: 'fieldDisableFuture', label: 'Bloquear datas futuras', control: 'switch' },
  ],
  datetime: [
    { name: 'fieldDisablePast', label: 'Bloquear passadas', control: 'switch' },
    { name: 'fieldDisableFuture', label: 'Bloquear futuras', control: 'switch' },
  ],
  boolean: [
    {
      name: 'fieldTrueLabel', label: 'Label Sim', control: 'select',
      options: [
        { value: 'Sim', label: 'Sim' },
        { value: 'Verdadeiro', label: 'Verdadeiro' },
        { value: 'Ativo', label: 'Ativo' },
        { value: 'Habilitado', label: 'Habilitado' },
      ],
    },
    {
      name: 'fieldFalseLabel', label: 'Label Nao', control: 'select',
      options: [
        { value: 'Nao', label: 'Nao' },
        { value: 'Falso', label: 'Falso' },
        { value: 'Inativo', label: 'Inativo' },
        { value: 'Desabilitado', label: 'Desabilitado' },
      ],
    },
  ],
  multiselect: [
    { name: 'fieldMaxItems', label: 'Max itens', control: 'number', min: 1 },
  ],
  'checkbox-group': [
    {
      name: 'fieldLayout', label: 'Layout', control: 'select',
      options: [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'grid', label: 'Grid' },
      ],
    },
  ],
  'radio-group': [
    {
      name: 'fieldLayout', label: 'Layout', control: 'select',
      options: [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
      ],
    },
  ],
  tags: [
    { name: 'fieldAllowCustom', label: 'Permitir tags customizadas', control: 'switch' },
    { name: 'fieldMaxTags', label: 'Max tags', control: 'number', min: 1 },
  ],
  color: [
    {
      name: 'fieldColorFormat', label: 'Formato', control: 'select',
      options: [
        { value: 'hex', label: 'HEX' },
        { value: 'rgb', label: 'RGB' },
        { value: 'hsl', label: 'HSL' },
      ],
    },
  ],
  'sub-entity': [
    { name: 'fieldParentDisplayField', label: 'Campo pai de exibicao', control: 'input' },
    { name: 'fieldSubEntityDisplayFields', label: 'Campos de exibicao (JSON)', control: 'textarea', mono: true },
  ],
  lookup: [
    { name: 'fieldLookupConfig', label: 'Configuracao (JSON)', control: 'textarea', mono: true },
  ],
  'api-select': [
    { name: 'fieldApiEndpoint', label: 'Endpoint', control: 'input', placeholder: '/api/v1/...' },
    { name: 'fieldValueField', label: 'Campo valor', control: 'input', placeholder: 'id' },
    { name: 'fieldLabelField', label: 'Campo label', control: 'input' },
    { name: 'fieldApiFields', label: 'Campos da API (JSON)', control: 'textarea', mono: true },
  ],
  'user-select': [
    { name: 'fieldUserSelectConfig', label: 'Configuracao (JSON)', control: 'textarea', mono: true },
  ],
  file: [
    { name: 'fieldMultiple', label: 'Multiplos arquivos', control: 'switch' },
    { name: 'fieldMaxFiles', label: 'Max arquivos', control: 'number', min: 1, max: 50 },
  ],
  image: [
    { name: 'fieldMultiple', label: 'Multiplas imagens', control: 'switch' },
    { name: 'fieldMaxFiles', label: 'Max imagens', control: 'number', min: 1, max: 50 },
    {
      name: 'fieldImageSource', label: 'Fonte', control: 'select',
      options: [
        { value: 'both', label: 'Camera e Galeria' },
        { value: 'camera', label: 'Apenas Camera' },
        { value: 'gallery', label: 'Apenas Galeria' },
      ],
    },
  ],
  signature: [
    { name: 'fieldSignatureConfig', label: 'Configuracao (JSON)', control: 'textarea', mono: true },
  ],
  timer: [
    { name: 'fieldTimerConfig', label: 'Configuracao (JSON)', control: 'textarea', mono: true },
  ],
  'sla-status': [
    { name: 'fieldSlaConfig', label: 'Configuracao SLA (JSON)', control: 'textarea', mono: true },
  ],
  'action-button': [
    { name: 'fieldActionButtonConfig', label: 'Configuracao botao (JSON)', control: 'textarea', mono: true },
  ],
  formula: [
    { name: 'fieldFormulaConfig', label: 'Configuracao formula (JSON)', control: 'textarea', mono: true },
  ],
  rollup: [
    { name: 'fieldRollupConfig', label: 'Configuracao rollup (JSON)', control: 'textarea', mono: true },
  ],
  map: [
    {
      name: 'fieldMapMode', label: 'Modo', control: 'select',
      options: [
        { value: 'both', label: 'Endereco + Mapa' },
        { value: 'latlng', label: 'Lat/Lng' },
        { value: 'address', label: 'Apenas endereco' },
      ],
    },
    { name: 'fieldMapHeight', label: 'Altura (px)', control: 'number', min: 100, max: 600 },
    { name: 'fieldMapDefaultZoom', label: 'Zoom padrao', control: 'number', min: 1, max: 20 },
  ],
};

// Field types that have options-editor
const TYPES_WITH_OPTIONS = new Set([
  'select', 'multiselect', 'checkbox-group', 'radio-group', 'tags',
]);

// Field types that have entity-select
const TYPES_WITH_ENTITY_SELECT = new Set(['relation', 'sub-entity']);

// Field types that have autofill
const TYPES_WITH_AUTOFILL = new Set(['relation', 'api-select']);

// Width options for layout
const COL_SPAN_OPTIONS = [
  { value: '1', label: '1/12' },
  { value: '2', label: '2/12' },
  { value: '3', label: '3/12 (1/4)' },
  { value: '4', label: '4/12 (1/3)' },
  { value: '5', label: '5/12' },
  { value: '6', label: '6/12 (1/2)' },
  { value: '7', label: '7/12' },
  { value: '8', label: '8/12 (2/3)' },
  { value: '9', label: '9/12 (3/4)' },
  { value: '10', label: '10/12' },
  { value: '11', label: '11/12' },
  { value: '12', label: '12/12 (Inteiro)' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Simple trait renderer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SimpleTraitControl({
  trait,
  component,
  onUpdate,
}: {
  trait: SimpleTraitConfig;
  component: GjsComponent;
  onUpdate: () => void;
}) {
  switch (trait.control) {
    case 'input':
      return (
        <TextPropInput
          component={component}
          name={trait.name}
          label={trait.label}
          placeholder={trait.placeholder}
          mono={trait.mono}
          onUpdate={onUpdate}
        />
      );
    case 'number':
      return (
        <NumberPropInput
          component={component}
          name={trait.name}
          label={trait.label}
          min={trait.min}
          max={trait.max}
          placeholder={trait.placeholder}
          onUpdate={onUpdate}
        />
      );
    case 'select':
      return (
        <SelectPropInput
          component={component}
          name={trait.name}
          label={trait.label}
          options={trait.options || []}
          onUpdate={onUpdate}
        />
      );
    case 'switch':
      return (
        <PropSwitch
          label={trait.label}
          checked={!!component.get(trait.name)}
          onChange={(v) => {
            component.set(trait.name, v);
            component.trigger(`change:${trait.name}`);
            onUpdate();
          }}
        />
      );
    case 'textarea':
      return (
        <TextareaPropInput
          component={component}
          name={trait.name}
          label={trait.label}
          placeholder={trait.placeholder}
          mono={trait.mono}
          onUpdate={onUpdate}
        />
      );
    default:
      return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface FieldPropertiesPanelProps {
  component: GjsComponent;
  entityId: string;
  getCanvasFields: () => Array<{ slug: string; label: string }>;
  onPropertyChange: () => void;
}

export function FieldPropertiesPanel({
  component,
  entityId,
  getCanvasFields,
  onPropertyChange,
}: FieldPropertiesPanelProps) {
  const fieldType = (component.get('fieldType') as string) || 'text';

  // Helpers to read/write component properties
  const get = useCallback(
    (name: string) => (component.get(name) as string) || '',
    [component],
  );

  const set = useCallback(
    (name: string, value: string) => {
      component.set(name, value);
      component.trigger(`change:${name}`);
      onPropertyChange();
    },
    [component, onPropertyChange],
  );

  // Type-specific simple traits
  const simpleTraits = TYPE_SIMPLE_TRAITS[fieldType] || [];
  const hasOptions = TYPES_WITH_OPTIONS.has(fieldType);
  const hasEntitySelect = TYPES_WITH_ENTITY_SELECT.has(fieldType);
  const hasAutofill = TYPES_WITH_AUTOFILL.has(fieldType);
  const hasWorkflow = fieldType === 'workflow-status';
  const hasZoneDiagram = fieldType === 'zone-diagram';
  const hasTypeConfig =
    simpleTraits.length > 0 ||
    hasOptions ||
    hasEntitySelect ||
    hasAutofill ||
    hasWorkflow ||
    hasZoneDiagram;

  return (
    <div>
      {/* ─── Basico (always visible) ──────────────────────────────────── */}
      <div className="px-4 py-3 space-y-3 border-b border-border/50">
        <TextPropInput
          component={component}
          name="fieldLabel"
          label="Label"
          placeholder="Nome exibido"
          onUpdate={onPropertyChange}
        />
        <TextPropInput
          component={component}
          name="fieldName"
          label="Slug"
          placeholder="nome_do_campo"
          mono
          onUpdate={onPropertyChange}
        />
        <PropRow label="Tipo">
          <Select
            value={fieldType}
            onValueChange={(newType) => {
              component.set('fieldType', newType);
              component.trigger('change:fieldType');
              onPropertyChange();
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPE_GROUPS.map((group) => (
                <div key={group.group}>
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.group}</div>
                  {group.types.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </PropRow>
        <PropSwitch
          label="Obrigatorio"
          checked={!!component.get('fieldRequired')}
          onChange={(v) => {
            component.set('fieldRequired', v);
            component.trigger('change:fieldRequired');
            onPropertyChange();
          }}
        />
      </div>

      {/* ─── Configuracao do tipo (if applicable) ─────────────────────── */}
      {hasTypeConfig && (
        <Section title="Configuracao" defaultOpen>
          {/* Simple traits from config */}
          {simpleTraits.map((trait) => (
            <SimpleTraitControl
              key={trait.name}
              trait={trait}
              component={component}
              onUpdate={onPropertyChange}
            />
          ))}

          {/* Options editor */}
          {hasOptions && (
            <PropRow label="Opcoes">
              <OptionsTraitEditor
                value={get('fieldOptions')}
                onChange={(v) => set('fieldOptions', v)}
              />
            </PropRow>
          )}

          {/* Entity select — relation */}
          {fieldType === 'relation' && (
            <EntitySelectTraitEditor
              entityIdValue={get('fieldRelatedEntityId')}
              entitySlugValue={get('fieldRelatedEntitySlug')}
              displayFieldValue={get('fieldRelatedDisplayField')}
              onChangeEntityId={(v) => set('fieldRelatedEntityId', v)}
              onChangeEntitySlug={(v) => set('fieldRelatedEntitySlug', v)}
              onChangeDisplayField={(v) => set('fieldRelatedDisplayField', v)}
            />
          )}

          {/* Entity select — sub-entity */}
          {fieldType === 'sub-entity' && (
            <EntitySelectTraitEditor
              entityIdValue={get('fieldSubEntityId')}
              entitySlugValue={get('fieldSubEntitySlug')}
              displayFieldValue={get('fieldParentDisplayField')}
              onChangeEntityId={(v) => set('fieldSubEntityId', v)}
              onChangeEntitySlug={(v) => set('fieldSubEntitySlug', v)}
              onChangeDisplayField={(v) => set('fieldParentDisplayField', v)}
            />
          )}

          {/* Autofill — relation */}
          {fieldType === 'relation' && (
            <PropRow label="Auto-preenchimento">
              <AutoFillTraitEditor
                value={get('fieldAutoFillFields')}
                onChange={(v) => set('fieldAutoFillFields', v)}
                targetFields={getCanvasFields()}
                sourceFieldsJson=""
              />
            </PropRow>
          )}

          {/* Autofill — api-select */}
          {fieldType === 'api-select' && (
            <PropRow label="Auto-preenchimento">
              <AutoFillTraitEditor
                value={get('fieldAutoFillFields')}
                onChange={(v) => set('fieldAutoFillFields', v)}
                targetFields={getCanvasFields()}
                sourceFieldsJson={get('fieldApiFields')}
              />
            </PropRow>
          )}

          {/* Workflow editor */}
          {hasWorkflow && (
            <PropRow label="Workflow">
              <WorkflowTraitEditor
                value={get('fieldWorkflowConfig')}
                onChange={(v) => set('fieldWorkflowConfig', v)}
              />
            </PropRow>
          )}

          {/* Zone diagram editor */}
          {hasZoneDiagram && (
            <ZoneDiagramTraitEditor
              imageValue={get('fieldDiagramImage')}
              zonesValue={get('fieldDiagramZones')}
              saveModeValue={get('fieldDiagramSaveMode')}
              onChangeImage={(v) => set('fieldDiagramImage', v)}
              onChangeZones={(v) => set('fieldDiagramZones', v)}
              onChangeSaveMode={(v) => set('fieldDiagramSaveMode', v)}
            />
          )}
        </Section>
      )}

      {/* ─── Aparencia ────────────────────────────────────────────────── */}
      <Section title="Aparencia">
        <TextPropInput
          component={component}
          name="fieldPlaceholder"
          label="Placeholder"
          placeholder="Texto exibido quando vazio"
          onUpdate={onPropertyChange}
        />
        <TextPropInput
          component={component}
          name="fieldHelpText"
          label="Texto de ajuda"
          placeholder="Descricao abaixo do campo"
          onUpdate={onPropertyChange}
        />
        <TextPropInput
          component={component}
          name="fieldDefault"
          label="Valor padrao"
          onUpdate={onPropertyChange}
        />
      </Section>

      {/* ─── Layout ───────────────────────────────────────────────────── */}
      <Section title="Layout">
        <SelectPropInput
          component={component}
          name="fieldColSpan"
          label="Largura"
          options={COL_SPAN_OPTIONS}
          onUpdate={onPropertyChange}
        />
      </Section>

      {/* ─── Avancado ─────────────────────────────────────────────────── */}
      <Section title="Avancado">
        <PropSwitch
          label="Oculto"
          checked={!!component.get('fieldHidden')}
          onChange={(v) => {
            component.set('fieldHidden', v);
            component.trigger('change:fieldHidden');
            onPropertyChange();
          }}
        />
        <PropSwitch
          label="Unico"
          checked={!!component.get('fieldUnique')}
          onChange={(v) => {
            component.set('fieldUnique', v);
            component.trigger('change:fieldUnique');
            onPropertyChange();
          }}
        />

        <div className="pt-2 border-t border-border/30">
          <PropRow label="Ao mudar, preencher">
            <OnChangeAutoFillTraitEditor
              value={get('fieldOnChangeAutoFill')}
              onChange={(v) => set('fieldOnChangeAutoFill', v)}
              targetFields={getCanvasFields()}
              relatedEntityId={get('fieldRelatedEntityId')}
            />
          </PropRow>
        </div>

        <div className="pt-2 border-t border-border/30">
          <PropRow label="Regras">
            <FieldRulesTraitEditor
              entityId={entityId}
              fieldSlug={get('fieldName')}
              allFields={getCanvasFields().map((f) => ({
                slug: f.slug,
                name: f.label,
              }))}
            />
          </PropRow>
        </div>
      </Section>
    </div>
  );
}
