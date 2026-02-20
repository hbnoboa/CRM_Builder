'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { SpacerElement } from '@/services/pdf-templates.service';

interface SpacerElementEditorProps {
  element: SpacerElement;
  onChange: (updates: Partial<SpacerElement>) => void;
}

export function SpacerElementEditor({ element, onChange }: SpacerElementEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Altura do Espaco (px)</Label>
        <div className="flex items-center gap-4">
          <Slider
            value={[element.height || 20]}
            onValueChange={([value]) => onChange({ height: value })}
            min={5}
            max={100}
            step={5}
            className="flex-1"
          />
          <span className="w-12 text-sm text-muted-foreground">{element.height || 20}px</span>
        </div>
      </div>

      <div className="p-4 bg-muted rounded-md text-center text-sm text-muted-foreground">
        <div
          className="mx-auto bg-primary/20 border border-dashed border-primary/50 rounded"
          style={{ height: element.height || 20 }}
        />
        <p className="mt-2">Preview do espaco</p>
      </div>
    </div>
  );
}
