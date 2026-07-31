'use client';

import { useEffect, useState } from 'react';
import { Loader2, FileText, Search } from 'lucide-react';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface EntityLite { id: string; slug: string; name: string }
interface RecordHit { id: string; data: Record<string, unknown> }

/** Rótulo legível a partir dos dados do registro (primeiros valores de texto). */
function recordLabel(data: Record<string, unknown>): string {
  const vals = Object.values(data).filter(
    (v) => typeof v === 'string' && (v as string).trim(),
  ) as string[];
  return vals.slice(0, 3).join(' · ') || '(sem título)';
}

/** Cria um chat de registro: escolhe a tabela, busca o registro e abre seu chat. */
export function NewChatDialog({ entities, onPick, onClose }: {
  entities: EntityLite[];
  onPick: (entitySlug: string, recordId: string, label: string) => void;
  onClose: () => void;
}) {
  const [entitySlug, setEntitySlug] = useState(entities[0]?.slug || '');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<RecordHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!entitySlug || term.length < 1) { setHits([]); setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/chat/search?entitySlug=${entitySlug}&q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        setHits((r.data || []) as RecordHit[]);
      } catch { /* abortado ou erro: ignora */ } finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, entitySlug]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo chat de registro</DialogTitle>
          <DialogDescription>Escolha a tabela e busque o registro para abrir o chat dele.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={entitySlug}
            onChange={(e) => { setEntitySlug(e.target.value); setHits([]); setQ(''); }}
          >
            {entities.map((e) => <option key={e.id} value={e.slug}>{e.name}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar registro…" className="pl-8" />
            {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
            {hits.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                {q.trim() ? 'Nenhum registro encontrado.' : 'Digite para buscar um registro.'}
              </p>
            ) : hits.map((h) => {
              const label = recordLabel(h.data);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onPick(entitySlug, h.id, label)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
