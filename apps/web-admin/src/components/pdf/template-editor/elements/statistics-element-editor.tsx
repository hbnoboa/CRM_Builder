'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { StatisticsElement } from '@/services/pdf-templates.service';

interface StatisticsElementEditorProps {
  element: StatisticsElement;
  onChange: (updates: Partial<StatisticsElement>) => void;
}

export function StatisticsElementEditor({
  element,
  onChange,
}: StatisticsElementEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Titulo</Label>
        <Input
          placeholder="Ex: Estatisticas de Descarregamento"
          value={element.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Altura das Linhas (px)</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[element.rowHeight || 20]}
              onValueChange={([value]) => onChange({ rowHeight: value })}
              min={15}
              max={40}
              step={1}
              className="flex-1"
            />
            <span className="w-10 text-xs text-muted-foreground text-right">
              {element.rowHeight || 20}px
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Cor do Header</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={element.headerFill || '#E2E8F0'}
              onChange={(e) => onChange({ headerFill: e.target.value })}
              className="w-8 h-8 rounded border cursor-pointer"
            />
            <Input
              value={element.headerFill || '#E2E8F0'}
              onChange={(e) => onChange({ headerFill: e.target.value || null })}
              placeholder="Hex ou vazio"
              className="flex-1"
            />
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
        Configure agrupamento e metricas na aba Dados.
      </p>
    </div>
  );
}
