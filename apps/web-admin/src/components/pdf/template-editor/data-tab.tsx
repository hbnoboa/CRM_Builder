'use client';

import { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Calculator,
  GitBranch,
  Hash,
  Link2,
  Replace,
  Sigma,
  Info,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type {
  ComputedField,
  ComputedFieldType,
  ArithmeticConfig,
  ConditionalConfig,
  FilteredCountConfig,
  ConcatConfig,
  MapConfig,
  SubEntityAggregateConfig,
  PdfTemplateSettings,
} from '@/services/pdf-templates.service';

import { ArithmeticBuilder } from './computed-fields/arithmetic-builder';
import { ConditionalBuilder } from './computed-fields/conditional-builder';
import { FilteredCountBuilder } from './computed-fields/filtered-count-builder';
import { ConcatBuilder } from './computed-fields/concat-builder';
import { MapBuilder } from './computed-fields/map-builder';
import { SubEntityAggregateBuilder } from './computed-fields/sub-entity-aggregate-builder';

const FIELD_TYPES: Array<{
  type: ComputedFieldType;
  label: string;
  icon: typeof Calculator;
  description: string;
}> = [
  { type: 'arithmetic', label: 'Calculo', icon: Calculator, description: 'Somar, subtrair, multiplicar campos' },
  { type: 'conditional', label: 'Texto condicional', icon: GitBranch, description: 'Mostrar texto A ou B conforme campo' },
  { type: 'filtered-count', label: 'Contagem filtrada', icon: Hash, description: 'Contar registros do lote com filtro' },
  { type: 'concat', label: 'Juntar campos', icon: Link2, description: 'Combinar campos em um so texto' },
  { type: 'map', label: 'Substituir valores', icon: Replace, description: 'Trocar valores por textos (ex: A → Aprovado)' },
  { type: 'sub-entity-aggregate', label: 'Resumo de registros', icon: Sigma, description: 'Contar ou somar itens vinculados' },
];

function generateId(): string {
  return `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function createDefaultConfig(type: ComputedFieldType): ArithmeticConfig | ConditionalConfig | FilteredCountConfig | ConcatConfig {
  switch (type) {
    case 'arithmetic':
      return {
        operands: [
          { type: 'field', value: '' },
          { type: 'field', value: '' },
        ],
        operators: ['+'],
      } as ArithmeticConfig;
    case 'conditional':
      return {
        field: '',
        operator: 'equals',
        compareValue: '',
        trueResult: { type: 'text', value: '' },
        falseResult: { type: 'text', value: '' },
      } as ConditionalConfig;
    case 'filtered-count':
      return {
        filters: [
          { field: '', operator: 'equals', value: '' },
        ],
      } as FilteredCountConfig;
    case 'concat':
      return {
        parts: [
          { type: 'field', value: '' },
          { type: 'field', value: '' },
        ],
        separator: ' - ',
      } as ConcatConfig;
    case 'map':
      return {
        field: '',
        mappings: [{ from: '', to: '' }],
      } as MapConfig;
    case 'sub-entity-aggregate':
      return {
        subEntityField: '',
        aggregation: 'count',
      } as SubEntityAggregateConfig;
  }
}

interface DataTabProps {
  computedFields: ComputedField[];
  onChange: (computedFields: ComputedField[]) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
  templateType?: string;
  subEntities?: Record<string, {
    id: string;
    name: string;
    slug: string;
    fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
  }>;
  settings?: PdfTemplateSettings;
  onSettingsChange?: (settings: PdfTemplateSettings) => void;
}

export function DataTab({
  computedFields,
  onChange,
  availableFields,
  templateType,
  subEntities,
  settings,
  onSettingsChange,
}: DataTabProps) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // ==================== Computed Fields ====================

  const handleAdd = (type: ComputedFieldType) => {
    const typeInfo = FIELD_TYPES.find((t) => t.type === type);
    const newField: ComputedField = {
      id: generateId(),
      slug: `campo_${computedFields.length + 1}`,
      label: typeInfo?.label || 'Novo campo',
      type,
      config: createDefaultConfig(type),
    };
    onChange([...computedFields, newField]);
    setExpandedFields((prev) => new Set([...prev, newField.id]));
  };

  const handleRemove = (id: string) => {
    onChange(computedFields.filter((cf) => cf.id !== id));
    setExpandedFields((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleUpdate = (id: string, updates: Partial<ComputedField>) => {
    onChange(
      computedFields.map((cf) => (cf.id === id ? { ...cf, ...updates } : cf)),
    );
  };

  const handleLabelChange = (id: string, label: string) => {
    const slug = slugify(label) || `campo_${computedFields.findIndex((cf) => cf.id === id) + 1}`;
    handleUpdate(id, { label, slug });
  };

  const handleTypeChange = (id: string, type: ComputedFieldType) => {
    handleUpdate(id, { type, config: createDefaultConfig(type) });
  };

  const toggleExpanded = (id: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMoveField = (id: string, direction: 'up' | 'down') => {
    const index = computedFields.findIndex((cf) => cf.id === id);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= computedFields.length) return;
    const newFields = [...computedFields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    onChange(newFields);
  };

  const getTypeIcon = (type: ComputedFieldType) => {
    const found = FIELD_TYPES.find((t) => t.type === type);
    return found ? found.icon : Calculator;
  };

  const getTypeLabel = (type: ComputedFieldType) => {
    const found = FIELD_TYPES.find((t) => t.type === type);
    return found ? found.label : type;
  };

  return (
    <div className="space-y-6">
      {/* ==================== Configuracoes Gerais ==================== */}
      {onSettingsChange && (
        <div className="space-y-2">
          <h3 className="font-medium">Quando um campo esta vazio</h3>
          <div className="space-y-1">
            <Label className="text-sm">Texto a exibir no PDF</Label>
            <Input
              placeholder="Ex: -, N/A, Nao informado"
              value={settings?.emptyFieldDefault || ''}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  emptyFieldDefault: e.target.value || undefined,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Aparece no lugar de campos sem dados. Cada campo pode ter seu proprio texto.
            </p>
          </div>
        </div>
      )}

      {/* ==================== Campos Calculados ==================== */}
      <div className="space-y-4">
        {/* Info */}
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Como funciona</p>
              <p className="mt-1 opacity-80">
                Campos calculados criam novos valores a partir dos dados existentes.
                Use-os nos elementos do template como <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{{_calc.nome}}'}</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Campos Calculados</h3>
            <p className="text-sm text-muted-foreground">
              {computedFields.length === 0 ? 'Nenhum campo criado' : `${computedFields.length} campo(s) criado(s)`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Campo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {FIELD_TYPES.map((ft) => (
                <DropdownMenuItem
                  key={ft.type}
                  onClick={() => handleAdd(ft.type)}
                  className="flex items-center gap-2"
                >
                  <ft.icon className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{ft.label}</div>
                    <div className="text-xs text-muted-foreground">{ft.description}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Lista */}
        {computedFields.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calculator className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                Adicione campos calculados para transformar dados antes de gerar o PDF.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {computedFields.map((cf, index) => {
              const Icon = getTypeIcon(cf.type);
              const isExpanded = expandedFields.has(cf.id);

              return (
                <Card key={cf.id}>
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(cf.id)}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="p-3 cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <div className="flex-1 text-left min-w-0">
                            <span className="font-medium">{cf.label}</span>
                            <span className="ml-2 text-xs text-muted-foreground font-mono">
                              {'{{_calc.'}{cf.slug}{'}}'}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {getTypeLabel(cf.type)}
                          </Badge>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(`{{_calc.${cf.slug}}}`);
                              }}
                              title="Copiar binding"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveField(cf.id, 'up');
                              }}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveField(cf.id, 'down');
                              }}
                              disabled={index === computedFields.length - 1}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemove(cf.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-4 space-y-4">
                        {/* Nome e tipo */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Nome do campo</Label>
                            <Input
                              placeholder="Ex: Peso Liquido"
                              value={cf.label}
                              onChange={(e) => handleLabelChange(cf.id, e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Binding: <code className="bg-muted px-1 rounded">{'{{_calc.'}{cf.slug}{'}}'}</code>
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select
                              value={cf.type}
                              onValueChange={(type) => handleTypeChange(cf.id, type as ComputedFieldType)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPES.map((ft) => (
                                  <SelectItem key={ft.type} value={ft.type}>
                                    {ft.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Builder especifico */}
                        <div className="border-t pt-3">
                          {cf.type === 'arithmetic' && (
                            <ArithmeticBuilder
                              config={cf.config as ArithmeticConfig}
                              onChange={(config) => handleUpdate(cf.id, { config })}
                              availableFields={availableFields}
                              computedFields={computedFields}
                              currentFieldId={cf.id}
                            />
                          )}
                          {cf.type === 'conditional' && (
                            <ConditionalBuilder
                              config={cf.config as ConditionalConfig}
                              onChange={(config) => handleUpdate(cf.id, { config })}
                              availableFields={availableFields}
                            />
                          )}
                          {cf.type === 'filtered-count' && (
                            <FilteredCountBuilder
                              config={cf.config as FilteredCountConfig}
                              onChange={(config) => handleUpdate(cf.id, { config })}
                              availableFields={availableFields}
                              templateType={templateType}
                            />
                          )}
                          {cf.type === 'concat' && (
                            <ConcatBuilder
                              config={cf.config as ConcatConfig}
                              onChange={(config) => handleUpdate(cf.id, { config })}
                              availableFields={availableFields}
                            />
                          )}
                          {cf.type === 'map' && (
                            <MapBuilder
                              config={cf.config as MapConfig}
                              onChange={(config) => handleUpdate(cf.id, { config })}
                              availableFields={availableFields}
                            />
                          )}
                          {cf.type === 'sub-entity-aggregate' && (
                            <SubEntityAggregateBuilder
                              config={cf.config as SubEntityAggregateConfig}
                              onChange={(config) => handleUpdate(cf.id, { config })}
                              availableFields={availableFields}
                              subEntities={subEntities}
                            />
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
