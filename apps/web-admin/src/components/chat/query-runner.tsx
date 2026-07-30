'use client';

import { useState } from 'react';
import { Loader2, ArrowLeft, Search, FileSpreadsheet, FileJson, FileText } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FieldDef = { slug: string; label?: string; name?: string; type?: string };
interface EntityLite { id: string; slug: string; name: string; fields?: unknown[] }
interface ChatCommand { slug: string; description?: string; targetEntitySlug?: string; actionConfig?: Record<string, unknown> }

type Filter = { fieldSlug: string; fieldType?: string; operator: string; value?: unknown; value2?: unknown };

const DATE_TYPES = ['date', 'datetime', 'time'];

function downloadBase64(base64: string, filename: string, contentType: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Roda um comando de consulta/relatório: monta os filtros e escolhe o formato. */
export function QueryRunner({ channelId, cmd, entity, onDone, onCancel }: {
  channelId: string;
  cmd: ChatCommand;
  entity: EntityLite;
  onDone: () => void;
  onCancel: () => void;
}) {
  const cfg = (cmd.actionConfig || {}) as { filterFields?: string[]; formats?: string[] };
  const allFields = (entity.fields || []) as FieldDef[];
  const filterFields = (cfg.filterFields || []).map((s) => allFields.find((f) => f.slug === s)).filter(Boolean) as FieldDef[];
  const formats = cfg.formats?.length ? cfg.formats : ['card', 'xlsx', 'json', 'pdf'];

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

  const run = async (format: string) => {
    setRunning(format);
    try {
      const res = await api.post(`/chat/channels/${channelId}/query/${cmd.slug}`, { filters: buildFilters(), format });
      if (format !== 'card' && res.data?.file) {
        const { base64, filename, contentType } = res.data.file;
        downloadBase64(base64, filename, contentType);
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
            return (
              <div key={f.slug} className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{label}</label>
                <Input value={values[f.slug] || ''} placeholder={`Filtrar por ${label.toLowerCase()}`} onChange={(e) => setValues((v) => ({ ...v, [f.slug]: e.target.value }))} />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {formats.map((fmt) => (
          <Button key={fmt} size="sm" variant={fmt === 'card' ? 'default' : 'outline'} className="gap-1.5" disabled={!!running} onClick={() => run(fmt)}>
            {running === fmt ? <Loader2 className="h-4 w-4 animate-spin" /> : fmtBtn[fmt]?.icon}
            {fmtBtn[fmt]?.label || fmt}
          </Button>
        ))}
      </div>
    </div>
  );
}
