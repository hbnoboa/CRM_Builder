'use client';

import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type FieldDef = { slug: string; label?: string; name?: string; type?: string };
interface EntityLite { id: string; slug: string; name: string; fields?: unknown[] }
interface ChatCommand { slug: string; description?: string; targetEntitySlug?: string; actionConfig?: Record<string, unknown> }

/** Edita um registro existente: busca (searchField) → pré-preenche → salva. */
export function RecordEditForm({ channelId, cmd, entity, scopeParentId, onDone, onCancel }: {
  channelId: string;
  cmd: ChatCommand;
  entity: EntityLite;
  scopeParentId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const cfg = (cmd.actionConfig || {}) as { searchField?: string; fields?: string[] };
  const allFields = (entity.fields || []) as FieldDef[];
  const editFields = (cfg.fields?.length ? cfg.fields : allFields.map((f) => f.slug))
    .map((s) => allFields.find((f) => f.slug === s))
    .filter(Boolean) as FieldDef[];
  const searchLabel = allFields.find((f) => f.slug === cfg.searchField)?.label || cfg.searchField || 'registro';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
  const [picked, setPicked] = useState<{ id: string; data: Record<string, unknown> } | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (picked || query.trim().length < 1) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const scope = scopeParentId ? `&parentId=${scopeParentId}` : '';
        const r = await api.get(`/chat/search?entitySlug=${entity.slug}&q=${encodeURIComponent(query)}${scope}`);
        setResults(r.data || []);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [query, picked, entity.slug, scopeParentId]);

  const pick = (r: { id: string; data: Record<string, unknown> }) => {
    setPicked(r);
    // Pré-preenche os campos editáveis com os valores atuais.
    const init: Record<string, unknown> = {};
    for (const f of editFields) init[f.slug] = r.data?.[f.slug] ?? '';
    setValues(init);
  };

  const save = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await api.post(`/chat/channels/${channelId}/commands/${cmd.slug}`, { recordId: picked.id, values });
      toast.success('Registro atualizado.');
      onDone();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const labelOf = (r: { data: Record<string, unknown> }) =>
    String(r.data?.[cfg.searchField || ''] ?? Object.values(r.data || {})[0] ?? '—');

  return (
    <div className="border-t p-3 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2">
        <button className="p-1 rounded hover:bg-accent" onClick={onCancel} aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></button>
        <span className="text-sm font-medium">/{cmd.slug} — editar {entity.name}</span>
      </div>

      {!picked ? (
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Buscar por {String(searchLabel).toLowerCase()}</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input autoFocus className="pl-8" value={query} placeholder={`Buscar ${entity.name.toLowerCase()}…`} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {results.length > 0 && (
            <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
              {results.map((r) => (
                <button key={r.id} className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent" onClick={() => pick(r)}>
                  {labelOf(r)}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="text-xs text-muted-foreground">Editando: <span className="font-medium text-foreground">{labelOf(picked)}</span></div>
          {editFields.map((f) => {
            const type = f.type || 'text';
            const label = f.label || f.name || f.slug;
            const val = values[f.slug];
            if (type === 'boolean') {
              return (
                <label key={f.slug} className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <Switch checked={val === true} onCheckedChange={(v) => setValues((s) => ({ ...s, [f.slug]: v }))} />
                </label>
              );
            }
            return (
              <div key={f.slug} className="space-y-1">
                <label className="text-[11px] text-muted-foreground">{label}</label>
                <Input value={val == null ? '' : String(val)} onChange={(e) => setValues((s) => ({ ...s, [f.slug]: e.target.value }))} />
              </div>
            );
          })}
          <div className="flex justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={() => { setPicked(null); setValues({}); }}>Trocar registro</Button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
