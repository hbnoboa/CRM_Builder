'use client';

import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FIELD_GROUPS, FIELD_KINDS, POPULAR_FIELD_TYPES, fieldKind, type FieldKind } from '@/lib/field-catalog';

interface FieldPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (fieldType: string, label: string) => void;
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function KindCard({ kind, onPick }: { kind: FieldKind; onPick: (k: FieldKind) => void }) {
  const Icon = kind.icon;
  return (
    <button
      type="button"
      onClick={() => onPick(kind)}
      data-testid={`field-kind-${kind.type}`}
      className="group flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-nav-active/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-nav-active text-nav-active-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{kind.label}</span>
        <span className="block text-xs text-muted-foreground">{kind.description}</span>
        <span className="mt-1 block truncate text-[11px] text-muted-foreground/80">Ex.: {kind.example}</span>
      </span>
    </button>
  );
}

/** "Que tipo de informação você quer guardar?" — tipos em linguagem simples, com exemplo. */
export function FieldPickerModal({ open, onClose, onSelect }: FieldPickerModalProps) {
  const [search, setSearch] = useState('');

  const close = () => {
    setSearch('');
    onClose();
  };

  const pick = (kind: FieldKind) => {
    // O rotulo inicial e o nome do tipo; a pessoa renomeia logo em seguida no painel.
    onSelect(kind.type, kind.label);
    close();
  };

  const results = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return null;
    return FIELD_KINDS.filter((k) =>
      [k.label, k.description, k.example, k.type].some((s) => normalize(s).includes(term)),
    );
  }, [search]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-0 p-0" data-testid="field-picker">
        <div className="border-b px-6 pb-4 pt-5">
          <DialogTitle className="text-lg">Que informação você quer guardar?</DialogTitle>
          <DialogDescription className="mt-1">Escolha o tipo. Depois você dá o nome do campo (ex.: &quot;Placa&quot;, &quot;Valor do serviço&quot;).</DialogDescription>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar: foto, data, valor, assinatura..."
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {results ? (
            results.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Nenhum tipo encontrado para &quot;{search}&quot;.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((k) => <KindCard key={k.type} kind={k} onPick={pick} />)}
              </div>
            )
          ) : (
            <div className="space-y-7">
              <section>
                <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> Mais usados
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {POPULAR_FIELD_TYPES.map((type) => <KindCard key={type} kind={fieldKind(type)} onPick={pick} />)}
                </div>
              </section>
              {FIELD_GROUPS.map((group) => {
                const kinds = FIELD_KINDS.filter((k) => k.group === group.key && !POPULAR_FIELD_TYPES.includes(k.type));
                if (kinds.length === 0) return null;
                return (
                  <section key={group.key}>
                    <h3 className={cn('mb-2.5 text-sm font-semibold', group.key === 'advanced' && 'text-muted-foreground')}>
                      {group.label}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {kinds.map((k) => <KindCard key={k.type} kind={k} onPick={pick} />)}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
