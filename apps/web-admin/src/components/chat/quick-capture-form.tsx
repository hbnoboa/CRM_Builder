'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, Check } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ImageUploadField from '@/components/form/image-upload-field';
import { deriveFormFields, type FormFieldCfg } from './command-fields';

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
  const cfg = (cmd.actionConfig || {}) as Record<string, unknown>;
  const parentSlug = (cfg.parentEntitySlug as string) || '';
  const parentSearchField = (cfg.parentSearchField as string) || 'chassi';
  // Campos do formulário na ordem/obrigatoriedade definidas no wizard (com fallback ao legado).
  const formFields = deriveFormFields(cfg);
  // Permite lançar vários registros para o mesmo pai sem fechar o formulário.
  const allowMultiple = cfg.allowMultiple === true;
  // Filtro FIXO do comando na busca do pai (ex.: só veículos concluido=false).
  const parentFilterParam = Array.isArray(cfg.parentFilter) && (cfg.parentFilter as unknown[]).length > 0
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
  const [savedCount, setSavedCount] = useState(0); // registros já lançados (salvar e adicionar outra)

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
  const defFor = (ff: FormFieldCfg) => (ff.source === 'parent' ? parentFieldDef(ff.slug) : fieldDef(ff.slug));
  const valueFor = (ff: FormFieldCfg) => (ff.source === 'parent' ? parentValues[ff.slug] : values[ff.slug]);
  const setValueFor = (ff: FormFieldCfg, v: unknown) =>
    ff.source === 'parent'
      ? setParentValues((p) => ({ ...p, [ff.slug]: v }))
      : setValues((p) => ({ ...p, [ff.slug]: v }));

  const labelFor = (ff: FormFieldCfg) => {
    const f = defFor(ff);
    return f?.label || f?.name || ff.slug;
  };

  const isEmpty = (ff: FormFieldCfg) => {
    const f = defFor(ff);
    const v = valueFor(ff);
    if (f?.type === 'zone-diagram') {
      if (typeof v === 'string') return v.trim() === '';
      return !v || Object.keys((v as object) || {}).length === 0;
    }
    return v === undefined || v === null || String(v).trim() === '';
  };

  async function submit(keepOpen: boolean) {
    if (parentSlug && !parent) { setError(`Selecione: ${parentEntity?.name || 'registro pai'}`); return; }
    const missing = formFields.filter((ff) => ff.required && isEmpty(ff)).map(labelFor);
    if (missing.length > 0) {
      setError(`Preencha os campos obrigatórios. Falta: ${missing.join(', ')}`);
      return;
    }
    setSubmitting(true); setError(null);
    try {
      await api.post(`/chat/channels/${channelId}/commands/${cmd.slug}`, { parentRecordId: parent?.id, values, parentUpdate: parentValues });
      if (keepOpen) {
        // Mantém o pai; limpa os campos para re-preencher o próximo registro.
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

  // Renderiza um campo conforme o tipo (imagem, diagrama, chips, sim/não, texto).
  function renderField(ff: FormFieldCfg) {
    const f = defFor(ff);
    if (!f) return null;
    // Campos do pai só aparecem depois que o pai é selecionado.
    if (ff.source === 'parent' && !parent) return null;
    const req = ff.required ? ' *' : '';
    const label = `${f.label || f.name || ff.slug}${req}`;
    const v = valueFor(ff);

    if (f.type === 'zone-diagram') {
      const isTextMode = f.diagramSaveMode === 'text';
      return (
        <ZoneDiagramField key={`${ff.source}:${ff.slug}`}
          value={isTextMode ? (v as string) || '' : (v as Record<string, string>) || {}}
          onChange={(val: Record<string, string> | string) => setValueFor(ff, val)}
          saveMode={f.diagramSaveMode || 'object'}
          diagramImage={f.diagramImage}
          zones={f.diagramZones as never}
          label={label}
          readOnly={false}
        />
      );
    }

    const opts = normalizeOptions(f.options);
    return (
      <div key={`${ff.source}:${ff.slug}`} className="space-y-1">
        <label className="text-xs font-medium flex items-center gap-1.5">
          {label}
          {ff.source === 'parent' && parentEntity && (
            <span className="rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{parentEntity.name}</span>
          )}
        </label>
        {f.type === 'image' ? (
          <ImageUploadField mode="image" folder="images" imageSource="both" imageDisplaySize={110}
            value={(v as string) || ''} onChange={(val) => setValueFor(ff, val)} />
        ) : SELECT_TYPES.includes(f.type) && opts.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {opts.map((o) => (
              <button key={o} type="button" onClick={() => setValueFor(ff, v === o ? undefined : o)}
                className={cn('rounded-full border px-2 py-0.5 text-xs transition-colors', v === o ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}>{o}</button>
            ))}
          </div>
        ) : f.type === 'boolean' ? (
          <button type="button" onClick={() => setValueFor(ff, !v)}
            className={cn('rounded-md border px-3 py-1 text-xs', v ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent')}>{v ? 'Sim' : 'Não'}</button>
        ) : (
          <TextAutocomplete entitySlug={ff.source === 'parent' ? parentSlug : entity.slug} field={ff.slug} value={String(v ?? '')} onChange={(val) => setValueFor(ff, val)} />
        )}
      </div>
    );
  }

  return (
    <div className="border-t p-2.5 space-y-2.5 bg-muted/20 max-h-[55vh] overflow-y-auto">
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

      {/* Campos na ordem definida no wizard (obrigatórios marcados com *). */}
      {formFields.map(renderField)}

      {savedCount > 0 && !error && (
        <p className="text-xs text-green-600">✓ {savedCount} registro(s) adicionado(s). Preencha o próximo.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>{savedCount > 0 ? 'Fechar' : 'Cancelar'}</Button>
        {allowMultiple && (
          <Button type="button" variant="secondary" size="sm" onClick={() => submit(true)} disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar e adicionar outra'}</Button>
        )}
        <Button type="button" size="sm" onClick={() => submit(false)} disabled={submitting}>{submitting ? 'Registrando…' : 'Registrar'}</Button>
      </div>
    </div>
  );
}
