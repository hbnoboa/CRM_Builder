'use client';

import { Plus, Trash2, Info } from 'lucide-react';
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

const AGGREGATION_OPTIONS = [
  { value: 'count', label: 'Contagem', description: 'Quantos registros no grupo' },
  { value: 'sum', label: 'Soma', description: 'Soma dos valores do campo' },
  { value: 'avg', label: 'Media', description: 'Media dos valores do campo' },
  { value: 'percentage', label: '% Avariados', description: 'Percentual com sub-entidade' },
];

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
  // Campos numericos (para sum/avg)
  const numericFields = availableFields.filter(
    (f) => ['number', 'integer', 'float', 'currency'].includes(f.type),
  );

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
        { field: '_count', aggregation: 'count' as const, label: 'Qtd' },
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
    updates: Partial<StatisticsElement['metrics'][0]>,
  ) => {
    const newMetrics = [...element.metrics];
    newMetrics[index] = { ...newMetrics[index], ...updates };
    onChange({ metrics: newMetrics });
  };

  const needsFieldSelect = (aggregation: string) =>
    aggregation === 'sum' || aggregation === 'avg';

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

      {/* Info box */}
      <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Como funciona</p>
            <p className="mt-1 opacity-80">
              Os registros do lote sao agrupados pelos campos escolhidos abaixo.
              Para cada grupo, as metricas calculam valores automaticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Agrupar por */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Agrupar por</Label>
          <Button variant="outline" size="sm" onClick={handleAddGroupBy}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada combinacao unica destes campos vira uma linha na tabela.
        </p>

        <div className="space-y-2">
          {element.groupBy.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select value={field} onValueChange={(value) => handleGroupByChange(index, value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um campo" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields
                    .filter((f) => !['image', 'images', 'sub-entity', 'array'].includes(f.type))
                    .map((f) => (
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

      {/* Metricas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Colunas de metricas</Label>
          <Button variant="outline" size="sm" onClick={handleAddMetric}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada metrica vira uma coluna na tabela de resultados.
        </p>

        <div className="space-y-2">
          {element.metrics.map((metric, index) => (
            <div key={index} className="p-3 border rounded-md space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nome da coluna"
                  value={metric.label}
                  onChange={(e) => handleMetricChange(index, { label: e.target.value })}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive flex-shrink-0"
                  onClick={() => handleRemoveMetric(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={metric.aggregation}
                  onValueChange={(value) => {
                    const agg = value as 'count' | 'sum' | 'avg' | 'percentage';
                    const updates: Partial<StatisticsElement['metrics'][0]> = { aggregation: agg };
                    // Se mudou para count/percentage, limpar campo
                    if (agg === 'count' || agg === 'percentage') {
                      updates.field = `_${agg}`;
                    } else if (!numericFields.some((f) => f.slug === metric.field)) {
                      // Se precisa de campo e o atual nao e numerico, selecionar primeiro
                      updates.field = numericFields[0]?.slug || '';
                    }
                    handleMetricChange(index, updates);
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {needsFieldSelect(metric.aggregation) && (
                  <Select
                    value={metric.field}
                    onValueChange={(value) => handleMetricChange(index, { field: value })}
                  >
                    <SelectTrigger className="flex-1 min-w-[140px]">
                      <SelectValue placeholder="Campo numerico..." />
                    </SelectTrigger>
                    <SelectContent>
                      {numericFields.length > 0 ? (
                        numericFields.map((f) => (
                          <SelectItem key={f.slug} value={f.slug}>
                            {f.label || f.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="_none" disabled>
                          Nenhum campo numerico
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}

                {!needsFieldSelect(metric.aggregation) && (
                  <span className="text-xs text-muted-foreground">
                    {metric.aggregation === 'count'
                      ? 'Conta registros por grupo'
                      : 'Registros com sub-entidade / total'}
                  </span>
                )}
              </div>
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
