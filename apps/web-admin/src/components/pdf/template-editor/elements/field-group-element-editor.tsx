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
import type { FieldGroupElement } from '@/services/pdf-templates.service';

interface FieldGroupElementEditorProps {
  element: FieldGroupElement;
  onChange: (updates: Partial<FieldGroupElement>) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function FieldGroupElementEditor({
  element,
  onChange,
  availableFields,
}: FieldGroupElementEditorProps) {
  const handleFieldChange = (index: number, updates: Partial<FieldGroupElement['fields'][0]>) => {
    const newFields = [...element.fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange({ fields: newFields });
  };

  const handleAddField = () => {
    onChange({
      fields: [
        ...element.fields,
        { label: 'Campo:', binding: '{{campo}}', labelBold: true },
      ],
    });
  };

  const handleRemoveField = (index: number) => {
    onChange({
      fields: element.fields.filter((_, i) => i !== index),
    });
  };

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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Campos</Label>
          <Button variant="outline" size="sm" onClick={handleAddField}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {element.fields.map((field, index) => (
            <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
              <Input
                placeholder="Label"
                value={field.label}
                onChange={(e) => handleFieldChange(index, { label: e.target.value })}
                className="flex-1"
              />
              <Select
                value={field.binding.replace(/\{\{|\}\}/g, '')}
                onValueChange={(value) => handleFieldChange(index, { binding: `{{${value}}}` })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Campo" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Personalizado...</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Switch
                  checked={field.labelBold}
                  onCheckedChange={(checked) => handleFieldChange(index, { labelBold: checked })}
                />
                <span className="text-xs">B</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => handleRemoveField(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
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
    </div>
  );
}
