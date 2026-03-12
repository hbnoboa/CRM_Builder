'use client';

import type { EntityField } from '@crm-builder/shared';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tight input classes - h-7 (28px) to fit exactly in 44px rows
const inputCls = 'flex h-7 w-full rounded border border-input bg-background px-2 text-xs text-muted-foreground pointer-events-none items-center';
const selectCls = 'flex h-7 w-full items-center justify-between rounded border border-input bg-background px-2 text-xs text-muted-foreground pointer-events-none';
const tagCls = 'inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium bg-secondary text-secondary-foreground';
const dropzoneCls = 'flex items-center justify-center gap-1 rounded border-2 border-dashed border-muted-foreground/25 px-2 py-1 text-[10px] text-muted-foreground';

const PLACEHOLDERS: Record<string, string> = {
  text: 'Digite texto...', email: 'email@exemplo.com', url: 'https://',
  cpf: '000.000.000-00', cnpj: '00.000.000/0000-00', cep: '00000-000',
  phone: '(00) 00000-0000', select: 'Selecionar...', 'api-select': 'Buscar...',
  relation: 'Selecionar registro...', 'user-select': 'Selecionar usuario...',
  lookup: 'Buscar...', multiselect: 'Selecionar...', number: '0',
  currency: '0,00', percentage: '0%', textarea: 'Digite aqui...',
  richtext: 'Texto rico...', array: 'Adicionar item...',
  tags: 'Adicionar tag...', password: '••••••••', date: 'dd/mm/aaaa',
  datetime: 'dd/mm/aaaa hh:mm', time: 'hh:mm',
};

function ph(field: EntityField): string {
  return field.placeholder || PLACEHOLDERS[field.type] || '';
}

function parseOptions(field: EntityField): Array<{ value: string; label: string }> {
  if (!field.options || !Array.isArray(field.options)) return [];
  return field.options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
}

const chevron = <svg className="h-3.5 w-3.5 opacity-50 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>;

// ─── Main ────────────────────────────────────────────────────────────────────

interface FieldPreviewProps {
  field: EntityField;
  isSelected: boolean;
  onClick: () => void;
}

export function FieldPreview({ field, isSelected, onClick }: FieldPreviewProps) {
  if (field.type === 'section-title') {
    return (
      <div
        className={cn('cursor-pointer h-full flex items-end pb-0.5 group', isSelected && 'ring-2 ring-primary ring-offset-1 rounded')}
        onClick={onClick}
      >
        <div className="flex items-center gap-1 w-full border-b border-border pb-0.5">
          <GripVertical className="h-3 w-3 flex-shrink-0 text-muted-foreground/30 opacity-0 group-hover:opacity-100 field-drag-handle cursor-grab" />
          <h3 className="text-xs font-semibold flex-1 truncate">{field.label || field.name || 'Titulo'}</h3>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('cursor-pointer group', isSelected && 'ring-2 ring-primary ring-offset-1 rounded')}
      onClick={onClick}
    >
      <div className="flex items-start gap-0.5">
        <GripVertical className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity field-drag-handle cursor-grab" />
        <div className="flex-1 space-y-0.5 min-w-0">
          <label className="text-[11px] font-medium leading-none block truncate">
            {field.label || field.name || field.slug}
            {field.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <FieldInput field={field} />
        </div>
      </div>
    </div>
  );
}

// ─── Type-specific input ─────────────────────────────────────────────────────

function FieldInput({ field }: { field: EntityField }) {
  switch (field.type) {
    case 'text': case 'email': case 'url': case 'cpf': case 'cnpj':
    case 'cep': case 'phone': case 'number':
      return <div className={inputCls}>{ph(field)}</div>;

    case 'password':
      return <div className={inputCls}>••••••••</div>;

    case 'textarea': case 'richtext':
      return <div className="flex min-h-[28px] w-full rounded border border-input bg-background px-2 py-1 text-xs text-muted-foreground pointer-events-none">{ph(field)}</div>;

    case 'array':
      return (
        <div className="space-y-1">
          <div className={inputCls}>{ph(field)}</div>
          <div className="flex gap-1 flex-wrap">
            <span className={tagCls}>Item 1</span>
            <span className={tagCls}>Item 2</span>
          </div>
        </div>
      );

    case 'currency':
      return (
        <div className="relative">
          <div className={cn(inputCls, 'pl-8')}>{ph(field)}</div>
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{field.prefix || 'R$'}</span>
        </div>
      );

    case 'percentage':
      return (
        <div className="relative">
          <div className={cn(inputCls, 'pr-7')}>{ph(field)}</div>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
        </div>
      );

    case 'slider':
      return (
        <div className="py-1.5">
          <div className="relative h-1.5 w-full rounded-full bg-secondary">
            <div className="absolute h-1.5 w-1/2 rounded-full bg-primary" />
            <div className="absolute left-1/2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm" />
          </div>
        </div>
      );

    case 'rating':
      return (
        <div className="flex gap-0">
          {Array.from({ length: Math.min(field.max || 5, 5) }).map((_, i) => (
            <span key={i} className={cn('text-base', i < 3 ? 'text-yellow-400' : 'text-muted-foreground/30')}>★</span>
          ))}
        </div>
      );

    case 'date': case 'datetime': case 'time':
      return (
        <div className="relative">
          <div className={cn(inputCls, 'pr-8')}>{ph(field)}</div>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs">{field.type === 'time' ? '⏱' : '📅'}</span>
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-center gap-2 pt-1">
          <div className="h-4 w-8 rounded-full bg-muted relative">
            <div className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-muted-foreground/40" />
          </div>
          <span className="text-xs text-muted-foreground">Nao</span>
        </div>
      );

    case 'select': case 'relation': case 'api-select': case 'user-select': case 'lookup':
      return <div className={selectCls}><span className="truncate">{ph(field)}</span>{chevron}</div>;

    case 'multiselect': {
      const opts = parseOptions(field);
      return (
        <div className="space-y-1">
          <div className={selectCls}><span className="truncate">{ph(field)}</span>{chevron}</div>
          {opts.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {opts.slice(0, 3).map(o => <span key={o.value} className={tagCls}>{o.label}</span>)}
            </div>
          )}
        </div>
      );
    }

    case 'sub-entity':
      return <div className={dropzoneCls}>📁 Sub-entidade</div>;

    case 'checkbox-group': {
      const opts = parseOptions(field);
      const items = opts.length > 0 ? opts.slice(0, 3) : [{ value: '1', label: 'Opcao 1' }, { value: '2', label: 'Opcao 2' }];
      return (
        <div className="space-y-1">
          {items.map(o => (
            <div key={o.value} className="flex items-center gap-1.5 text-xs">
              <div className="h-3.5 w-3.5 rounded-sm border border-input flex-shrink-0" />
              <span className="text-muted-foreground truncate">{o.label}</span>
            </div>
          ))}
        </div>
      );
    }

    case 'radio-group': {
      const opts = parseOptions(field);
      const items = opts.length > 0 ? opts.slice(0, 3) : [{ value: '1', label: 'Opcao 1' }, { value: '2', label: 'Opcao 2' }];
      return (
        <div className="space-y-1">
          {items.map(o => (
            <div key={o.value} className="flex items-center gap-1.5 text-xs">
              <div className="h-3.5 w-3.5 rounded-full border border-input flex-shrink-0" />
              <span className="text-muted-foreground truncate">{o.label}</span>
            </div>
          ))}
        </div>
      );
    }

    case 'tags': {
      const opts = parseOptions(field);
      const items = opts.length > 0 ? opts.slice(0, 3) : [{ value: 'tag1', label: 'tag1' }, { value: 'tag2', label: 'tag2' }];
      return (
        <div className="space-y-1">
          <div className={inputCls}>{ph(field)}</div>
          <div className="flex gap-1 flex-wrap">
            {items.map(o => <span key={o.value} className={tagCls}>{o.label}</span>)}
          </div>
        </div>
      );
    }

    case 'color':
      return (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded border border-input bg-black flex-shrink-0" />
          <div className={cn(inputCls, 'flex-1')}>#000000</div>
        </div>
      );

    case 'workflow-status': {
      const lbl = field.workflowConfig?.statuses?.find(s => s.isInitial)?.label || 'Status';
      return <div className={cn(selectCls, 'border-l-[3px] border-l-blue-500')}><span className="truncate">{lbl}</span>{chevron}</div>;
    }

    case 'timer':
      return <div className={cn(inputCls, 'font-mono text-xs')}>⏱ 00:00:00</div>;

    case 'sla-status':
      return (
        <div className="flex items-center gap-1.5 h-7">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">Dentro do SLA</span>
        </div>
      );

    case 'action-button':
      return (
        <button className="h-7 px-3 rounded bg-primary text-primary-foreground text-[10px] font-medium pointer-events-none" disabled>
          {field.actionButtonConfig?.label || 'Acao'}
        </button>
      );

    case 'file': return <div className={dropzoneCls}>📄 Arquivo</div>;
    case 'image': return <div className={dropzoneCls}>📷 Imagem</div>;
    case 'signature': return <div className={dropzoneCls}>✍ Assinatura</div>;

    case 'map':
      return (
        <div className="space-y-1">
          <div className={inputCls}>🔍 Buscar endereco...</div>
          <div className="h-10 rounded bg-muted/30 border border-input flex items-center justify-center text-sm">📍</div>
        </div>
      );

    case 'zone-diagram':
      return (
        <div className="rounded border border-input overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-muted/20 border-b border-input text-[10px] font-medium">🗺 Zonas</div>
          <div className="h-6 flex items-center justify-center text-[10px] text-muted-foreground">
            {field.diagramZones?.length ? `${field.diagramZones.length} zona(s)` : 'Sem zonas'}
          </div>
        </div>
      );

    case 'hidden':
      return <div className={cn(inputCls, 'border-dashed italic text-xs')}>👁 Oculto</div>;

    case 'json':
      return <div className={cn(inputCls, 'font-mono text-xs')}>{'{ }'}</div>;

    case 'formula': case 'rollup':
      return <div className={cn(inputCls, 'bg-muted/20 text-xs')}>⚡ Calculado</div>;

    default:
      return <div className={inputCls}>{ph(field)}</div>;
  }
}
