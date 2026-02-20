'use client';

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
import type { TableElement, TableColumn } from '@/services/pdf-templates.service';

interface TableElementEditorProps {
  element: TableElement;
  onChange: (updates: Partial<TableElement>) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function TableElementEditor({
  element,
  onChange,
  availableFields,
}: TableElementEditorProps) {
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Titulo (opcional)</Label>
          <Input
            placeholder="Ex: Nao Conformidades"
            value={element.title || ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>

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
                .filter((f) => f.type === 'relation' || f.type === 'array')
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
        </div>
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
              <Input
                placeholder="Campo"
                value={column.field}
                onChange={(e) => handleColumnChange(index, { field: e.target.value })}
                className="col-span-3"
              />
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

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={element.showHeader ?? true}
            onCheckedChange={(checked) => onChange({ showHeader: checked })}
          />
          <Label>Mostrar Cabecalho</Label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tamanho Fonte Cabecalho</Label>
          <Slider
            value={[element.headerStyle?.fontSize || 9]}
            onValueChange={([value]) =>
              onChange({ headerStyle: { ...element.headerStyle, fontSize: value } })
            }
            min={6}
            max={14}
            step={1}
          />
        </div>
        <div className="space-y-2">
          <Label>Tamanho Fonte Celulas</Label>
          <Slider
            value={[element.cellStyle?.fontSize || 8]}
            onValueChange={([value]) =>
              onChange({ cellStyle: { ...element.cellStyle, fontSize: value } })
            }
            min={6}
            max={12}
            step={1}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Mensagem quando vazio</Label>
        <Input
          placeholder="Ex: Nenhum registro encontrado"
          value={element.emptyMessage || ''}
          onChange={(e) => onChange({ emptyMessage: e.target.value })}
        />
      </div>
    </div>
  );
}
