'use client';

import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StatisticsElement } from '@/services/pdf-templates.service';

const AGGREGATION_OPTIONS = [
  { value: 'count', label: 'Contagem', description: 'Quantos registros no grupo', needsField: false },
  { value: 'sum', label: 'Soma', description: 'Soma dos valores', needsField: true },
  { value: 'avg', label: 'Media', description: 'Media dos valores', needsField: true },
  { value: 'min', label: 'Menor valor', description: 'Menor valor no grupo', needsField: true },
  { value: 'max', label: 'Maior valor', description: 'Maior valor no grupo', needsField: true },
  { value: 'percentage', label: 'Percentual', description: 'Percentual com condicao', needsField: false },
];

const PERCENTAGE_OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'greater', label: 'Maior que' },
  { value: 'less', label: 'Menor que' },
  { value: 'contains', label: 'Contem' },
  { value: 'not_empty', label: 'Preenchido' },
];

const NO_VALUE_OPERATORS = ['not_empty', 'has_items', 'no_items'];

interface StatisticsDataEditorProps {
  element: StatisticsElement;
  onChange: (updates: Partial<StatisticsElement>) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function StatisticsDataEditor({
  element,
  onChange,
  availableFields,
}: StatisticsDataEditorProps) {
  const numericFields = availableFields.filter(
    (f) => ['number', 'integer', 'float', 'currency'].includes(f.type),
  );

  const groupableFields = availableFields.filter(
    (f) => !['image', 'images', 'sub-entity', 'array'].includes(f.type),
  );

  const handleAddGroupBy = () => {
    onChange({ groupBy: [...element.groupBy, ''] });
  };

  const handleRemoveGroupBy = (index: number) => {
    onChange({ groupBy: element.groupBy.filter((_, i) => i !== index) });
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
    onChange({ metrics: element.metrics.filter((_, i) => i !== index) });
  };

  const handleMetricChange = (
    index: number,
    updates: Partial<StatisticsElement['metrics'][0]>,
  ) => {
    const newMetrics = [...element.metrics];
    newMetrics[index] = { ...newMetrics[index], ...updates };
    onChange({ metrics: newMetrics });
  };

  return (
    <div className="space-y-4">
      {/* Info box */}
      <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            Os registros sao agrupados pelos campos abaixo. Para cada grupo, as colunas
            de resultado calculam valores automaticamente.
          </p>
        </div>
      </div>

      {/* Agrupar por */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Agrupar registros por</Label>
          <Button variant="outline" size="sm" onClick={handleAddGroupBy}>
            <Plus className="h-4 w-4 mr-1" />
            Campo
          </Button>
        </div>

        {element.groupBy.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Adicione pelo menos um campo para agrupar.
          </p>
        )}

        <div className="space-y-2">
          {element.groupBy.map((field, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select value={field} onValueChange={(value) => handleGroupByChange(index, value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um campo" />
                </SelectTrigger>
                <SelectContent>
                  {groupableFields.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.label || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive flex-shrink-0"
                onClick={() => handleRemoveGroupBy(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Colunas de resultado */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Colunas de resultado</Label>
          <Button variant="outline" size="sm" onClick={handleAddMetric}>
            <Plus className="h-4 w-4 mr-1" />
            Coluna
          </Button>
        </div>

        {element.metrics.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Adicione colunas para calcular valores por grupo.
          </p>
        )}

        <div className="space-y-2">
          {element.metrics.map((metric, index) => {
            const aggInfo = AGGREGATION_OPTIONS.find((a) => a.value === metric.aggregation);

            return (
              <div key={index} className="p-3 border rounded-md space-y-2">
                {/* Linha 1: Nome da coluna + Remover */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nome da coluna (ex: Quantidade)"
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

                {/* Linha 2: Tipo de calculo + Campo (se necessario) */}
                <div className="flex items-center gap-2">
                  <Select
                    value={metric.aggregation}
                    onValueChange={(value) => {
                      const agg = value as StatisticsElement['metrics'][0]['aggregation'];
                      const updates: Partial<StatisticsElement['metrics'][0]> = { aggregation: agg };
                      if (agg === 'count') {
                        updates.field = '_count';
                      } else if (agg === 'percentage') {
                        updates.field = '_percentage';
                      } else if (!numericFields.some((f) => f.slug === metric.field)) {
                        updates.field = numericFields[0]?.slug || '';
                      }
                      if (agg !== 'percentage') {
                        updates.percentageFilter = undefined;
                      }
                      handleMetricChange(index, updates);
                    }}
                  >
                    <SelectTrigger className="w-44">
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

                  {aggInfo?.needsField && (
                    <Select
                      value={metric.field}
                      onValueChange={(value) => handleMetricChange(index, { field: value })}
                    >
                      <SelectTrigger className="flex-1 min-w-0">
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

                  {!aggInfo?.needsField && (
                    <span className="text-xs text-muted-foreground">
                      {metric.aggregation === 'count'
                        ? 'Conta registros por grupo'
                        : 'Registros que atendem a condicao'}
                    </span>
                  )}
                </div>

                {/* Condicao do percentual */}
                {metric.aggregation === 'percentage' && (
                  <div className="space-y-2 rounded-md border border-dashed p-2">
                    <Label className="text-xs text-muted-foreground">
                      Contar registros onde...
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={metric.percentageFilter?.field || '_default'}
                        onValueChange={(v) => {
                          if (v === '_default') {
                            handleMetricChange(index, { percentageFilter: undefined });
                          } else {
                            handleMetricChange(index, {
                              percentageFilter: {
                                field: v,
                                operator: metric.percentageFilter?.operator || 'not_empty',
                                value: metric.percentageFilter?.value || '',
                              },
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1 min-w-0">
                          <SelectValue placeholder="Campo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_default">Padrao (tem sub-registros)</SelectItem>
                          {availableFields
                            .filter((f) => !['image', 'images'].includes(f.type))
                            .map((f) => (
                              <SelectItem key={f.slug} value={f.slug}>
                                {f.label || f.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {metric.percentageFilter && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={metric.percentageFilter.operator}
                          onValueChange={(v) =>
                            handleMetricChange(index, {
                              percentageFilter: { ...metric.percentageFilter!, operator: v },
                            })
                          }
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PERCENTAGE_OPERATORS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!NO_VALUE_OPERATORS.includes(metric.percentageFilter.operator) && (
                          <Input
                            placeholder="Valor"
                            value={metric.percentageFilter.value}
                            onChange={(e) =>
                              handleMetricChange(index, {
                                percentageFilter: { ...metric.percentageFilter!, value: e.target.value },
                              })
                            }
                            className="flex-1"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
