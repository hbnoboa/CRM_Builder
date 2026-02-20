'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StatisticsElement } from '@/services/pdf-templates.service';

interface StatisticsElementEditorProps {
  element: StatisticsElement;
  onChange: (updates: Partial<StatisticsElement>) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function StatisticsElementEditor({
  element,
  onChange,
  availableFields,
}: StatisticsElementEditorProps) {
  const handleAddGroupBy = () => {
    onChange({
      groupBy: [...element.groupBy, ''],
    });
  };

  const handleRemoveGroupBy = (index: number) => {
    onChange({
      groupBy: element.groupBy.filter((_, i) => i !== index),
    });
  };

  const handleGroupByChange = (index: number, value: string) => {
    const newGroupBy = [...element.groupBy];
    newGroupBy[index] = value;
    onChange({ groupBy: newGroupBy });
  };

  const handleAddMetric = () => {
    onChange({
      metrics: [
        ...element.metrics,
        { field: '', aggregation: 'count' as const, label: 'Novo Metrico' },
      ],
    });
  };

  const handleRemoveMetric = (index: number) => {
    onChange({
      metrics: element.metrics.filter((_, i) => i !== index),
    });
  };

  const handleMetricChange = (
    index: number,
    updates: Partial<StatisticsElement['metrics'][0]>
  ) => {
    const newMetrics = [...element.metrics];
    newMetrics[index] = { ...newMetrics[index], ...updates };
    onChange({ metrics: newMetrics });
  };

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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Agrupar Por</Label>
          <Button variant="outline" size="sm" onClick={handleAddGroupBy}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Campos pelos quais os dados serao agrupados
        </p>

        <div className="space-y-2">
          {element.groupBy.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select value={field} onValueChange={(value) => handleGroupByChange(index, value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um campo" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => handleRemoveGroupBy(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Metricas</Label>
          <Button variant="outline" size="sm" onClick={handleAddMetric}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Calculos que serao exibidos para cada grupo
        </p>

        <div className="space-y-2">
          {element.metrics.map((metric, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 p-2 border rounded-md">
              <Select
                value={metric.field}
                onValueChange={(value) => handleMetricChange(index, { field: value })}
              >
                <SelectTrigger className="col-span-4">
                  <SelectValue placeholder="Campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_count">_count (contagem)</SelectItem>
                  <SelectItem value="_damagePercentage">_damagePercentage (%)</SelectItem>
                  {availableFields.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={metric.aggregation}
                onValueChange={(value) =>
                  handleMetricChange(index, {
                    aggregation: value as 'count' | 'sum' | 'avg' | 'percentage',
                  })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Contagem</SelectItem>
                  <SelectItem value="sum">Soma</SelectItem>
                  <SelectItem value="avg">Media</SelectItem>
                  <SelectItem value="percentage">Porcentagem</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Label"
                value={metric.label}
                onChange={(e) => handleMetricChange(index, { label: e.target.value })}
                className="col-span-4"
              />

              <Button
                variant="ghost"
                size="icon"
                className="col-span-1 text-destructive"
                onClick={() => handleRemoveMetric(index)}
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
