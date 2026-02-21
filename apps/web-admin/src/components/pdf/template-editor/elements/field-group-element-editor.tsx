'use client';

import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FieldGroupElement } from '@/services/pdf-templates.service';

// Opcoes de fonte para lote
const BATCH_SOURCES = [
  { value: '_direct', label: 'Campo direto' },
  { value: '_first', label: 'Primeiro registro' },
  { value: '_last', label: 'Ultimo registro' },
  { value: '_max', label: 'Maior valor' },
  { value: '_min', label: 'Menor valor' },
  { value: '_meta', label: 'Info do lote' },
] as const;

// Metadados de lote
const BATCH_META_FIELDS = [
  { value: '_totalRecords', label: 'Total de registros', type: 'number' },
  { value: '_totalDamaged', label: 'Total com avarias', type: 'number' },
  { value: '_timestamp', label: 'Data/hora da geracao', type: 'datetime' },
  { value: '_firstUpdatedAt', label: 'Primeira atualizacao', type: 'datetime' },
  { value: '_lastUpdatedAt', label: 'Ultima atualizacao', type: 'datetime' },
];

// Formatos por tipo de campo
const FORMATS_BY_TYPE: Record<string, Array<{ value: string; label: string }>> = {
  date: [
    { value: 'date', label: 'Data (20/02/2026)' },
    { value: 'datetime', label: 'Data e Hora' },
    { value: 'time', label: 'Apenas Hora' },
  ],
  datetime: [
    { value: 'datetime', label: 'Data e Hora' },
    { value: 'date', label: 'Apenas Data' },
    { value: 'time', label: 'Apenas Hora' },
  ],
  number: [
    { value: 'number', label: 'Numero (1.234)' },
    { value: 'currency', label: 'Moeda (R$ 1.234,56)' },
    { value: 'percentage', label: 'Percentual (45.67%)' },
  ],
  integer: [
    { value: 'number', label: 'Numero (1.234)' },
    { value: 'currency', label: 'Moeda (R$ 1.234,56)' },
  ],
  float: [
    { value: 'number', label: 'Numero (1.234)' },
    { value: 'currency', label: 'Moeda (R$ 1.234,56)' },
    { value: 'percentage', label: 'Percentual (45.67%)' },
  ],
  currency: [
    { value: 'currency', label: 'Moeda (R$ 1.234,56)' },
    { value: 'number', label: 'Numero (1.234)' },
  ],
};

function getFormatsForType(fieldType: string | undefined): Array<{ value: string; label: string }> {
  if (!fieldType) return [];
  return FORMATS_BY_TYPE[fieldType] || [];
}

/** Decompoe um binding slug em { source, field } */
function parseBinding(slug: string): { source: string; field: string } {
  for (const prefix of ['_first.', '_last.', '_max.', '_min.']) {
    if (slug.startsWith(prefix)) {
      return { source: prefix.slice(0, -1), field: slug.slice(prefix.length) };
    }
  }
  // Metadados
  if (BATCH_META_FIELDS.some((m) => m.value === slug)) {
    return { source: '_meta', field: slug };
  }
  return { source: '_direct', field: slug };
}

/** Recompoe o binding slug a partir de source e field */
function buildBinding(source: string, field: string): string {
  if (source === '_direct' || source === '_meta') return field;
  return `${source}.${field}`;
}

interface FieldGroupElementEditorProps {
  element: FieldGroupElement;
  onChange: (updates: Partial<FieldGroupElement>) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
  isBatch?: boolean;
  computedFields?: Array<{ slug: string; label: string }>;
}

export function FieldGroupElementEditor({
  element,
  onChange,
  availableFields,
  isBatch,
  computedFields,
}: FieldGroupElementEditorProps) {
  // Campos filtrados (sem imagem/sub-entity)
  const selectableFields = useMemo(
    () => {
      const base = availableFields.filter((f) => !['image', 'images', 'sub-entity', 'array'].includes(f.type));
      // Adicionar campos calculados como opcoes
      if (computedFields?.length) {
        const calcFields = computedFields.map((cf) => ({
          slug: `_calc.${cf.slug}`,
          name: cf.label,
          label: `[Calc] ${cf.label}`,
          type: 'text',
        }));
        return [...base, ...calcFields];
      }
      return base;
    },
    [availableFields, computedFields],
  );

  const handleFieldChange = (index: number, updates: Partial<FieldGroupElement['fields'][0]>) => {
    const newFields = [...element.fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange({ fields: newFields });
  };

  const handleAddField = () => {
    const firstField = selectableFields[0];
    onChange({
      fields: [
        ...element.fields,
        {
          label: firstField ? `${firstField.label || firstField.name}:` : 'Campo:',
          binding: firstField ? `{{${firstField.slug}}}` : '{{campo}}',
          labelBold: true,
        },
      ],
    });
  };

  const handleRemoveField = (index: number) => {
    onChange({
      fields: element.fields.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Titulo (opcional)</Label>
        <Input
          placeholder="Ex: Informacoes do Veiculo"
          value={element.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Layout</Label>
          <Select
            value={element.layout}
            onValueChange={(value) =>
              onChange({ layout: value as 'horizontal' | 'vertical' | 'grid' })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="horizontal">Horizontal (lado a lado)</SelectItem>
              <SelectItem value="vertical">Vertical (empilhado)</SelectItem>
              <SelectItem value="grid">Grid (colunas)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {element.layout === 'grid' && (
          <div className="space-y-2">
            <Label>Colunas</Label>
            <Select
              value={String(element.columns || 2)}
              onValueChange={(value) => onChange({ columns: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 colunas</SelectItem>
                <SelectItem value="3">3 colunas</SelectItem>
                <SelectItem value="4">4 colunas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Tamanhos de fonte e espacamento */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Tamanho do Label</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[element.labelFontSize || 10]}
              onValueChange={([value]) => onChange({ labelFontSize: value })}
              min={6}
              max={18}
              step={1}
              className="flex-1"
            />
            <span className="w-10 text-xs text-muted-foreground text-right">
              {element.labelFontSize || 10}pt
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Tamanho do Valor</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[element.valueFontSize || 10]}
              onValueChange={([value]) => onChange({ valueFontSize: value })}
              min={6}
              max={18}
              step={1}
              className="flex-1"
            />
            <span className="w-10 text-xs text-muted-foreground text-right">
              {element.valueFontSize || 10}pt
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Espacamento</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[element.lineSpacing || 0]}
              onValueChange={([value]) => onChange({ lineSpacing: value || undefined })}
              min={0}
              max={30}
              step={1}
              className="flex-1"
            />
            <span className="w-10 text-xs text-muted-foreground text-right">
              {element.lineSpacing ? `${element.lineSpacing}px` : 'auto'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Campos</Label>
          <Button variant="outline" size="sm" onClick={handleAddField}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {element.fields.map((field, index) => {
            const bindingSlug = field.binding.replace(/\{\{|\}\}/g, '');
            const parsed = parseBinding(bindingSlug);

            // Determinar tipo do campo selecionado
            let fieldType: string | undefined;
            if (parsed.source === '_meta') {
              fieldType = BATCH_META_FIELDS.find((m) => m.value === parsed.field)?.type;
            } else {
              fieldType = selectableFields.find((f) => f.slug === parsed.field)?.type
                || availableFields.find((f) => f.slug === parsed.field)?.type;
            }

            const formatOptions = getFormatsForType(fieldType);

            return (
              <div key={index} className="p-3 border rounded-md space-y-2">
                {/* Linha 1: Label + Bold + Delete */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Label (ex: Navio:)"
                    value={field.label}
                    onChange={(e) => handleFieldChange(index, { label: e.target.value })}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={field.labelBold}
                      onCheckedChange={(checked) => handleFieldChange(index, { labelBold: checked })}
                    />
                    <span className="text-xs font-bold">B</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemoveField(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Linha 2: Fonte (se batch) + Campo + Formato */}
                <div className="flex flex-wrap items-center gap-2">
                  {isBatch && (
                    <Select
                      value={parsed.source}
                      onValueChange={(newSource) => {
                        if (newSource === '_meta') {
                          // Selecionar primeiro metadado
                          const firstMeta = BATCH_META_FIELDS[0];
                          handleFieldChange(index, {
                            binding: `{{${firstMeta.value}}}`,
                            format: undefined,
                          });
                        } else if (newSource === '_direct') {
                          // Manter campo, remover prefixo
                          handleFieldChange(index, { binding: `{{${parsed.field}}}` });
                        } else {
                          // Adicionar prefixo ao campo atual
                          const fieldSlug = parsed.source === '_meta'
                            ? (selectableFields[0]?.slug || '')
                            : parsed.field;
                          handleFieldChange(index, {
                            binding: `{{${buildBinding(newSource, fieldSlug)}}}`,
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BATCH_SOURCES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Select de campo (ou metadado) */}
                  {parsed.source === '_meta' ? (
                    <Select
                      value={parsed.field}
                      onValueChange={(newField) => {
                        handleFieldChange(index, {
                          binding: `{{${newField}}}`,
                          format: undefined,
                        });
                      }}
                    >
                      <SelectTrigger className="flex-1 min-w-[140px]">
                        <SelectValue placeholder="Info..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BATCH_META_FIELDS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={selectableFields.some((f) => f.slug === parsed.field) ? parsed.field : '_unknown'}
                      onValueChange={(newField) => {
                        const slug = buildBinding(parsed.source, newField);
                        handleFieldChange(index, {
                          binding: `{{${slug}}}`,
                          format: undefined,
                        });
                      }}
                    >
                      <SelectTrigger className="flex-1 min-w-[140px]">
                        <SelectValue placeholder="Campo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableFields.map((f) => (
                          <SelectItem key={f.slug} value={f.slug}>
                            {f.label || f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Formato - so aparece se ha opcoes para o tipo */}
                  {formatOptions.length > 0 && (
                    <Select
                      value={field.format || '_none'}
                      onValueChange={(value) => handleFieldChange(index, { format: value === '_none' ? undefined : value })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Formato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sem formato</SelectItem>
                        {formatOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Margem Superior (px)</Label>
          <Slider
            value={[element.marginTop || 0]}
            onValueChange={([value]) => onChange({ marginTop: value })}
            min={0}
            max={50}
            step={5}
          />
        </div>
        <div className="space-y-2">
          <Label>Margem Inferior (px)</Label>
          <Slider
            value={[element.marginBottom || 0]}
            onValueChange={([value]) => onChange({ marginBottom: value })}
            min={0}
            max={50}
            step={5}
          />
        </div>
      </div>
    </div>
  );
}
