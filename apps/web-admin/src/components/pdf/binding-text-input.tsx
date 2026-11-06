'use client';

import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface BindingField {
  slug: string;
  name: string;
  label?: string;
  type: string;
}

const HIDDEN_TYPES = new Set(['sub-entity', 'section-title', 'image', 'file', 'signature', 'json', 'hidden', 'password', 'zone-diagram', 'map']);

/**
 * Campo de texto do PDF que aceita valores da tabela sem a pessoa digitar {{codigo}}:
 * clica no nome do campo e ele entra no ponto do cursor. Embaixo mostra como fica,
 * trocando {{codigo}} pelo nome do campo.
 */
export function BindingTextInput({
  value,
  onChange,
  fields,
  multiline = false,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  fields: BindingField[];
  multiline?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [showAll, setShowAll] = useState(false);
  const usable = useMemo(() => fields.filter((f) => !HIDDEN_TYPES.has(f.type)), [fields]);
  const nameOf = useMemo(() => new Map(usable.map((f) => [f.slug, f.label || f.name || f.slug])), [usable]);
  const shown = showAll ? usable : usable.slice(0, 8);

  const insert = (slug: string) => {
    const el = ref.current;
    const token = `{{${slug}}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const preview = value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, slug: string) => `[${nameOf.get(slug) ?? slug}]`);
  const hasBinding = /\{\{[^}]+\}\}/.test(value);

  return (
    <div className="space-y-2">
      {multiline ? (
        <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} />
      ) : (
        <Input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {usable.length > 0 && (
        <div className="flex flex-wrap items-center gap-1" data-testid="binding-chips">
          <span className="mr-0.5 text-[11px] text-muted-foreground">Inserir campo:</span>
          {shown.map((f) => (
            <button
              key={f.slug}
              type="button"
              onClick={() => insert(f.slug)}
              className="inline-flex items-center gap-0.5 rounded-full border bg-background px-2 py-0.5 text-[11px] transition-colors hover:border-primary/50 hover:bg-nav-active"
            >
              <Plus className="h-3 w-3 text-muted-foreground" />
              {f.label || f.name}
            </button>
          ))}
          {usable.length > 8 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11px] text-primary hover:underline">
              {showAll ? 'menos' : `+${usable.length - 8} campos`}
            </button>
          )}
        </div>
      )}
      {hasBinding && (
        <p className={cn('rounded-md bg-muted/60 px-2 py-1.5 text-[11px] text-muted-foreground')}>
          No PDF: <span className="text-foreground">{preview}</span>
        </p>
      )}
    </div>
  );
}
