'use client';

import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SubEntityAggregateConfig, FilteredCountFilter } from '@/services/pdf-templates.service';

const AGGREGATIONS = [
  { value: 'count', label: 'Contar registros', needsField: false },
  { value: 'sum', label: 'Somar valores', needsField: true },
  { value: 'avg', label: 'Calcular media', needsField: true },
  { value: 'min', label: 'Menor valor', needsField: true },
  { value: 'max', label: 'Maior valor', needsField: true },
] as const;

const FILTER_OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'greater', label: 'Maior que' },
  { value: 'less', label: 'Menor que' },
  { value: 'contains', label: 'Contem' },
  { value: 'not_empty', label: 'Preenchido' },
] as const;

const NO_VALUE_OPERATORS = ['not_empty', 'has_items', 'no_items'];

interface SubEntityAggregateBuilderProps {
  config: SubEntityAggregateConfig;
  onChange: (config: SubEntityAggregateConfig) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
  subEntities?: Record<string, {
    id: string;
    name: string;
    slug: string;
    fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
  }>;
}

export function SubEntityAggregateBuilder({
  config,
  onChange,
  availableFields,
  subEntities,
}: SubEntityAggregateBuilderProps) {
  const subEntityFields = availableFields.filter(
    (f) => f.type === 'sub-entity' || f.type === 'relation' || f.type === 'array',
  );

  const selectedSubEntity = config.subEntityField && subEntities?.[config.subEntityField];
  const subFields = selectedSubEntity?.fields || [];

  const aggregationInfo = AGGREGATIONS.find((a) => a.value === config.aggregation);
  const filters = config.filters || [];

  const handleAddFilter = () => {
    const firstField = subFields[0]?.slug || '';
    onChange({
      ...config,
      filters: [...filters, { field: firstField, operator: 'equals', value: '' }],
    });
  };

  const handleFilterChange = (index: number, updates: Partial<FilteredCountFilter>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    onChange({ ...config, filters: newFilters });
  };

  const handleRemoveFilter = (index: number) => {
    onChange({ ...config, filters: filters.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      {/* Info */}
      <div className="rounded-md bg-blue-50 border border-blue-200 p-2 text-xs text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p>
            Calcula um valor a partir dos registros vinculados (sub-registros).
            Exemplo: contar itens, somar valores, encontrar menor/maior.
          </p>
        </div>
      </div>

      {/* Registros vinculados */}
      <div className="space-y-1">
        <Label className="text-xs">Registros vinculados</Label>
        <Select
          value={config.subEntityField || '_empty'}
          onValueChange={(v) => onChange({ ...config, subEntityField: v === '_empty' ? '' : v, field: undefined, filters: [] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_empty">Selecione...</SelectItem>
            {subEntityFields.map((f) => (
              <SelectItem key={f.slug} value={f.slug}>
                {f.label || f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedSubEntity && (
          <p className="text-xs text-blue-600">
            Usando: {selectedSubEntity.name}
          </p>
        )}
      </div>

      {/* Tipo de calculo + Campo */}
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">O que calcular?</Label>
          <Select
            value={config.aggregation}
            onValueChange={(v) => onChange({ ...config, aggregation: v as SubEntityAggregateConfig['aggregation'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGGREGATIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {aggregationInfo?.needsField && (
          <div className="flex-1 space-y-1">
            <Label className="text-xs">De qual campo?</Label>
            <Select
              value={config.field || '_empty'}
              onValueChange={(v) => onChange({ ...config, field: v === '_empty' ? undefined : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Campo numerico..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_empty">Selecione...</SelectItem>
                {subFields
                  .filter((f) => ['number', 'integer', 'float', 'currency', 'percentage', 'slider', 'rating'].includes(f.type))
                  .map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Filtros opcionais */}
      {config.subEntityField && (
        <div className="space-y-2 border-t pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Considerar somente registros onde...</Label>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleAddFilter}>
              <Plus className="h-3 w-3 mr-1" />
              Filtro
            </Button>
          </div>

          {filters.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sem filtros — todos os registros vinculados serao considerados.
            </p>
          )}

          {filters.map((filter, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={filter.field}
                onValueChange={(v) => handleFilterChange(index, { field: v })}
              >
                <SelectTrigger className="flex-1 min-w-0">
                  <SelectValue placeholder="Campo" />
                </SelectTrigger>
                <SelectContent>
                  {subFields.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filter.operator}
                onValueChange={(v) => handleFilterChange(index, { operator: v as FilteredCountFilter['operator'] })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!NO_VALUE_OPERATORS.includes(filter.operator) && (
                <Input
                  value={filter.value}
                  onChange={(e) => handleFilterChange(index, { value: e.target.value })}
                  placeholder="Valor"
                  className="w-28"
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive flex-shrink-0"
                onClick={() => handleRemoveFilter(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
