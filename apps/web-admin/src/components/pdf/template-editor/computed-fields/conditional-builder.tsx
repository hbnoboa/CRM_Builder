'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConditionalConfig } from '@/services/pdf-templates.service';

const OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'not_equals', label: 'Diferente de' },
  { value: 'greater', label: 'Maior que' },
  { value: 'less', label: 'Menor que' },
  { value: 'contains', label: 'Contem' },
  { value: 'not_empty', label: 'Nao vazio' },
  { value: 'has_items', label: 'Possui itens' },
  { value: 'no_items', label: 'Nao possui itens' },
] as const;

const NO_VALUE_OPERATORS = ['not_empty', 'has_items', 'no_items'];

interface ConditionalBuilderProps {
  config: ConditionalConfig;
  onChange: (config: ConditionalConfig) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function ConditionalBuilder({ config, onChange, availableFields }: ConditionalBuilderProps) {
  const selectableFields = availableFields.filter(
    (f) => !['image', 'images'].includes(f.type),
  );

  const handleResultChange = (
    key: 'trueResult' | 'falseResult',
    updates: Partial<ConditionalConfig['trueResult']>,
  ) => {
    onChange({ ...config, [key]: { ...config[key], ...updates } });
  };

  const renderResultInput = (key: 'trueResult' | 'falseResult', label: string) => {
    const result = config[key];
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-2">
          <Select
            value={result.type}
            onValueChange={(type) =>
              handleResultChange(key, {
                type: type as 'text' | 'field',
                value: type === 'field' ? (selectableFields[0]?.slug || '') : '',
              })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto fixo</SelectItem>
              <SelectItem value="field">Valor de campo</SelectItem>
            </SelectContent>
          </Select>

          {result.type === 'field' ? (
            <Select
              value={result.value}
              onValueChange={(value) => handleResultChange(key, { value })}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Campo..." />
              </SelectTrigger>
              <SelectContent>
                {selectableFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>
                    {f.label || f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Texto..."
              value={result.value}
              onChange={(e) => handleResultChange(key, { value: e.target.value })}
              className="flex-1"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Condicao */}
      <div className="space-y-1">
        <Label className="text-xs">Se</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={config.field}
            onValueChange={(field) => onChange({ ...config, field })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Campo..." />
            </SelectTrigger>
            <SelectContent>
              {selectableFields.map((f) => (
                <SelectItem key={f.slug} value={f.slug}>
                  {f.label || f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={config.operator}
            onValueChange={(operator) =>
              onChange({ ...config, operator: operator as ConditionalConfig['operator'] })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!NO_VALUE_OPERATORS.includes(config.operator) && (
            <Input
              placeholder="Valor..."
              value={config.compareValue}
              onChange={(e) => onChange({ ...config, compareValue: e.target.value })}
              className="w-40"
            />
          )}
        </div>
      </div>

      {/* Resultados */}
      {renderResultInput('trueResult', 'Entao')}
      {renderResultInput('falseResult', 'Senao')}
    </div>
  );
}
