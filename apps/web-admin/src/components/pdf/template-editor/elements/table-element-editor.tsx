'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import type { TableElement } from '@/services/pdf-templates.service';

interface TableElementEditorProps {
  element: TableElement;
  onChange: (updates: Partial<TableElement>) => void;
}

export function TableElementEditor({
  element,
  onChange,
}: TableElementEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Titulo (opcional)</Label>
        <Input
          placeholder="Ex: Nao Conformidades"
          value={element.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
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

      <p className="text-xs text-muted-foreground">
        Configure a fonte de dados e colunas na aba Dados.
      </p>
    </div>
  );
}
