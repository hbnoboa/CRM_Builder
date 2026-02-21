'use client';

import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FieldGroupElement } from '@/services/pdf-templates.service';

const BATCH_SOURCES = [
  { value: '_direct', label: 'Campo direto' },
  { value: '_first', label: 'Primeiro registro' },
  { value: '_last', label: 'Ultimo registro' },
  { value: '_max', label: 'Maior valor' },
  { value: '_min', label: 'Menor valor' },
  { value: '_meta', label: 'Info do lote' },
] as const;

const BATCH_META_FIELDS = [
  { value: '_totalRecords', label: 'Total de registros', type: 'number' },
  { value: '_totalDamaged', label: 'Total com sub-registros', type: 'number' },
  { value: '_timestamp', label: 'Data/hora da geracao', type: 'datetime' },
  { value: '_firstUpdatedAt', label: 'Primeira atualizacao', type: 'datetime' },
  { value: '_lastUpdatedAt', label: 'Ultima atualizacao', type: 'datetime' },
];

function getFormatsForFieldType(fieldType: string | undefined): Array<{ value: string; label: string; group?: string }> {
  if (!fieldType) return [];

  const formats: Array<{ value: string; label: string; group?: string }> = [];

  // Texto
  if (['text', 'string', 'textarea', 'select', 'radio'].includes(fieldType)) {
    formats.push(
      { value: 'uppercase', label: 'MAIUSCULAS', group: 'Texto' },
      { value: 'lowercase', label: 'minusculas', group: 'Texto' },
      { value: 'titlecase', label: 'Primeira Maiuscula', group: 'Texto' },
    );
  }

  // Documentos
  if (['text', 'string', 'cpf'].includes(fieldType)) {
    formats.push({ value: 'cpf', label: 'CPF (123.456.789-00)', group: 'Documentos' });
  }
  if (['text', 'string', 'cnpj'].includes(fieldType)) {
    formats.push({ value: 'cnpj', label: 'CNPJ', group: 'Documentos' });
  }
  if (['text', 'string', 'cep'].includes(fieldType)) {
    formats.push({ value: 'cep', label: 'CEP (01234-567)', group: 'Documentos' });
  }
  if (['text', 'string', 'phone'].includes(fieldType)) {
    formats.push({ value: 'phone', label: 'Telefone', group: 'Documentos' });
  }

  // Boolean
  if (['boolean', 'checkbox'].includes(fieldType)) {
    formats.push({ value: 'boolean', label: 'Sim / Nao', group: 'Outros' });
  }

  // Data/Hora
  if (['date', 'datetime'].includes(fieldType)) {
    formats.push(
      { value: 'date', label: 'Data (20/02/2026)', group: 'Data / Hora' },
      { value: 'datetime', label: 'Data e Hora', group: 'Data / Hora' },
      { value: 'time', label: 'Apenas Hora', group: 'Data / Hora' },
    );
  }
  if (fieldType === 'time') {
    formats.push(
      { value: 'time', label: 'Hora (14:30)', group: 'Data / Hora' },
      { value: 'datetime', label: 'Data e Hora', group: 'Data / Hora' },
    );
  }

  // Numeros
  if (['number', 'integer', 'float', 'currency', 'percentage', 'slider', 'rating'].includes(fieldType)) {
    formats.push(
      { value: 'number', label: 'Numero (1.234)', group: 'Numeros' },
      { value: 'currency', label: 'Moeda (R$ 1.234,56)', group: 'Numeros' },
      { value: 'percentage', label: 'Percentual (45,67%)', group: 'Numeros' },
    );
  }

  return formats;
}

function parseBinding(slug: string): { source: string; field: string } {
  for (const prefix of ['_first.', '_last.', '_max.', '_min.']) {
    if (slug.startsWith(prefix)) {
      return { source: prefix.slice(0, -1), field: slug.slice(prefix.length) };
    }
  }
  if (BATCH_META_FIELDS.some((m) => m.value === slug)) {
    return { source: '_meta', field: slug };
  }
  return { source: '_direct', field: slug };
}

function buildBinding(source: string, field: string): string {
  if (source === '_direct' || source === '_meta') return field;
  return `${source}.${field}`;
}

interface FieldGroupDataEditorProps {
  element: FieldGroupElement;
  onChange: (updates: Partial<FieldGroupElement>) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
  isBatch?: boolean;
  computedFields?: Array<{ slug: string; label: string }>;
}

export function FieldGroupDataEditor({
  element,
  onChange,
  availableFields,
  isBatch,
  computedFields,
}: FieldGroupDataEditorProps) {
  const entityFields = useMemo(
    () => availableFields.filter((f) => !['image', 'images', 'sub-entity', 'array'].includes(f.type)),
    [availableFields],
  );

  const calcFields = useMemo(
    () => (computedFields || []).map((cf) => ({
      slug: `_calc.${cf.slug}`,
      name: cf.label,
      label: cf.label,
      type: 'text',
    })),
    [computedFields],
  );

  const selectableFields = useMemo(
    () => [...entityFields, ...calcFields],
    [entityFields, calcFields],
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Campos do grupo</Label>
        <Button variant="outline" size="sm" onClick={handleAddField}>
          <Plus className="h-4 w-4 mr-1" />
          Campo
        </Button>
      </div>

      <div className="space-y-2">
        {element.fields.map((field, index) => {
          const bindingSlug = field.binding.replace(/\{\{|\}\}/g, '');
          const parsed = parseBinding(bindingSlug);

          let fieldType: string | undefined;
          if (parsed.source === '_meta') {
            fieldType = BATCH_META_FIELDS.find((m) => m.value === parsed.field)?.type;
          } else {
            fieldType = selectableFields.find((f) => f.slug === parsed.field)?.type
              || availableFields.find((f) => f.slug === parsed.field)?.type;
          }

          const formatOptions = getFormatsForFieldType(fieldType);
          const formatGroups = formatOptions.reduce((acc, opt) => {
            const group = opt.group || 'Outros';
            if (!acc[group]) acc[group] = [];
            acc[group].push(opt);
            return acc;
          }, {} as Record<string, typeof formatOptions>);

          return (
            <div key={index} className="p-3 border rounded-md space-y-2">
              {/* Linha 1: Label + Negrito + Remover */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nome que aparece no PDF (ex: Navio:)"
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
                  className="h-8 w-8 text-destructive flex-shrink-0"
                  onClick={() => handleRemoveField(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Linha 2: Fonte (batch) + Campo + Formato */}
              <div className="flex items-center gap-2">
                {isBatch && (
                  <Select
                    value={parsed.source}
                    onValueChange={(newSource) => {
                      if (newSource === '_meta') {
                        const firstMeta = BATCH_META_FIELDS[0];
                        handleFieldChange(index, {
                          binding: `{{${firstMeta.value}}}`,
                          format: undefined,
                        });
                      } else if (newSource === '_direct') {
                        handleFieldChange(index, { binding: `{{${parsed.field}}}` });
                      } else {
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
                    <SelectTrigger className="flex-1 min-w-0">
                      <SelectValue placeholder="Informacao..." />
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
                    <SelectTrigger className="flex-1 min-w-0">
                      <SelectValue placeholder="Selecionar campo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Campos da entidade</SelectLabel>
                        {entityFields.map((f) => (
                          <SelectItem key={f.slug} value={f.slug}>
                            {f.label || f.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {calcFields.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Campos calculados</SelectLabel>
                          {calcFields.map((f) => (
                            <SelectItem key={f.slug} value={f.slug}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                )}

                {formatOptions.length > 0 && (
                  <Select
                    value={field.format || '_none'}
                    onValueChange={(value) => handleFieldChange(index, { format: value === '_none' ? undefined : value })}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Formato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem formato</SelectItem>
                      {Object.entries(formatGroups).map(([group, opts]) => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {opts.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Linha 3: Texto quando vazio (progressive disclosure) */}
              {field.defaultValue !== undefined && field.defaultValue !== '' ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Texto quando vazio (ex: -, N/A)"
                    value={field.defaultValue || ''}
                    onChange={(e) => handleFieldChange(index, { defaultValue: e.target.value || undefined })}
                    className="flex-1 text-xs h-7"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-muted-foreground"
                    onClick={() => handleFieldChange(index, { defaultValue: undefined })}
                  >
                    Limpar
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => handleFieldChange(index, { defaultValue: '' })}
                >
                  + Definir texto para campo vazio
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
