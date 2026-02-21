'use client';

import { Plus, Trash2, Filter, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  TableElement,
  TableColumn,
  TableRowFilter,
  TableSortRule,
} from '@/services/pdf-templates.service';

const FILTER_OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'greater', label: 'Maior que' },
  { value: 'less', label: 'Menor que' },
  { value: 'contains', label: 'Contem' },
  { value: 'not_empty', label: 'Nao esta vazio' },
] as const;

const NO_VALUE_OPERATORS = ['not_empty', 'has_items', 'no_items'];

const SYSTEM_FIELDS = [
  { slug: 'createdAt', name: 'Data de Criacao', label: 'Data de Criacao', type: 'datetime' },
  { slug: 'updatedAt', name: 'Data de Atualizacao', label: 'Data de Atualizacao', type: 'datetime' },
  { slug: '_geolocation.lat', name: 'Latitude', label: 'Latitude', type: 'number' },
  { slug: '_geolocation.lng', name: 'Longitude', label: 'Longitude', type: 'number' },
  { slug: '_geolocation.city', name: 'Cidade (GPS)', label: 'Cidade (GPS)', type: 'text' },
  { slug: '_geolocation.uf', name: 'Estado (GPS)', label: 'Estado (GPS)', type: 'text' },
  { slug: '_geolocation.address', name: 'Endereco (GPS)', label: 'Endereco (GPS)', type: 'text' },
];

interface TableDataEditorProps {
  element: TableElement;
  onChange: (updates: Partial<TableElement>) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
  subEntities?: Record<string, {
    id: string;
    name: string;
    slug: string;
    fields?: Array<{ slug: string; name: string; label?: string; type: string }>;
  }>;
}

export function TableDataEditor({
  element,
  onChange,
  availableFields,
  subEntities,
}: TableDataEditorProps) {
  const columnFields = (element.dataSource && subEntities?.[element.dataSource]?.fields)
    ? [...subEntities[element.dataSource].fields!, ...SYSTEM_FIELDS]
    : availableFields;

  const handleColumnChange = (index: number, updates: Partial<TableColumn>) => {
    const newColumns = [...element.columns];
    newColumns[index] = { ...newColumns[index], ...updates };
    onChange({ columns: newColumns });
  };

  const handleAddColumn = () => {
    onChange({
      columns: [
        ...element.columns,
        { field: '', header: 'Nova Coluna', width: 100, align: 'left' },
      ],
    });
  };

  const handleRemoveColumn = (index: number) => {
    onChange({
      columns: element.columns.filter((_, i) => i !== index),
    });
  };

  // ==================== Filtros ====================
  const filters = element.filters || [];

  const handleAddFilter = () => {
    const firstField = columnFields[0]?.slug || '';
    onChange({
      filters: [...filters, { field: firstField, operator: 'equals', value: '' }],
    });
  };

  const handleFilterChange = (index: number, updates: Partial<TableRowFilter>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    onChange({ filters: newFilters });
  };

  const handleRemoveFilter = (index: number) => {
    onChange({ filters: filters.filter((_, i) => i !== index) });
  };

  // ==================== Ordenacao ====================
  const sorting = element.sorting || [];

  const handleAddSort = () => {
    const firstField = columnFields[0]?.slug || '';
    onChange({
      sorting: [...sorting, { field: firstField, direction: 'asc' }],
    });
  };

  const handleSortChange = (index: number, updates: Partial<TableSortRule>) => {
    const newSorting = [...sorting];
    newSorting[index] = { ...newSorting[index], ...updates };
    onChange({ sorting: newSorting });
  };

  const handleRemoveSort = (index: number) => {
    onChange({ sorting: sorting.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      {/* Fonte de dados */}
      <div className="space-y-2">
        <Label>De onde vem os dados?</Label>
        <Select
          value={element.dataSource || '_self'}
          onValueChange={(value) => onChange({ dataSource: value === '_self' ? undefined : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_self">Registro principal</SelectItem>
            {availableFields
              .filter((f) => f.type === 'relation' || f.type === 'array' || f.type === 'sub-entity')
              .map((f) => (
                <SelectItem key={f.slug} value={f.slug}>
                  {f.label || f.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {element.dataSource && subEntities?.[element.dataSource] && (
          <p className="text-xs text-blue-600">
            Usando campos de: {subEntities[element.dataSource].name}
          </p>
        )}
      </div>

      {/* Colunas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Colunas da tabela</Label>
          <Button variant="outline" size="sm" onClick={handleAddColumn}>
            <Plus className="h-4 w-4 mr-1" />
            Coluna
          </Button>
        </div>

        <div className="space-y-2">
          {element.columns.map((column, index) => (
            <div key={index} className="p-3 border rounded-md space-y-2">
              {/* Linha 1: Campo + Titulo da coluna */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Select
                    value={column.field || '_empty'}
                    onValueChange={(value) => {
                      const f = columnFields.find((af) => af.slug === value);
                      const updates: Partial<TableColumn> = { field: value === '_empty' ? '' : value };
                      if (f && (!column.header || column.header === 'Nova Coluna')) {
                        updates.header = f.label || f.name;
                      }
                      handleColumnChange(index, updates);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar campo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_empty">Selecione...</SelectItem>
                      {columnFields.map((f) => (
                        <SelectItem key={f.slug} value={f.slug}>
                          {f.label || f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="Titulo da coluna"
                  value={column.header}
                  onChange={(e) => handleColumnChange(index, { header: e.target.value })}
                  className="flex-1 min-w-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive flex-shrink-0"
                  onClick={() => handleRemoveColumn(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Linha 2: Formato + Alinhamento + Largura (px) */}
              <div className="flex items-center gap-2">
                <Select
                  value={column.format || 'text'}
                  onValueChange={(value) =>
                    handleColumnChange(index, { format: value as TableColumn['format'] })
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Texto</SelectLabel>
                      <SelectItem value="text">Texto simples</SelectItem>
                      <SelectItem value="uppercase">MAIUSCULAS</SelectItem>
                      <SelectItem value="lowercase">minusculas</SelectItem>
                      <SelectItem value="titlecase">Primeira Maiuscula</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Numeros</SelectLabel>
                      <SelectItem value="number">Numero (1.234)</SelectItem>
                      <SelectItem value="currency">Moeda (R$ 1.234,56)</SelectItem>
                      <SelectItem value="percentage">Percentual (45,67%)</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Data / Hora</SelectLabel>
                      <SelectItem value="date">Data (20/02/2026)</SelectItem>
                      <SelectItem value="datetime">Data e Hora</SelectItem>
                      <SelectItem value="time">Apenas Hora</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Documentos</SelectLabel>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="cep">CEP</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Outros</SelectLabel>
                      <SelectItem value="boolean">Sim / Nao</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  value={column.align || 'left'}
                  onValueChange={(value) =>
                    handleColumnChange(index, { align: value as 'left' | 'center' | 'right' })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Esquerda</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                    <SelectItem value="right">Direita</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Largura"
                  value={column.width || ''}
                  onChange={(e) => handleColumnChange(index, { width: parseInt(e.target.value) || undefined })}
                  className="w-20"
                  title="Largura da coluna em pixels"
                />
              </div>

              {/* Linha 3: Valor padrao (opcional, sutil) */}
              {column.defaultValue !== undefined && column.defaultValue !== '' ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Texto quando vazio (ex: -, N/A)"
                    value={column.defaultValue || ''}
                    onChange={(e) => handleColumnChange(index, { defaultValue: e.target.value || undefined })}
                    className="flex-1 text-xs h-7"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-muted-foreground"
                    onClick={() => handleColumnChange(index, { defaultValue: undefined })}
                  >
                    Limpar
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => handleColumnChange(index, { defaultValue: '' })}
                >
                  + Definir texto para campo vazio
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      {element.dataSource && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Label>Filtrar registros</Label>
              {filters.length > 1 && (
                <Select
                  value={element.filterLogic || 'and'}
                  onValueChange={(v) => onChange({ filterLogic: v as 'and' | 'or' })}
                >
                  <SelectTrigger className="h-7 w-auto text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="and">Todos devem valer</SelectItem>
                    <SelectItem value="or">Pelo menos um</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleAddFilter}>
              <Plus className="h-4 w-4 mr-1" />
              Filtro
            </Button>
          </div>

          {filters.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum filtro — todos os registros aparecem na tabela
            </p>
          )}

          {filters.map((filter, index) => (
            <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
              <Select
                value={filter.field}
                onValueChange={(v) => handleFilterChange(index, { field: v })}
              >
                <SelectTrigger className="flex-1 min-w-0">
                  <SelectValue placeholder="Campo" />
                </SelectTrigger>
                <SelectContent>
                  {columnFields.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filter.operator}
                onValueChange={(v) => handleFilterChange(index, { operator: v as TableRowFilter['operator'] })}
              >
                <SelectTrigger className="w-36">
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
                className="text-destructive flex-shrink-0"
                onClick={() => handleRemoveFilter(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Ordenacao */}
      {element.dataSource && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Label>Ordenar por</Label>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddSort}>
              <Plus className="h-4 w-4 mr-1" />
              Ordenar
            </Button>
          </div>

          {sorting.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sem ordenacao — registros aparecem na ordem original
            </p>
          )}

          {sorting.map((rule, index) => (
            <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
              <Select
                value={rule.field}
                onValueChange={(v) => handleSortChange(index, { field: v })}
              >
                <SelectTrigger className="flex-1 min-w-0">
                  <SelectValue placeholder="Campo" />
                </SelectTrigger>
                <SelectContent>
                  {columnFields.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={rule.direction}
                onValueChange={(v) => handleSortChange(index, { direction: v as 'asc' | 'desc' })}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Crescente (A→Z)</SelectItem>
                  <SelectItem value="desc">Decrescente (Z→A)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive flex-shrink-0"
                onClick={() => handleRemoveSort(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
