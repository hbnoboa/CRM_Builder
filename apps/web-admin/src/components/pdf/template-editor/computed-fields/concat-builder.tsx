'use client';

import { Plus, Trash2 } from 'lucide-react';
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
import type { ConcatConfig } from '@/services/pdf-templates.service';

interface ConcatBuilderProps {
  config: ConcatConfig;
  onChange: (config: ConcatConfig) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function ConcatBuilder({ config, onChange, availableFields }: ConcatBuilderProps) {
  const selectableFields = availableFields.filter(
    (f) => !['image', 'images', 'sub-entity', 'array'].includes(f.type),
  );

  const handlePartChange = (index: number, updates: Partial<ConcatConfig['parts'][0]>) => {
    const newParts = [...config.parts];
    newParts[index] = { ...newParts[index], ...updates };
    onChange({ ...config, parts: newParts });
  };

  const handleAddPart = () => {
    onChange({
      ...config,
      parts: [...config.parts, { type: 'field', value: selectableFields[0]?.slug || '' }],
    });
  };

  const handleRemovePart = (index: number) => {
    onChange({
      ...config,
      parts: config.parts.filter((_, i) => i !== index),
    });
  };

  // Build preview
  const previewParts = config.parts.map((p) => {
    if (p.type === 'field') {
      const field = availableFields.find((f) => f.slug === p.value);
      return `[${field?.label || field?.name || p.value}]`;
    }
    return `"${p.value}"`;
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Separador</Label>
        <Input
          placeholder="Ex: - ou , ou espaco"
          value={config.separator}
          onChange={(e) => onChange({ ...config, separator: e.target.value })}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Partes</Label>
        <div className="space-y-2">
          {config.parts.map((part, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={part.type}
                onValueChange={(type) =>
                  handlePartChange(index, {
                    type: type as 'field' | 'text',
                    value: type === 'field' ? (selectableFields[0]?.slug || '') : '',
                  })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="field">Campo</SelectItem>
                  <SelectItem value="text">Texto fixo</SelectItem>
                </SelectContent>
              </Select>

              {part.type === 'field' ? (
                <Select
                  value={part.value}
                  onValueChange={(value) => handlePartChange(index, { value })}
                >
                  <SelectTrigger className="flex-1 min-w-[120px]">
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
                  value={part.value}
                  onChange={(e) => handlePartChange(index, { value: e.target.value })}
                  className="flex-1"
                />
              )}

              {config.parts.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => handleRemovePart(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={handleAddPart}>
        <Plus className="h-3 w-3 mr-1" />
        Adicionar parte
      </Button>

      {/* Preview */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
        Resultado: <span className="font-mono">{previewParts.join(config.separator || '')}</span>
      </div>
    </div>
  );
}
