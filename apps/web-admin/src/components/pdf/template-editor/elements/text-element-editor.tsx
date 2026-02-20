'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TextElement } from '@/services/pdf-templates.service';

interface TextElementEditorProps {
  element: TextElement;
  onChange: (updates: Partial<TextElement>) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function TextElementEditor({ element, onChange, availableFields }: TextElementEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Conteudo</Label>
        <Textarea
          placeholder="Digite o texto... Use {{campo}} para valores dinamicos"
          value={element.content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Use {`{{campo}}`} para inserir valores dinamicos. Ex: Chassi: {`{{chassi}}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Tamanho da Fonte</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[element.fontSize || 10]}
              onValueChange={([value]) => onChange({ fontSize: value })}
              min={6}
              max={24}
              step={1}
              className="flex-1"
            />
            <span className="w-10 text-sm text-muted-foreground">
              {element.fontSize || 10}pt
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Alinhamento</Label>
          <Select
            value={element.align || 'left'}
            onValueChange={(value) => onChange({ align: value as 'left' | 'center' | 'right' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Esquerda</SelectItem>
              <SelectItem value="center">Centro</SelectItem>
              <SelectItem value="right">Direita</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Cor</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={element.color || '#000000'}
              onChange={(e) => onChange({ color: e.target.value })}
              className="w-12 h-9 p-1"
            />
            <Input
              value={element.color || '#000000'}
              onChange={(e) => onChange({ color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={element.fontWeight === 'bold'}
          onCheckedChange={(checked) => onChange({ fontWeight: checked ? 'bold' : 'normal' })}
        />
        <Label>Negrito</Label>
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
