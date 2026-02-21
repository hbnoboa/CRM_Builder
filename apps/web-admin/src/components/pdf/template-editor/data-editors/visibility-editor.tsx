'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { VisibilityCondition } from '@/services/pdf-templates.service';

const OPERATORS = [
  { value: 'equals', label: 'Igual a', needsValue: true },
  { value: 'not_equals', label: 'Diferente de', needsValue: true },
  { value: 'greater', label: 'Maior que', needsValue: true },
  { value: 'less', label: 'Menor que', needsValue: true },
  { value: 'contains', label: 'Contem', needsValue: true },
  { value: 'not_empty', label: 'Preenchido', needsValue: false },
  { value: 'has_items', label: 'Tem registros', needsValue: false },
  { value: 'no_items', label: 'Sem registros', needsValue: false },
] as const;

interface VisibilityEditorProps {
  visibility?: VisibilityCondition;
  onChange: (visibility: VisibilityCondition | undefined) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function VisibilityEditor({
  visibility,
  onChange,
  availableFields,
}: VisibilityEditorProps) {
  const isEnabled = !!visibility;

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onChange({
        field: availableFields[0]?.slug || '',
        operator: 'not_empty',
      });
    } else {
      onChange(undefined);
    }
  };

  const operatorInfo = OPERATORS.find((op) => op.value === visibility?.operator);

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEnabled ? (
            <Eye className="h-4 w-4 text-muted-foreground" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <Label className="text-sm font-medium">Mostrar somente quando...</Label>
        </div>
        <Switch checked={isEnabled} onCheckedChange={handleToggle} />
      </div>

      {isEnabled && visibility && (
        <div className="space-y-2">
          {/* Linha 1: Campo + Condicao */}
          <div className="flex items-center gap-2">
            <Select
              value={visibility.field}
              onValueChange={(value) => onChange({ ...visibility, field: value })}
            >
              <SelectTrigger className="flex-1 min-w-0">
                <SelectValue placeholder="Selecionar campo" />
              </SelectTrigger>
              <SelectContent>
                {availableFields.map((f) => (
                  <SelectItem key={f.slug} value={f.slug}>
                    {f.label || f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={visibility.operator}
              onValueChange={(value) =>
                onChange({ ...visibility, operator: value as VisibilityCondition['operator'] })
              }
            >
              <SelectTrigger className="w-44">
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
          </div>

          {/* Linha 2: Valor (quando necessario) */}
          {operatorInfo?.needsValue && (
            <Input
              value={visibility.value || ''}
              onChange={(e) => onChange({ ...visibility, value: e.target.value })}
              placeholder="Valor para comparar"
            />
          )}

          <p className="text-xs text-muted-foreground">
            Este elemento so aparece no PDF se a condicao acima for verdadeira.
          </p>
        </div>
      )}
    </div>
  );
}
