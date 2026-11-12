'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, GripVertical, ChevronDown, ClipboardPaste } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionItem {
  value: string;
  label: string;
  color?: string;
  customValue?: boolean; // Flag para indicar que o value foi editado manualmente
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
      // Opcoes JA EXISTENTES entram como customValue=true: editar o label NAO deve
      // re-slugificar o `value`, senao diverge dos registros ja gravados (que usam
      // o value original). Opcoes novas (addOption) continuam auto-sincronizando.
      return parsed.map((o: string | OptionItem) =>
        typeof o === 'string'
          ? { value: o, label: o, customValue: true }
          : { ...o, customValue: true },
      );
    } catch {
      return [];
    }
  });
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Importa opcoes em massa: aceita JSON (array de strings ou de {value,label})
  // OU uma lista simples com uma opcao por linha. Opcoes importadas entram como
  // customValue para nao re-slugificar (ver fix #1).
  const applyImport = (mode: 'replace' | 'append') => {
    const raw = importText.trim();
    if (!raw) { setImportError('Cole as opcoes primeiro.'); return; }
    let parsed: OptionItem[];
    try {
      const asJson = JSON.parse(raw);
      if (!Array.isArray(asJson)) throw new Error('nao e array');
      parsed = asJson.map((o: string | OptionItem) =>
        typeof o === 'string'
          ? { value: o, label: o, customValue: true }
          : { value: String(o.value ?? o.label ?? ''), label: String(o.label ?? o.value ?? ''), color: o.color, customValue: true },
      );
    } catch {
      // Fallback: uma opcao por linha (label = value)
      parsed = raw
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => ({ value: l, label: l, customValue: true }));
    }
    if (parsed.length === 0) { setImportError('Nenhuma opcao reconhecida.'); return; }
    const merged = mode === 'append' ? [...options, ...parsed] : parsed;
    sync(merged);
    setImportText('');
    setImportError(null);
    setShowImport(false);
  };

  const sync = (updated: OptionItem[]) => {
    setOptions(updated);
    // Remove a flag customValue ao salvar (nao precisa ser persistida)
    const cleaned = updated.map(({ customValue, ...rest }) => rest);
    onChange(JSON.stringify(cleaned));
  };

  const addOption = () => {
    const idx = options.length + 1;
    sync([...options, { value: `opcao_${idx}`, label: `Opcao ${idx}` }]);
  };

  const updateOption = (index: number, field: 'value' | 'label', val: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], [field]: val };
    // Auto-sync value from label (sempre, exceto se o usuario editou o value manualmente)
    if (field === 'label' && !updated[index].customValue) {
      updated[index].value = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    }
    // Marcar que o value foi editado manualmente
    if (field === 'value') {
      updated[index].customValue = true;
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
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowImport((v) => !v)}>
            <ClipboardPaste className="h-3 w-3 mr-1" /> Importar
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addOption}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      {showImport && (
        <div className="space-y-1.5 rounded-md border border-dashed p-2">
          <Textarea
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportError(null); }}
            placeholder={'Cole 1 opcao por linha, ou um JSON:\n["A","B"]  ou  [{"value":"a","label":"A"}]'}
            className="h-24 text-xs font-mono"
          />
          {importError && <p className="text-[11px] text-destructive">{importError}</p>}
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => applyImport('append')}>Adicionar à lista</Button>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => applyImport('replace')}>Substituir tudo</Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setShowImport(false); setImportText(''); setImportError(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {options.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-2">Nenhuma opcao. Clique em Adicionar.</p>
      )}

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {options.map((opt, i) => {
          const isExpanded = expandedIndex === i;
          return (
            <div key={i} className="border border-border/50 rounded-md p-1.5 group">
              <div className="flex items-center gap-1">
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
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  title="Expandir"
                >
                  <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                </button>

                <button
                  className="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeOption(i)}
                  title="Remover"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {isExpanded && (
                <div className="mt-1.5 pl-5 space-y-1">
                  <div className="text-[10px] text-muted-foreground">Valor (salvo no banco):</div>
                  <Input
                    value={opt.value}
                    onChange={(e) => updateOption(i, 'value', e.target.value)}
                    className="h-6 text-xs font-mono"
                    placeholder="valor_salvo"
                  />
                  {!opt.customValue && (
                    <div className="text-[9px] text-muted-foreground italic">
                      Auto-sincronizado do label
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
