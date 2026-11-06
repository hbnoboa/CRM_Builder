'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { CheckCircle2, Copy, Download, ExternalLink, FileText, Loader2, Paperclip, Star, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { absoluteSiteUrl, siteApi, type SiteBlockView, type SiteFieldDef, type SitePageData, type SiteRecordView, type SiteValue } from '@/lib/site-api';

const DEFAULT_BRAND = '#2563eb';

interface SitePageViewProps {
  data: SitePageData;
  tenantSlug: string;
  pageSlug: string;
  token?: string | null;
  /** Previa do editor: mostra tudo, mas nao envia nada. */
  preview?: boolean;
  onChanged?: () => void;
}

/** Pagina para clientes: o que o cliente final ve (celular primeiro). */
export function SitePageView({ data, tenantSlug, pageSlug, token, preview, onChanged }: SitePageViewProps) {
  const brand = data.tenant.brandColor || DEFAULT_BRAND;
  const style = { '--site-brand': brand } as CSSProperties;

  return (
    <div className={cn('bg-slate-50 text-slate-900', preview ? 'min-h-full' : 'min-h-screen')} style={style} data-testid="site-page">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {data.tenant.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.tenant.logo} alt={data.tenant.name} className="h-9 w-auto max-w-[140px] object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: brand }}>
              {data.tenant.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="font-semibold">{data.tenant.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        {data.blocks.map((block) => (
          <BlockView
            key={block.id}
            block={block}
            data={data}
            brand={brand}
            tenantSlug={tenantSlug}
            pageSlug={pageSlug}
            token={token}
            preview={preview}
            onChanged={onChanged}
          />
        ))}
      </main>

      <footer className="mx-auto max-w-2xl px-4 pb-8 pt-2 text-center text-xs text-slate-400">
        {data.tenant.name} · feito com CRM Builder
      </footer>
    </div>
  );
}

function BlockView({ block, data, brand, tenantSlug, pageSlug, token, preview, onChanged }: { block: SiteBlockView; data: SitePageData; brand: string } & Omit<SitePageViewProps, 'data'>) {
  switch (block.type) {
    case 'heading':
      return block.size === 'md'
        ? <h2 className="text-xl font-semibold">{block.text}</h2>
        : <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{block.text}</h1>;
    case 'text':
      return <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{block.text}</p>;
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={block.url} alt={block.alt || ''} className="w-full rounded-xl object-cover" />;
    case 'button':
      return (
        <a href={block.url} target={block.url.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: brand }}>
          {block.label}
        </a>
      );
    case 'divider':
      return <hr className="border-slate-200" />;
    case 'form':
      return <PublicForm block={block} brand={brand} tenantSlug={tenantSlug} pageSlug={pageSlug} preview={preview} />;
    case 'tracking':
      return (
        <TrackingView
          block={block} record={data.record} error={data.trackingError} brand={brand}
          tenantSlug={tenantSlug} pageSlug={pageSlug} token={token} preview={preview} onChanged={onChanged}
        />
      );
    default:
      return null;
  }
}

// ── Formulario ───────────────────────────────────────────────────────────

function PublicForm({ block, brand, tenantSlug, pageSlug, preview }: { block: Extract<SiteBlockView, { type: 'form' }>; brand: string; tenantSlug: string; pageSlug: string; preview?: boolean }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [parentValues, setParentValues] = useState<Record<string, unknown>>({});
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; trackingUrl?: string } | null>(null);
  const set = (slug: string, v: unknown) => setValues((prev) => ({ ...prev, [slug]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const missing = [
      ...(block.parent?.fieldDefs || []).filter((f) => f.required && isEmpty(parentValues[f.slug])),
      ...block.fieldDefs.filter((f) => f.required && isEmpty(values[f.slug])),
    ];
    if (missing.length) {
      setError(`Preencha: ${missing.map((f) => f.label).join(', ')}.`);
      return;
    }
    if (preview) {
      setError('Na prévia o formulário não envia. Publique a página e teste pelo link.');
      return;
    }
    setSending(true);
    try {
      const res = await siteApi.submit(tenantSlug, pageSlug, block.id, values, website, block.parent ? parentValues : undefined);
      setDone({ message: res.message, trackingUrl: res.trackingUrl ? absoluteSiteUrl(res.trackingUrl) : undefined });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4 rounded-2xl border bg-white p-6 text-center shadow-sm" data-testid="site-form-done">
        <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: brand }} />
        <p className="text-lg font-semibold">{done.message}</p>
        {done.trackingUrl && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-left">
            <p className="text-sm font-medium">Guarde este link para acompanhar:</p>
            <p className="break-all rounded-md border bg-white px-3 py-2 text-xs" data-testid="site-tracking-url">{done.trackingUrl}</p>
            <div className="flex flex-wrap gap-2">
              <a href={done.trackingUrl} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white" style={{ backgroundColor: brand }}>
                <ExternalLink className="h-4 w-4" /> Acompanhar agora
              </a>
              <Button type="button" variant="outline" onClick={() => void navigator.clipboard?.writeText(done.trackingUrl!)}>
                <Copy className="mr-1.5 h-4 w-4" /> Copiar link
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm" data-testid={`site-form-${block.id}`} noValidate>
      {block.parent && (
        <>
          <p className="text-base font-semibold" data-testid="site-form-parent-title">{block.parent.title || 'Seus dados'}</p>
          {block.parent.fieldDefs.map((f) => (
            <div key={`p-${f.slug}`} className="space-y-1.5">
              <Label htmlFor={`f-${f.slug}`} className="text-sm font-medium">
                {f.label}{f.required && <span className="text-red-600"> *</span>}
              </Label>
              <FieldInput field={f} value={parentValues[f.slug]} onChange={(v) => setParentValues((prev) => ({ ...prev, [f.slug]: v }))} brand={brand}
                upload={(file) => (preview ? Promise.reject(new Error('Na prévia não dá para enviar arquivos.')) : siteApi.uploadForm(tenantSlug, pageSlug, block.id, f.slug, file, 'parent').then((r) => r.url))} />
              {f.helpText && <p className="text-xs text-slate-500">{f.helpText}</p>}
            </div>
          ))}
          <p className="border-t pt-4 text-base font-semibold">{block.entityName || 'Dados'}</p>
        </>
      )}
      {block.fieldDefs.map((f) => (
        <div key={f.slug} className="space-y-1.5">
          <Label htmlFor={`f-${f.slug}`} className="text-sm font-medium">
            {f.label}{f.required && <span className="text-red-600"> *</span>}
          </Label>
          <FieldInput field={f} value={values[f.slug]} onChange={(v) => set(f.slug, v)} brand={brand}
            upload={(file) => (preview ? Promise.reject(new Error('Na prévia não dá para enviar arquivos.')) : siteApi.uploadForm(tenantSlug, pageSlug, block.id, f.slug, file).then((r) => r.url))} />
          {f.helpText && <p className="text-xs text-slate-500">{f.helpText}</p>}
        </div>
      ))}
      {/* Campo escondido: pessoas nao veem; robos preenchem */}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={sending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg text-base font-semibold text-white shadow-sm disabled:opacity-60" style={{ backgroundColor: brand }} data-testid="site-form-submit">
        {sending && <Loader2 className="h-4 w-4 animate-spin" />} {block.submitLabel || 'Enviar'}
      </button>
    </form>
  );
}

function isEmpty(v: unknown) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function FieldInput({ field, value, onChange, brand, upload }: { field: SiteFieldDef; value: unknown; onChange: (v: unknown) => void; brand: string; upload: (file: File) => Promise<string> }) {
  const id = `f-${field.slug}`;
  const str = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const options = field.options || [];
  switch (field.type) {
    case 'textarea':
      return <Textarea id={id} rows={4} value={str} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} maxLength={5000} />;
    case 'number': case 'currency': case 'percentage':
      return <Input id={id} type="number" inputMode="decimal" step="any" value={str} placeholder={field.type === 'currency' ? 'R$' : field.placeholder} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
    case 'date':
      return <Input id={id} type="date" value={str} onChange={(e) => onChange(e.target.value)} />;
    case 'datetime':
      return <Input id={id} type="datetime-local" value={str} onChange={(e) => onChange(e.target.value)} />;
    case 'time':
      return <Input id={id} type="time" value={str} onChange={(e) => onChange(e.target.value)} />;
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input id={id} type="checkbox" className="h-5 w-5" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> Sim
        </label>
      );
    case 'rating':
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} estrelas`}>
              <Star className="h-7 w-7" style={{ color: brand }} fill={Number(value) >= n ? brand : 'transparent'} />
            </button>
          ))}
        </div>
      );
    case 'select': case 'radio-group':
      if (options.length <= 5) {
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button key={o.value} type="button" onClick={() => onChange(o.value)}
                className={cn('rounded-full border px-4 py-2 text-sm', value === o.value ? 'font-semibold text-white' : 'bg-white')}
                style={value === o.value ? { backgroundColor: brand, borderColor: brand } : undefined}>
                {o.label}
              </button>
            ))}
          </div>
        );
      }
      return (
        <select id={id} value={str} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-md border bg-white px-3 text-sm">
          <option value="">Escolha…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'multiselect': case 'checkbox-group': {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={list.includes(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...list, o.value] : list.filter((x) => x !== o.value))} />
              {o.label}
            </label>
          ))}
        </div>
      );
    }
    case 'tags':
      return <Input id={id} value={Array.isArray(value) ? (value as string[]).join(', ') : str} placeholder="Separe por vírgula" onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />;
    case 'image': case 'file':
      return <FileInput field={field} value={value} onChange={onChange} upload={upload} />;
    default: {
      const kind = { email: 'email', phone: 'tel', url: 'url' }[field.type] ?? 'text';
      const mode = ['cpf', 'cnpj', 'cep', 'phone'].includes(field.type) ? 'numeric' : undefined;
      const hint = { cpf: '000.000.000-00', cnpj: '00.000.000/0000-00', cep: '00000-000', phone: '(00) 00000-0000', email: 'seu@email.com' }[field.type];
      return <Input id={id} type={kind} inputMode={mode} value={str} placeholder={field.placeholder || hint} onChange={(e) => onChange(e.target.value)} maxLength={500} />;
    }
  }
}

function FileInput({ field, value, onChange, upload }: { field: SiteFieldDef; value: unknown; onChange: (v: unknown) => void; upload: (file: File) => Promise<string> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = (Array.isArray(value) ? value : value ? [value] : []) as string[];
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, field.multiple ? 10 : 1)) urls.push(await upload(file));
      onChange(field.multiple ? [...list, ...urls] : urls[0]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {list.map((u) => (
            <span key={u} className="relative">
              {field.type === 'image'
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={u} alt="" className="h-20 w-20 rounded-lg border object-cover" />
                : <span className="flex h-20 w-20 items-center justify-center rounded-lg border bg-slate-50"><FileText className="h-6 w-6 text-slate-400" /></span>}
              <button type="button" aria-label="Remover" onClick={() => onChange(field.multiple ? list.filter((x) => x !== u) : '')}
                className="absolute -right-2 -top-2 rounded-full border bg-white p-0.5 shadow"><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
        </div>
      )}
      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-white text-sm text-slate-600">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {field.type === 'image' ? 'Tirar ou escolher foto' : 'Escolher arquivo'}
        <input type="file" className="hidden" multiple={!!field.multiple} accept={field.type === 'image' ? 'image/*' : undefined}
          onChange={(e) => void pick(e.target.files)} disabled={busy} />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Acompanhamento ───────────────────────────────────────────────────────

function formatValue(type: string, value: SiteValue): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (type === 'currency' && typeof value === 'number') return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (type === 'percentage' && typeof value === 'number') return `${value.toLocaleString('pt-BR')}%`;
  if ((type === 'date' || type === 'datetime') && typeof value === 'string') {
    const d = new Date(type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
    if (!Number.isNaN(d.getTime())) return type === 'date' ? d.toLocaleDateString('pt-BR') : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }
  return String(value);
}

function TrackingView({ block, record, error, brand, tenantSlug, pageSlug, token, preview, onChanged }: {
  block: Extract<SiteBlockView, { type: 'tracking' }>; record: SiteRecordView | null; error: string | null; brand: string;
  tenantSlug: string; pageSlug: string; token?: string | null; preview?: boolean; onChanged?: () => void;
}) {
  if (!record) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm" data-testid="site-tracking-empty">
        <p className="font-medium">{error || 'Para acompanhar, abra o link que você recebeu.'}</p>
      </div>
    );
  }
  return (
    <div className="space-y-4" data-testid="site-tracking">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            {block.entityName && <p className="text-xs uppercase tracking-wide text-slate-500">{block.entityName}</p>}
            <p className="text-xl font-bold">{formatValue('text', record.title)}</p>
          </div>
          {record.status && (
            <span className="rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ backgroundColor: record.status.color || brand }} data-testid="site-status">
              {record.status.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">Atualizado em {formatValue('datetime', record.updatedAt)}</p>
        {record.fields.length > 0 && (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {record.fields.map((f) => (
              <div key={f.slug}>
                <dt className="text-xs text-slate-500">{f.label}</dt>
                <dd className="text-sm font-medium">{formatValue(f.type, f.value)}</dd>
              </div>
            ))}
          </dl>
        )}
        {block.hasPdf && token && !preview && (
          <a href={siteApi.pdfUrl(tenantSlug, pageSlug, token)} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold" style={{ color: brand, borderColor: brand }}>
            <Download className="h-4 w-4" /> Baixar documento (PDF)
          </a>
        )}
      </div>

      {record.timeline && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="mb-3 font-semibold">{record.timeline.label}</p>
          {record.timeline.rows.length === 0 ? (
            <p className="text-sm text-slate-500">Nada registrado ainda.</p>
          ) : (
            <ol className="space-y-3 border-l-2 pl-4" style={{ borderColor: brand }}>
              {record.timeline.rows.map((row, i) => (
                <li key={i} className="text-sm">
                  {record.timeline!.columns.map((c, ci) => (
                    <p key={c.slug} className={ci === 0 ? 'font-medium' : 'text-slate-600'}>
                      {ci === 0 ? '' : `${c.label}: `}{formatValue(c.type, row[c.slug])}
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {record.uploads.length > 0 && (
        <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <p className="font-semibold">Enviar documentos e fotos</p>
          {record.uploads.map((u) => (
            <TrackingUpload key={u.slug} upload={u} preview={preview}
              send={(file) => siteApi.uploadTracking(tenantSlug, pageSlug, token || '', u.slug, file).then(() => onChanged?.())} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackingUpload({ upload, preview, send }: { upload: SiteRecordView['uploads'][number]; preview?: boolean; send: (file: File) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const files = Array.isArray(upload.value) ? upload.value : [];
  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    if (preview) {
      setMsg({ ok: false, text: 'Na prévia não dá para enviar arquivos.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      for (const file of Array.from(list).slice(0, upload.multiple ? 10 : 1)) await send(file);
      setMsg({ ok: true, text: 'Recebido! Obrigado.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{upload.label}</p>
      {files.length > 0 && (
        <p className="flex items-center gap-1 text-xs text-slate-500"><Paperclip className="h-3 w-3" /> {files.length} {files.length === 1 ? 'arquivo enviado' : 'arquivos enviados'}</p>
      )}
      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-slate-600">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {upload.type === 'image' ? 'Tirar ou escolher foto' : 'Escolher arquivo'}
        <input type="file" className="hidden" multiple={upload.multiple} accept={upload.type === 'image' ? 'image/*' : undefined}
          onChange={(e) => void pick(e.target.files)} disabled={busy} data-testid={`site-upload-${upload.slug}`} />
      </label>
      {msg && <p className={cn('text-xs', msg.ok ? 'text-emerald-700' : 'text-red-600')}>{msg.text}</p>}
    </div>
  );
}
