'use client';

import { Plus, Trash2 } from 'lucide-react';
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
import type { TableElement, TableColumn } from '@/services/pdf-templates.service';

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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Fonte de Dados (array)</Label>
        <Select
          value={element.dataSource || '_self'}
          onValueChange={(value) => onChange({ dataSource: value === '_self' ? undefined : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_self">Registro Principal</SelectItem>
            {availableFields
              .filter((f) => f.type === 'relation' || f.type === 'array' || f.type === 'sub-entity')
              .map((f) => (
                <SelectItem key={f.slug} value={f.slug}>
                  {f.label || f.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Campo que contem os dados da tabela (array ou relacao)
        </p>
        {element.dataSource && subEntities?.[element.dataSource] && (
          <p className="text-xs text-blue-600">
            Campos da sub-entidade: {subEntities[element.dataSource].name}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Colunas</Label>
          <Button variant="outline" size="sm" onClick={handleAddColumn}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {element.columns.map((column, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 p-2 border rounded-md">
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
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Campo" />
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
              <Input
                placeholder="Cabecalho"
                value={column.header}
                onChange={(e) => handleColumnChange(index, { header: e.target.value })}
                className="col-span-3"
              />
              <Input
                type="number"
                placeholder="Largura"
                value={column.width || ''}
                onChange={(e) => handleColumnChange(index, { width: parseInt(e.target.value) || undefined })}
                className="col-span-2"
              />
              <Select
                value={column.align || 'left'}
                onValueChange={(value) =>
                  handleColumnChange(index, { align: value as 'left' | 'center' | 'right' })
                }
              >
                <SelectTrigger className="col-span-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={column.format || 'text'}
                onValueChange={(value) =>
                  handleColumnChange(index, {
                    format: value as 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'percentage',
                  })
                }
              >
                <SelectTrigger className="col-span-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="number">Numero</SelectItem>
                  <SelectItem value="currency">Moeda</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="datetime">Data/Hora</SelectItem>
                  <SelectItem value="percentage">%</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="col-span-1 text-destructive"
                onClick={() => handleRemoveColumn(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
