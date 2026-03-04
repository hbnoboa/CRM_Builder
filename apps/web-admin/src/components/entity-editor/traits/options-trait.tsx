'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface OptionItem {
  value: string;
  label: string;
  color?: string;
}

interface OptionsTraitProps {
  value: string; // JSON string
  onChange: (value: string) => void;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#0f172a',
];

export function OptionsTraitEditor({ value, onChange }: OptionsTraitProps) {
  const [options, setOptions] = useState<OptionItem[]>(() => {
    try {
      const parsed = JSON.parse(value || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map((o: string | OptionItem) =>
        typeof o === 'string' ? { value: o, label: o } : o,
      );
    } catch {
      return [];
    }
  });

  const sync = (updated: OptionItem[]) => {
    setOptions(updated);
    onChange(JSON.stringify(updated));
  };

  const addOption = () => {
    const idx = options.length + 1;
    sync([...options, { value: `opcao_${idx}`, label: `Opcao ${idx}` }]);
  };

  const updateOption = (index: number, field: 'value' | 'label', val: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], [field]: val };
    // Auto-sync value from label if value was auto-generated
    if (field === 'label' && (updated[index].value === '' || updated[index].value.startsWith('opcao_'))) {
      updated[index].value = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    }
    sync(updated);
  };

  const setColor = (index: number, color: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], color };
    sync(updated);
  };

  const removeOption = (index: number) => {
    sync(options.filter((_, i) => i !== index));
  };

  const moveOption = (from: number, to: number) => {
    if (to < 0 || to >= options.length) return;
    const updated = [...options];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    sync(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Opcoes</span>
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addOption}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>

      {options.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-2">Nenhuma opcao. Clique em Adicionar.</p>
      )}

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1 group">
            <button
              className="cursor-grab text-muted-foreground hover:text-foreground p-0.5"
              title="Mover"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => moveOption(i, i - 1)}
            >
              <GripVertical className="h-3 w-3" />
            </button>

            {/* Color dot */}
            <div className="relative">
              <button
                className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                style={{ backgroundColor: opt.color || '#6b7280' }}
                title="Cor"
                onClick={(e) => {
                  const next = COLORS[(COLORS.indexOf(opt.color || '#6b7280') + 1) % COLORS.length];
                  setColor(i, next);
                  e.stopPropagation();
                }}
              />
            </div>

            <Input
              value={opt.label}
              onChange={(e) => updateOption(i, 'label', e.target.value)}
              className="h-7 text-xs flex-1"
              placeholder="Label"
            />

            <button
              className="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeOption(i)}
              title="Remover"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
