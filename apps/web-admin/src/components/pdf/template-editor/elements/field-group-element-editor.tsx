'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FieldGroupElement } from '@/services/pdf-templates.service';

interface FieldGroupElementEditorProps {
  element: FieldGroupElement;
  onChange: (updates: Partial<FieldGroupElement>) => void;
}

export function FieldGroupElementEditor({
  element,
  onChange,
}: FieldGroupElementEditorProps) {
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
        Configure os campos e bindings na aba Dados.
      </p>
    </div>
  );
}
