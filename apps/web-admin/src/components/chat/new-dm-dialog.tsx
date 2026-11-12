'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, User as UserIcon } from 'lucide-react';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Person {
  id: string;
  name: string;
  email: string;
}

/** Conversa direta: escolhe um colega da empresa e abre (ou reabre) a conversa com ele. */
export function NewDmDialog({ onPick, onClose }: {
  onPick: (person: Person) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/chat/people', { params: { q: term || undefined }, signal: ctrl.signal });
        setPeople((r.data || []) as Person[]);
      } catch { /* abortado ou erro: ignora */ } finally { setLoading(false); }
    }, term ? 250 : 0);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa direta</DialogTitle>
          <DialogDescription>Escolha um colega da empresa. Só vocês dois veem a conversa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail…" className="pl-8" data-testid="dm-search" />
            {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
            {people.length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                {loading ? 'Carregando…' : 'Ninguém encontrado.'}
              </p>
            ) : people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
                data-testid={`dm-pick-${p.email}`}
              >
                <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
