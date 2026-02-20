'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { DividerElement } from '@/services/pdf-templates.service';

interface DividerElementEditorProps {
  element: DividerElement;
  onChange: (updates: Partial<DividerElement>) => void;
}

export function DividerElementEditor({ element, onChange }: DividerElementEditorProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Cor da Linha</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={element.color || '#cccccc'}
              onChange={(e) => onChange({ color: e.target.value })}
              className="w-12 h-9 p-1"
            />
            <Input
              value={element.color || '#cccccc'}
              onChange={(e) => onChange({ color: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Espessura (px)</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[element.thickness || 1]}
              onValueChange={([value]) => onChange({ thickness: value })}
              min={1}
              max={5}
              step={0.5}
              className="flex-1"
            />
            <span className="w-10 text-sm text-muted-foreground">
              {element.thickness || 1}px
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
    </div>
  );
}
