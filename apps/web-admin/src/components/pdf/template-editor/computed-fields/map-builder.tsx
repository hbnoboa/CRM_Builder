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
import type { MapConfig } from '@/services/pdf-templates.service';

interface MapBuilderProps {
  config: MapConfig;
  onChange: (config: MapConfig) => void;
  availableFields: Array<{ slug: string; name: string; label?: string; type: string }>;
}

export function MapBuilder({ config, onChange, availableFields }: MapBuilderProps) {
  const selectableFields = availableFields.filter(
    (f) => !['image', 'images', 'sub-entity', 'array'].includes(f.type),
  );

  const handleMappingChange = (index: number, updates: Partial<MapConfig['mappings'][0]>) => {
    const newMappings = [...config.mappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    onChange({ ...config, mappings: newMappings });
  };

  const handleAddMapping = () => {
    onChange({
      ...config,
      mappings: [...config.mappings, { from: '', to: '' }],
    });
  };

  const handleRemoveMapping = (index: number) => {
    onChange({
      ...config,
      mappings: config.mappings.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-3">
      {/* Info */}
      <div className="rounded-md bg-blue-50 border border-blue-200 p-2 text-xs text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p>
            Substitui valores do campo original por textos personalizados.
            Exemplo: &quot;A&quot; vira &quot;Aprovado&quot;, &quot;R&quot; vira &quot;Reprovado&quot;.
          </p>
        </div>
      </div>

      {/* Campo de origem */}
      <div className="space-y-1">
        <Label className="text-xs">Qual campo transformar?</Label>
        <Select
          value={config.field || '_empty'}
          onValueChange={(value) => onChange({ ...config, field: value === '_empty' ? '' : value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o campo..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_empty">Selecione...</SelectItem>
            {selectableFields.map((f) => (
              <SelectItem key={f.slug} value={f.slug}>
                {f.label || f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de mapeamento */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Substituicoes</Label>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddMapping}>
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        </div>

        {config.mappings.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Adicione substituicoes para transformar os valores.
          </p>
        )}

        {config.mappings.map((mapping, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder="Valor original"
              value={mapping.from}
              onChange={(e) => handleMappingChange(index, { from: e.target.value })}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground flex-shrink-0">vira</span>
            <Input
              placeholder="Texto exibido"
              value={mapping.to}
              onChange={(e) => handleMappingChange(index, { to: e.target.value })}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive flex-shrink-0"
              onClick={() => handleRemoveMapping(index)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Valor padrao */}
      <div className="space-y-1">
        <Label className="text-xs">Quando nenhuma substituicao corresponder</Label>
        <Input
          placeholder="Manter o valor original"
          value={config.defaultMapping || ''}
          onChange={(e) => onChange({ ...config, defaultMapping: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
