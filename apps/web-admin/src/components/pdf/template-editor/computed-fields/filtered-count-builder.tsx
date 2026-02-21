'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FilteredCountConfig, FilteredCountFilter } from '@/services/pdf-templates.service';

const OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'greater', label: 'Maior que' },
  { value: 'less', label: 'Menor que' },
  { value: 'contains', label: 'Contem' },
  { value: 'not_empty', label: 'Nao vazio' },
] as const;

interface FilteredCountBuilderProps {
  config: FilteredCountConfig;
  onChange: (config: FilteredCountConfig) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
  templateType?: string;
}

export function FilteredCountBuilder({
  config,
  onChange,
  availableFields,
  templateType,
}: FilteredCountBuilderProps) {
  const selectableFields = availableFields.filter(
    (f) => !['image', 'images', 'sub-entity', 'array'].includes(f.type),
  );

  // Backward compat: migrate old single-filter format
  const filters: FilteredCountFilter[] = config.filters || [
    { field: (config as any).field || '', operator: (config as any).operator || 'equals', value: (config as any).value || '' },
  ];

  const handleFilterChange = (index: number, updates: Partial<FilteredCountFilter>) => {
    const newFilters = filters.map((f, i) => (i === index ? { ...f, ...updates } : f));
    onChange({ filters: newFilters });
  };

  const handleAddFilter = () => {
    onChange({ filters: [...filters, { field: '', operator: 'equals', value: '' }] });
  };

  const handleRemoveFilter = (index: number) => {
    if (filters.length <= 1) return;
    onChange({ filters: filters.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      {templateType !== 'batch' && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
          Este tipo de campo so funciona em templates de lote (batch).
        </div>
      )}

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Apenas lote</Badge>
        <span className="text-xs text-muted-foreground">
          Conta registros (COUNT _id) que atendem todos os filtros abaixo
        </span>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Filtros (AND)</Label>

        {filters.map((filter, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <Select
              value={filter.field}
              onValueChange={(field) => handleFilterChange(index, { field })}
            >
              <SelectTrigger className="w-40">
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

            <Select
              value={filter.operator}
              onValueChange={(operator) =>
                handleFilterChange(index, { operator: operator as FilteredCountFilter['operator'] })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {filter.operator !== 'not_empty' && (
              <Input
                placeholder="Valor..."
                value={filter.value}
                onChange={(e) => handleFilterChange(index, { value: e.target.value })}
                className="w-40"
              />
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => handleRemoveFilter(index)}
              disabled={filters.length <= 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={handleAddFilter}
          className="mt-1"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar filtro
        </Button>
      </div>
    </div>
  );
}
