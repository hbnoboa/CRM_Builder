'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, ArrowLeft, Search, FileSpreadsheet, FileJson, FileText } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FieldDef = { slug: string; label?: string; name?: string; type?: string; options?: Array<{ label: string; value: string }> };

/** Input com autocomplete de valores do campo (igual à busca de chassi do /avaria). */
function FieldSuggestInput({ entitySlug, field, value, placeholder, scopeParentId, onChange }: {
  entitySlug: string; field: string; value: string; placeholder?: string; scopeParentId?: string; onChange: (v: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  // Cache local por termo — re-digitar um prefixo já visto não bate no backend.
  const cacheRef = useRef<Map<string, string[]>>(new Map());
  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) { setSuggestions([]); return; } // >=2 chars: não busca a cada 1 letra
    const key = `${scopeParentId || ''}:${term.toLowerCase()}`;
    const hit = cacheRef.current.get(key);
    if (hit) { setSuggestions(hit); return; }
    const ctrl = new AbortController(); // aborta o request anterior ao digitar de novo
    const t = setTimeout(async () => {
      try {
        const scope = scopeParentId ? `&parentId=${scopeParentId}` : '';
        const r = await api.get(`/chat/field-suggestions?entitySlug=${entitySlug}&field=${field}&q=${encodeURIComponent(term)}${scope}`, { signal: ctrl.signal });
        const vals = (r.data || []) as string[];
        cacheRef.current.set(key, vals);
        setSuggestions(vals);
      } catch { /* abortado ou erro: ignora */ }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, entitySlug, field, scopeParentId]);
  return (
    <div className="relative">
      <Input value={value} placeholder={placeholder} onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full border rounded-md bg-popover shadow max-h-40 overflow-y-auto">
          {suggestions.map((s) => (
            <button key={s} type="button" className="w-full text-left px-2 py-1 text-sm hover:bg-accent truncate"
              onMouseDown={() => { onChange(s); setOpen(false); }}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
interface EntityLite { id: string; slug: string; name: string; fields?: unknown[] }
interface ChatCommand { slug: string; description?: string; targetEntitySlug?: string; actionConfig?: Record<string, unknown> }

type Filter = { fieldSlug: string; fieldType?: string; operator: string; value?: unknown; value2?: unknown };

const DATE_TYPES = ['date', 'datetime', 'time'];

function triggerDownload(href: string, filename: string, revoke?: () => void) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
  revoke?.();
}

function downloadBase64(base64: string, filename: string, contentType: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  triggerDownload(url, filename, () => URL.revokeObjectURL(url));
}

/** Resolve URL relativa do storage local (/uploads/...) contra a origem da API. */
function resolveFileUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  try {
    const base = (api.defaults.baseURL as string) || window.location.origin;
    return new URL(url, new URL(base).origin).toString();
  } catch {
    return url;
  }
}

/** Roda um comando de consulta/relatório: monta os filtros e escolhe o formato. */
export function QueryRunner({ channelId, cmd, entity, scopeParentId, onDone, onCancel }: {
  channelId: string;
  cmd: ChatCommand;
  entity: EntityLite;
  scopeParentId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const cfg = (cmd.actionConfig || {}) as {
    filterFields?: string[];
    formats?: string[];
    pdfTemplateId?: string;
    pdfTemplates?: Array<{ id: string; name: string }>;
  };
  const allFields = (entity.fields || []) as FieldDef[];
  const filterFields = (cfg.filterFields || []).map((s) => allFields.find((f) => f.slug === s)).filter(Boolean) as FieldDef[];
  const formats = cfg.formats?.length ? cfg.formats : ['card', 'xlsx', 'json', 'pdf'];
  const pdfTemplates = cfg.pdfTemplates?.length
    ? cfg.pdfTemplates
    : cfg.pdfTemplateId
      ? [{ id: cfg.pdfTemplateId, name: 'Template' }]
      : [];

  const [values, setValues] = useState<Record<string, string>>({});
  const [range, setRange] = useState<Record<string, { from?: string; to?: string }>>({});
  const [running, setRunning] = useState<string | null>(null);

  const buildFilters = (): Filter[] => {
    const out: Filter[] = [];
    for (const f of filterFields) {
      const type = f.type || 'text';
      if (DATE_TYPES.includes(type)) {
        const r = range[f.slug];
        if (r?.from || r?.to) out.push({ fieldSlug: f.slug, fieldType: type, operator: 'between', value: r?.from || '', value2: r?.to || '' });
      } else {
        const v = (values[f.slug] || '').trim();
        if (v) out.push({ fieldSlug: f.slug, fieldType: type, operator: type === 'select' ? 'equals' : 'contains', value: v });
      }
    }
    return out;
  };

  const run = async (format: string, key: string, pdfTemplateId?: string) => {
    setRunning(key);
    try {
      const res = await api.post(`/chat/channels/${channelId}/query/${cmd.slug}`, { filters: buildFilters(), format, pdfTemplateId, scopeParentId });
      if (format !== 'card' && res.data?.file) {
        const { base64, url, filename, contentType } = res.data.file as { base64?: string; url?: string; filename: string; contentType: string };
        if (url) {
          // Caminho leve: baixa direto do storage, sem trafegar base64 pelo backend.
          triggerDownload(resolveFileUrl(url), filename);
        } else if (base64) {
          downloadBase64(base64, filename, contentType);
        }
        toast.success(`Relatório gerado (${res.data.total} registro(s)).`);
      }
      onDone();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Erro ao consultar.');
    } finally {
      setRunning(null);
    }
  };

  const fmtBtn: Record<string, { label: string; icon: React.ReactNode }> = {
    card: { label: 'Consultar', icon: <Search className="h-4 w-4" /> },
    xlsx: { label: 'Excel', icon: <FileSpreadsheet className="h-4 w-4" /> },
    json: { label: 'JSON', icon: <FileJson className="h-4 w-4" /> },
    pdf: { label: 'PDF', icon: <FileText className="h-4 w-4" /> },
  };

  // PDF vira vários botões: "PDF (tabela)" + um por template desenhado ofertado.
  const buttons: Array<{ key: string; label: string; icon: React.ReactNode; format: string; pdfTemplateId?: string }> = [];
  for (const fmt of formats) {
    if (fmt === 'pdf') {
      buttons.push({ key: 'pdf', label: 'PDF (tabela)', icon: <FileText className="h-4 w-4" />, format: 'pdf' });
      for (const t of pdfTemplates) {
        buttons.push({ key: `pdf:${t.id}`, label: `PDF · ${t.name}`, icon: <FileText className="h-4 w-4" />, format: 'pdf', pdfTemplateId: t.id });
      }
    } else {
      buttons.push({ key: fmt, label: fmtBtn[fmt]?.label || fmt, icon: fmtBtn[fmt]?.icon, format: fmt });
    }
  }

  return (
    <div className="border-t p-3 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <button className="p-1 rounded hover:bg-accent" onClick={onCancel} aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></button>
        <span className="text-sm font-medium">/{cmd.slug} — consulta {entity.name}</span>
      </div>

      {filterFields.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {filterFields.map((f) => {
            const type = f.type || 'text';
            const label = f.label || f.name || f.slug;
            if (DATE_TYPES.includes(type)) {
              return (
                <div key={f.slug} className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">{label} — de</label>
                    <Input type="date" value={range[f.slug]?.from || ''} onChange={(e) => setRange((r) => ({ ...r, [f.slug]: { ...r[f.slug], from: e.target.value } }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">{label} — até</label>
                    <Input type="date" value={range[f.slug]?.to || ''} onChange={(e) => setRange((r) => ({ ...r, [f.slug]: { ...r[f.slug], to: e.target.value } }))} />
                  </div>
                </div>
              );
            }
            const options = f.options || [];
            const isSelect = (type === 'select' || type === 'multiselect') && options.length > 0;
            return (
              <div key={f.slug} className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{label}</label>
                {isSelect ? (
                  <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={values[f.slug] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.slug]: e.target.value }))}>
                    <option value="">Todos</option>
                    {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
                  </select>
                ) : (
                  <FieldSuggestInput entitySlug={entity.slug} field={f.slug} value={values[f.slug] || ''}
                    placeholder={`Buscar ${label.toLowerCase()}…`} scopeParentId={scopeParentId}
                    onChange={(val) => setValues((v) => ({ ...v, [f.slug]: val }))} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <Button key={b.key} size="sm" variant={b.format === 'card' ? 'default' : 'outline'} className="gap-1.5" disabled={!!running} onClick={() => run(b.format, b.key, b.pdfTemplateId)}>
            {running === b.key ? <Loader2 className="h-4 w-4 animate-spin" /> : b.icon}
            {b.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
