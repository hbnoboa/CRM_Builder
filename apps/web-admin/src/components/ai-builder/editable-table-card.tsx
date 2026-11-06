'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Database, Eye, EyeOff, GripVertical, HelpCircle, Link2, ListTree, Plus, Trash2, X, icons, type LucideIcon,
} from 'lucide-react';
import type { Entity } from '@crm-builder/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RecordFormFields } from '@/components/data/record-form-dialog';
import { FieldDemoDialog } from '@/components/entity-editor/panels/field-demo-dialog';
import { fieldKind } from '@/lib/field-catalog';
import { cn } from '@/lib/utils';
import type { AiFieldDraft, AiPreviewTable, AiTableDraft } from '@/hooks/use-ai-builder';

/** Mesmos tipos que a IA usa (ai-builder.schema.ts). */
const TYPES = [
  'text', 'textarea', 'number', 'currency', 'percentage', 'rating',
  'date', 'datetime', 'time',
  'select', 'multiselect', 'boolean', 'tags',
  'phone', 'email', 'cpf', 'cnpj', 'cep', 'url',
  'image', 'file', 'signature', 'map',
  'relation', 'user-select', 'section-title',
];
const CHOICE = new Set(['select', 'multiselect']);
export const AI_COLORS: Record<string, string> = {
  blue: '#2563eb', green: '#16a34a', amber: '#d97706', red: '#dc2626', violet: '#7c3aed', orange: '#ea580c', teal: '#0d9488', gray: '#64748b',
};
const COLOR_NAMES = Object.keys(AI_COLORS);
const newKey = () => `campo_${Date.now().toString(36)}${Math.floor(Math.random() * 100)}`;

interface EditableTableCardProps {
  table: AiTableDraft;
  /** Todas as tabelas da proposta (para "lista dentro de" e ligacoes). */
  tables: AiTableDraft[];
  /** Nomes para mostrar: chave da tabela nova ou identificador de uma que ja existe. */
  names: Record<string, string>;
  existingNames: Record<string, string>;
  /** Versao conferida pelo servidor (para "Ver formulario"). */
  preview?: AiPreviewTable;
  onChange: (next: AiTableDraft) => void;
  onRemove: () => void;
  /** Marca os elementos do tutorial (so na primeira tabela). */
  tour?: boolean;
}

/**
 * Tabela proposta, editavel direto: nome, campos (nome, tipo, obrigatorio, ordem,
 * opcoes, ligacao), lista dentro de outra e ajustes. Nada e criado aqui.
 */
export function EditableTableCard({ table, tables, names, existingNames, preview, onChange, onRemove, tour }: EditableTableCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [demoType, setDemoType] = useState<string | null>(null);
  const Icon = (icons as Record<string, LucideIcon>)[table.icon || ''] ?? Database;
  const color = AI_COLORS[table.color || 'blue'] ?? AI_COLORS.blue;
  const children = tables.filter((t) => t.parentKey === table.key);
  const t = (attr: string) => (tour ? { 'data-tour': attr } : {});

  const set = (patch: Partial<AiTableDraft>) => onChange({ ...table, ...patch });
  const setField = (index: number, patch: Partial<AiFieldDraft>) =>
    set({ fields: table.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= table.fields.length || from === to) return;
    const fields = [...table.fields];
    const [item] = fields.splice(from, 1);
    fields.splice(to, 0, item);
    set({ fields });
  };
  const removeField = (index: number) => {
    const key = table.fields[index].key;
    set({
      fields: table.fields.filter((_, i) => i !== index),
      ...(table.titleField === key ? { titleField: undefined } : {}),
      ...(table.statusField === key ? { statusField: undefined, doneOptions: undefined } : {}),
      ...(table.deadlineField === key ? { deadlineField: undefined } : {}),
      ...(table.assigneeField === key ? { assigneeField: undefined } : {}),
    });
  };
  const changeType = (index: number, type: string) => {
    const f = table.fields[index];
    setField(index, {
      type,
      ...(CHOICE.has(type) && !f.options?.length ? { options: [{ label: 'Opção 1', color: 'blue' }, { label: 'Opção 2', color: 'green' }] } : {}),
      ...(type === 'relation' && !f.relatedTable ? { relatedTable: tables.find((x) => x.key !== table.key)?.key ?? Object.keys(existingNames)[0] } : {}),
    });
  };

  const entity = useMemo(() => {
    if (!preview) return null;
    // Previa sem buscar dados: ligacao vira lista vazia (a tabela pode nem existir ainda)
    const fields = preview.fields.map((f) =>
      f.type === 'relation' ? { ...f, type: 'select', options: [], placeholder: `Escolher em ${names[f.relatedEntitySlug ?? ''] ?? f.relatedEntitySlug}` } : f,
    );
    return { id: `ai-${table.key}`, slug: `__ai_${table.key}`, name: table.name, tenantId: '', fields, settings: preview.settings } as unknown as Entity;
  }, [preview, names, table.key, table.name]);

  const pick = (types: string[]) => table.fields.filter((f) => types.includes(f.type));
  const statusField = table.fields.find((f) => f.key === table.statusField);

  return (
    <Card data-testid={`ai-table-${table.key}`}>
      <CardContent className="space-y-3 p-4">
        {/* Cabecalho: nome e onde fica */}
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <input
              value={table.namePlural}
              onChange={(e) => set({ namePlural: e.target.value })}
              className="w-full rounded border border-transparent bg-transparent px-1 font-semibold hover:border-border focus:border-primary focus:outline-none"
              aria-label="Nome da tabela (plural)"
              {...t('ai-table-name')}
            />
            <div className="flex flex-wrap items-center gap-1 px-1 text-xs text-muted-foreground">
              <span>Um registro:</span>
              <input
                value={table.name}
                onChange={(e) => set({ name: e.target.value })}
                className="w-40 rounded border border-transparent bg-transparent px-1 hover:border-border focus:border-primary focus:outline-none"
                aria-label="Nome de um registro (singular)"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 px-1 text-xs">
              <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={table.parentKey ?? ''}
                onChange={(e) => set({ parentKey: e.target.value || undefined })}
                className="h-7 rounded border bg-background px-1.5 text-xs"
                aria-label="Fica dentro de outra tabela"
              >
                <option value="">Tabela principal</option>
                {tables.filter((x) => x.key !== table.key).map((x) => <option key={x.key} value={x.key}>Lista dentro de {x.namePlural}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowForm((v) => !v)} disabled={!entity} {...t('ai-show-form')}>
              {showForm ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
              {showForm ? 'Editar campos' : 'Ver formulário'}
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Tirar tabela
            </Button>
          </div>
        </div>

        {showForm && entity ? (
          <div className="pointer-events-none select-none rounded-lg border bg-card p-4">
            <RecordFormFields entity={entity} hideFooter />
          </div>
        ) : (
          <>
            <ul className="divide-y rounded-lg border" data-testid="ai-fields">
              {table.fields.map((f, i) => {
                const kind = fieldKind(f.type);
                const FieldIcon = kind.icon;
                const first = tour && i === 0;
                return (
                  <li
                    key={f.key}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragIndex !== null) move(dragIndex, i); setDragIndex(null); }}
                    onDragEnd={() => setDragIndex(null)}
                    className={cn('space-y-1.5 px-2 py-2', dragIndex === i && 'opacity-50', f.type === 'section-title' && 'bg-muted/40')}
                    data-testid="ai-field"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground sm:block" {...(first ? t('ai-drag') : {})} aria-label="Arrastar para mudar a ordem" />
                      <FieldIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        value={f.label}
                        onChange={(e) => setField(i, { label: e.target.value })}
                        className="min-w-[7rem] flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium hover:border-border focus:border-primary focus:outline-none"
                        aria-label="Nome do campo"
                        data-testid="ai-field-label"
                        {...(first ? t('ai-field-name') : {})}
                      />
                      <select
                        value={f.type}
                        onChange={(e) => changeType(i, e.target.value)}
                        className="h-7 max-w-[10rem] rounded border bg-background px-1.5 text-xs"
                        aria-label="Tipo do campo"
                        data-testid="ai-field-type"
                        {...(first ? t('ai-field-type') : {})}
                      >
                        {TYPES.map((type) => <option key={type} value={type}>{fieldKind(type).label}</option>)}
                      </select>
                      <button type="button" onClick={() => setDemoType(f.type)} className="text-muted-foreground hover:text-foreground" aria-label="Como esse tipo funciona">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                      {f.type !== 'section-title' && (
                        <button
                          type="button"
                          onClick={() => setField(i, { required: !f.required })}
                          className={cn('rounded px-1.5 py-0.5 text-[11px]', f.required ? 'bg-destructive/10 font-semibold text-destructive' : 'text-muted-foreground hover:bg-muted')}
                          aria-pressed={!!f.required}
                          data-testid="ai-field-required"
                          {...(first ? t('ai-required') : {})}
                        >
                          {f.required ? 'Obrigatório *' : 'Opcional'}
                        </button>
                      )}
                      <span className="ml-auto flex items-center">
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === table.fields.length - 1} onClick={() => move(i, i + 1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeField(i)} aria-label="Excluir campo" data-testid="ai-field-remove"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </span>
                    </div>

                    {CHOICE.has(f.type) && (
                      <div className="flex flex-wrap items-center gap-1.5 pl-6" {...(tour && i === table.fields.findIndex((x) => CHOICE.has(x.type)) ? t('ai-options') : {})}>
                        {(f.options || []).map((o, oi) => (
                          <span key={oi} className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pl-1 pr-1.5 text-xs">
                            <button
                              type="button"
                              title="Trocar a cor"
                              onClick={() => {
                                const next = COLOR_NAMES[(COLOR_NAMES.indexOf(o.color || 'gray') + 1) % COLOR_NAMES.length];
                                setField(i, { options: (f.options || []).map((x, xi) => (xi === oi ? { ...x, color: next } : x)) });
                              }}
                              className="h-3.5 w-3.5 rounded-full border"
                              style={{ backgroundColor: AI_COLORS[o.color || ''] ?? '#e5e7eb' }}
                              aria-label="Trocar a cor"
                            />
                            <input
                              value={o.label}
                              onChange={(e) => setField(i, { options: (f.options || []).map((x, xi) => (xi === oi ? { ...x, label: e.target.value } : x)) })}
                              className="w-24 bg-transparent focus:outline-none"
                              aria-label="Nome da opção"
                            />
                            <button type="button" onClick={() => setField(i, { options: (f.options || []).filter((_, xi) => xi !== oi) })} aria-label="Tirar opção">
                              <X className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => setField(i, { options: [...(f.options || []), { label: `Opção ${(f.options?.length ?? 0) + 1}`, color: COLOR_NAMES[(f.options?.length ?? 0) % COLOR_NAMES.length] }] })}
                          className="inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" /> opção
                        </button>
                      </div>
                    )}

                    {f.type === 'relation' && (
                      <div className="flex items-center gap-1.5 pl-6 text-xs">
                        <Link2 className="h-3.5 w-3.5 text-primary" /> Escolhe um registro de
                        <select
                          value={f.relatedTable ?? ''}
                          onChange={(e) => setField(i, { relatedTable: e.target.value })}
                          className="h-7 rounded border bg-background px-1.5 text-xs"
                        >
                          {tables.filter((x) => x.key !== table.key).map((x) => <option key={x.key} value={x.key}>{x.namePlural} (nova)</option>)}
                          {Object.entries(existingNames).map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
                        </select>
                      </div>
                    )}
                  </li>
                );
              })}
              {children.map((c) => (
                <li key={`child-${c.key}`} className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                  <ListTree className="h-4 w-4" /> Lista de {c.namePlural} <span className="text-xs">(entra sozinha no formulário)</span>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => set({ fields: [...table.fields, { key: newKey(), label: 'Novo campo', type: 'text', width: 'half' }] })}
              data-testid="ai-add-field"
              {...t('ai-add-field')}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Campo
            </Button>

            {/* Ajustes: o que identifica, situacao, prazo, responsavel */}
            <div className="grid gap-2 rounded-lg bg-muted/40 p-2.5 text-xs sm:grid-cols-2" {...t('ai-settings')}>
              <SettingSelect label="Identifica cada registro pelo" value={table.titleField} options={pick(['text', 'cpf', 'cnpj', 'email', 'phone', 'number'])}
                onChange={(v) => set({ titleField: v })} />
              <SettingSelect label="Situação" value={table.statusField} options={pick(['select'])}
                onChange={(v) => set({ statusField: v, doneOptions: undefined })} />
              <SettingSelect label="Prazo" value={table.deadlineField} options={pick(['date', 'datetime'])} onChange={(v) => set({ deadlineField: v })} />
              <SettingSelect label="Responsável" value={table.assigneeField} options={pick(['user-select'])} onChange={(v) => set({ assigneeField: v })} />
              {statusField && (statusField.options || []).length > 0 && (
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-muted-foreground">Terminado quando a situação for:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(statusField.options || []).map((o) => {
                      const on = (table.doneOptions || []).includes(o.label);
                      return (
                        <button key={o.label} type="button"
                          onClick={() => set({ doneOptions: on ? (table.doneOptions || []).filter((d) => d !== o.label) : [...(table.doneOptions || []), o.label] })}
                          className={cn('rounded-full border px-2 py-0.5', on ? 'border-primary bg-primary/10 font-medium text-primary' : 'bg-background')}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
      <FieldDemoDialog type={demoType} open={!!demoType} onOpenChange={(open) => !open && setDemoType(null)} />
    </Card>
  );
}

function SettingSelect({ label, value, options, onChange }: { label: string; value?: string; options: AiFieldDraft[]; onChange: (v: string | undefined) => void }) {
  return (
    <label className="space-y-0.5">
      <span className="block text-muted-foreground">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className="h-8 w-full rounded border bg-background px-1.5" disabled={options.length === 0}>
        <option value="">{options.length ? 'Nenhum' : 'Sem campo desse tipo'}</option>
        {options.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
    </label>
  );
}
