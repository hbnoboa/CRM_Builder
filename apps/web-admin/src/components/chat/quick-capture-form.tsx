'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, Check } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ImageUploadField from '@/components/form/image-upload-field';

const ZoneDiagramField = dynamic(() => import('@/components/form/zone-diagram-field'), { ssr: false });

interface FieldDef {
  slug: string; label?: string; name?: string; type: string; options?: unknown;
  diagramSaveMode?: 'object' | 'text'; diagramImage?: string; diagramZones?: unknown;
}
interface EntityLite { slug: string; name: string; fields?: unknown[] }
interface Cmd { slug: string; description?: string; actionConfig?: Record<string, unknown> }

const SELECT_TYPES = ['select', 'radio-group', 'workflow-status'];

function normalizeOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => (typeof o === 'string' ? o : (o as { value?: string; label?: string })?.value ?? (o as { label?: string })?.label))
    .filter((v): v is string => !!v);
}

/** Autocomplete de texto: sugere valores já usados naquele campo. */
function TextAutocomplete({ entitySlug, field, value, onChange }: { entitySlug: string; field: string; value: string; onChange: (v: string) => void }) {
  const [sug, setSug] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (value.trim().length < 1) { setSug([]); return; }
    const t = setTimeout(async () => {
      try { const r = await api.get(`/chat/field-suggestions?entitySlug=${entitySlug}&field=${field}&q=${encodeURIComponent(value)}`); setSug(r.data || []); }
      catch { setSug([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [value, entitySlug, field]);
  return (
    <div className="relative">
      <Input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} className="h-8 text-sm" />
      {open && sug.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-md border bg-popover shadow">
          {sug.map((s) => (
            <button key={s} type="button" onMouseDown={() => { onChange(s); setOpen(false); }} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent">{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuickCaptureForm({ channelId, cmd, entity, parentEntity, scopeParentId, onDone, onCancel }: {
  channelId: string;
  cmd: Cmd;
  entity: EntityLite;
  parentEntity?: EntityLite | null;
  // No chat de uma operação: limita a busca do pai (ex.: veículos) àquele registro.
  scopeParentId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const cfg = (cmd.actionConfig || {}) as { quickFields?: string[]; parentEntitySlug?: string; parentSearchField?: string; parentFields?: string[]; heavyFields?: string[]; parentFilter?: unknown[] };
  const quickFields = cfg.quickFields || [];
  const heavyFields = cfg.heavyFields || [];
  const parentSlug = cfg.parentEntitySlug;
  const parentSearchField = cfg.parentSearchField || 'chassi';
  const parentFields = cfg.parentFields || [];
  // Filtro FIXO do comando na busca do pai (ex.: só veículos concluido=false).
  const parentFilterParam = Array.isArray(cfg.parentFilter) && cfg.parentFilter.length > 0
    ? `&filters=${encodeURIComponent(JSON.stringify(cfg.parentFilter))}`
    : '';

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [parentValues, setParentValues] = useState<Record<string, unknown>>({});
  const [parent, setParent] = useState<{ id: string; label: string } | null>(null);
  const [parentQuery, setParentQuery] = useState('');
  const [parentResults, setParentResults] = useState<Array<{ id: string; label: string }>>([]);
  const [parentIndex, setParentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0); // avarias já lançadas neste chassi (salvar e adicionar outra)

  // Autocomplete do pai (ex.: veículo por chassi).
  useEffect(() => {
    if (!parentSlug || parent || parentQuery.trim().length < 1) { setParentResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const scope = scopeParentId ? `&parentId=${scopeParentId}` : '';
        const r = await api.get(`/chat/search?entitySlug=${parentSlug}&q=${encodeURIComponent(parentQuery)}${scope}${parentFilterParam}`);
        const rows = (r.data || []) as Array<{ id: string; data: Record<string, unknown> }>;
        setParentResults(rows.map((x) => ({ id: x.id, label: String(x.data?.[parentSearchField] ?? x.id) })));
      } catch { setParentResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [parentQuery, parentSlug, parent, parentSearchField, scopeParentId, parentFilterParam]);

  const fieldDef = (slug: string) => ((entity.fields || []) as FieldDef[]).find((f) => f.slug === slug);
  const parentFieldDef = (slug: string) => ((parentEntity?.fields || []) as FieldDef[]).find((f) => f.slug === slug);
  const setVal = (slug: string, v: unknown) => setValues((p) => ({ ...p, [slug]: v }));

  const labelFor = (slug: string, isParent: boolean) => {
    const f = isParent ? parentFieldDef(slug) : fieldDef(slug);
    return f?.label || f?.name || slug;
  };

  // Todos os campos são obrigatórios (fotos do veículo + campos da avaria).
  const isEmpty = (slug: string, isParent: boolean) => {
    const f = isParent ? parentFieldDef(slug) : fieldDef(slug);
    const v = isParent ? parentValues[slug] : values[slug];
    if (f?.type === 'zone-diagram') {
      if (typeof v === 'string') return v.trim() === '';
      return !v || Object.keys((v as object) || {}).length === 0;
    }
    return v === undefined || v === null || String(v).trim() === '';
  };

  // Ordem de validação = ordem de exibição (fotos do veículo → peça → chips → fotos da avaria).
  const requiredFields: Array<[string, boolean]> = [
    ...parentFields.map((s) => [s, true] as [string, boolean]),
    ...heavyFields.map((s) => [s, false] as [string, boolean]),
    ...quickFields.map((s) => [s, false] as [string, boolean]),
  ];

  async function submit(keepOpen: boolean) {
    if (parentSlug && !parent) { setError(`Selecione: ${parentEntity?.name || 'registro pai'}`); return; }
    const missing = requiredFields.filter(([s, p]) => isEmpty(s, p)).map(([s, p]) => labelFor(s, p));
    if (missing.length > 0) {
      setError(`Preencha todos os campos. Falta: ${missing.join(', ')}`);
      return;
    }
    setSubmitting(true); setError(null);
    try {
      await api.post(`/chat/channels/${channelId}/commands/${cmd.slug}`, { parentRecordId: parent?.id, values, parentUpdate: parentValues });
      if (keepOpen) {
        // Mantém o chassi; limpa TODOS os campos (fotos do veículo + avaria) p/ re-preencher.
        setValues({});
        setParentValues({});
        setSavedCount((c) => c + 1);
        setSubmitting(false);
      } else {
        onDone();
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Erro ao registrar');
      setSubmitting(false);
    }
  }

  const imageFields = quickFields.filter((s) => fieldDef(s)?.type === 'image');

  return (
    <div className="border-t p-2.5 space-y-2 bg-muted/20 max-h-[55vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">/{cmd.slug}{cmd.description ? ` — ${cmd.description}` : ''}</span>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {parentSlug && (
        <div className="space-y-1">
          <label className="text-xs font-medium">{parentEntity?.name || 'Registro pai'} *</label>
          {parent ? (
            <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <span className="flex-1 truncate">{parent.label}</span>
              <button type="button" onClick={() => { setParent(null); setParentQuery(''); }} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <div className="relative">
              <Input
                value={parentQuery}
                onChange={(e) => { setParentQuery(e.target.value); setParentIndex(0); }}
                onKeyDown={(e) => {
                  if (parentResults.length === 0) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setParentIndex((i) => Math.min(i + 1, parentResults.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setParentIndex((i) => Math.max(i - 1, 0)); }
                  else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const r = parentResults[Math.min(parentIndex, parentResults.length - 1)]; setParent(r); setParentResults([]); }
                  else if (e.key === 'Escape') { setParentResults([]); }
                }}
                placeholder={`Buscar por ${parentSearchField}… (↑↓ Tab)`}
                className="h-8 text-sm"
              />
              {parentResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover shadow">
                  {parentResults.map((r, i) => (
                    <button key={r.id} type="button" onMouseEnter={() => setParentIndex(i)} onMouseDown={() => { setParent(r); setParentResults([]); }}
                      className={cn('w-full text-left px-2 py-1.5 text-sm', i === Math.min(parentIndex, parentResults.length - 1) ? 'bg-accent' : 'hover:bg-accent')}>{r.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fotos do VEÍCULO (obrigatórias) — ANTES de qualquer campo de avaria */}
      {parent && parentFields.length > 0 && (
        <div className="space-y-2 rounded-md border border-dashed p-2.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Fotos do veículo *</div>
          <div className="grid grid-cols-2 gap-2">
            {parentFields.map((slug) => {
              const f = parentFieldDef(slug);
              if (!f) return null;
              return (
                <div key={slug} className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium">{f.label || f.name || slug} *</label>
                  <ImageUploadField mode="image" folder="images" imageSource="both" imageDisplaySize={110} value={(parentValues[slug] as string) || ''} onChange={(v) => setParentValues((p) => ({ ...p, [slug]: v }))} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Peça (zone-diagram) — ANTES de Tipo/Nível */}
      {heavyFields.map((slug) => {
        const f = fieldDef(slug);
        if (!f) return null;
        const label = `${f.label || f.name || slug} *`;
        if (f.type === 'zone-diagram') {
          const isTextMode = f.diagramSaveMode === 'text';
          return (
            <ZoneDiagramField key={slug}
              value={isTextMode ? (values[slug] as string) || '' : (values[slug] as Record<string, string>) || {}}
              onChange={(val: Record<string, string> | string) => setVal(slug, val)}
              saveMode={f.diagramSaveMode || 'object'}
              diagramImage={f.diagramImage}
              zones={f.diagramZones as never}
              label={label}
              readOnly={false}
            />
          );
        }
        return (
          <div key={slug} className="space-y-1">
            <label className="text-xs font-medium">{label}</label>
            {f.type === 'image' ? (
              <ImageUploadField mode="image" folder="images" imageSource="both" imageDisplaySize={110} value={(values[slug] as string) || ''} onChange={(v) => setVal(slug, v)} />
            ) : (
              <TextAutocomplete entitySlug={entity.slug} field={slug} value={String(values[slug] ?? '')} onChange={(v) => setVal(slug, v)} />
            )}
          </div>
        );
      })}

      {/* Chips: Tipo / Nível / Quadrante / Medida / Local */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {quickFields.map((slug) => {
          const f = fieldDef(slug);
          if (!f || f.type === 'image') return null;
          const label = `${f.label || f.name || slug} *`;
          const opts = normalizeOptions(f.options);
          return (
            <div key={slug} className="space-y-0.5 col-span-2 sm:col-span-1">
              <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
              {SELECT_TYPES.includes(f.type) && opts.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {opts.map((o) => (
                    <button key={o} type="button" onClick={() => setVal(slug, values[slug] === o ? undefined : o)}
                      className={cn('rounded-full border px-2 py-0.5 text-xs transition-colors', values[slug] === o ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}>{o}</button>
                  ))}
                </div>
              ) : f.type === 'boolean' ? (
                <button type="button" onClick={() => setVal(slug, !values[slug])} className={cn('rounded-md border px-3 py-1 text-xs', values[slug] ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent')}>{values[slug] ? 'Sim' : 'Não'}</button>
              ) : (
                <TextAutocomplete entitySlug={entity.slug} field={slug} value={String(values[slug] ?? '')} onChange={(v) => setVal(slug, v)} />
              )}
            </div>
          );
        })}
      </div>

      {/* Fotos da AVARIA (obrigatórias) */}
      {imageFields.length > 0 && (
        <div className="space-y-2 rounded-md border border-dashed p-2.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Fotos da avaria *</div>
          <div className="grid grid-cols-2 gap-2">
            {imageFields.map((slug) => {
              const f = fieldDef(slug)!;
              return (
                <div key={slug} className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-xs font-medium">{f.label || f.name || slug} *</label>
                  <ImageUploadField mode="image" folder="images" imageSource="both" imageDisplaySize={110} value={(values[slug] as string) || ''} onChange={(v) => setVal(slug, v)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {savedCount > 0 && !error && (
        <p className="text-xs text-green-600">✓ {savedCount} avaria(s) registrada(s) neste chassi. Preencha a próxima.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>{savedCount > 0 ? 'Fechar' : 'Cancelar'}</Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => submit(true)} disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar e adicionar outra'}</Button>
        <Button type="button" size="sm" onClick={() => submit(false)} disabled={submitting}>{submitting ? 'Registrando…' : 'Registrar'}</Button>
      </div>
    </div>
  );
}
