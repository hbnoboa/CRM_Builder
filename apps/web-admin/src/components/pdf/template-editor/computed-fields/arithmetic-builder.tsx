'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ArithmeticConfig } from '@/services/pdf-templates.service';

const OPERATORS = [
  { value: '+', label: '+' },
  { value: '-', label: '-' },
  { value: '*', label: 'x' },
  { value: '/', label: '/' },
] as const;

interface ArithmeticBuilderProps {
  config: ArithmeticConfig;
  onChange: (config: ArithmeticConfig) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function ArithmeticBuilder({ config, onChange, availableFields }: ArithmeticBuilderProps) {
  const numericFields = availableFields.filter(
    (f) => ['number', 'integer', 'float', 'currency'].includes(f.type),
  );

  const handleOperandChange = (index: number, updates: Partial<ArithmeticConfig['operands'][0]>) => {
    const newOperands = [...config.operands];
    newOperands[index] = { ...newOperands[index], ...updates };
    onChange({ ...config, operands: newOperands });
  };

  const handleOperatorChange = (index: number, value: string) => {
    const newOperators = [...config.operators];
    newOperators[index] = value as '+' | '-' | '*' | '/';
    onChange({ ...config, operators: newOperators });
  };

  const handleAddOperation = () => {
    onChange({
      operands: [...config.operands, { type: 'number', value: '0' }],
      operators: [...config.operators, '+'],
    });
  };

  const handleRemoveOperation = (index: number) => {
    // Remove operand at index+1 and operator at index
    const newOperands = config.operands.filter((_, i) => i !== index + 1);
    const newOperators = config.operators.filter((_, i) => i !== index);
    onChange({ operands: newOperands, operators: newOperators });
  };

  const renderOperand = (operand: ArithmeticConfig['operands'][0], index: number) => (
    <div className="flex items-center gap-1">
      <Select
        value={operand.type}
        onValueChange={(type) =>
          handleOperandChange(index, {
            type: type as 'field' | 'number',
            value: type === 'number' ? '0' : (numericFields[0]?.slug || ''),
          })
        }
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="field">Campo</SelectItem>
          <SelectItem value="number">Numero</SelectItem>
        </SelectContent>
      </Select>

      {operand.type === 'field' ? (
        <Select
          value={operand.value}
          onValueChange={(value) => handleOperandChange(index, { value })}
        >
          <SelectTrigger className="flex-1 min-w-[120px]">
            <SelectValue placeholder="Campo..." />
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
      ) : (
        <Input
          type="number"
          value={operand.value}
          onChange={(e) => handleOperandChange(index, { value: e.target.value })}
          className="w-24"
        />
      )}
    </div>
  );

  // Build formula preview
  const formulaParts: string[] = [];
  for (let i = 0; i < config.operands.length; i++) {
    const op = config.operands[i];
    if (op.type === 'field') {
      const field = availableFields.find((f) => f.slug === op.value);
      formulaParts.push(field?.label || field?.name || op.value);
    } else {
      formulaParts.push(op.value);
    }
    if (i < config.operators.length) {
      formulaParts.push(` ${config.operators[i]} `);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {config.operands.map((operand, index) => (
          <div key={index}>
            {/* Operand */}
            {renderOperand(operand, index)}

            {/* Operator (between operands) */}
            {index < config.operators.length && (
              <div className="flex items-center gap-1 ml-4 my-1">
                <Select
                  value={config.operators[index]}
                  onValueChange={(value) => handleOperatorChange(index, value)}
                >
                  <SelectTrigger className="w-16">
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
                {config.operands.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleRemoveOperation(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={handleAddOperation}>
        <Plus className="h-3 w-3 mr-1" />
        Adicionar operacao
      </Button>

      {/* Preview */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
        Formula: <span className="font-mono">{formulaParts.join('')}</span>
      </div>
    </div>
  );
}
