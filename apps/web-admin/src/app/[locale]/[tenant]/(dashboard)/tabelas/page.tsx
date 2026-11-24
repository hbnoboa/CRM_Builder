'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Folder, Layers, ListChecks, Search, Table2 } from 'lucide-react';
import { useRouter } from '@/i18n/tenant-navigation';
import { useEntitiesGrouped } from '@/hooks/use-entities';
import { useActiveTenant } from '@/stores/tenant-context';
import { entityIconFor } from '@/components/layout/entity-nav-item';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Entity } from '@/types';

// Cores das tabelas sem cor propria (mesma paleta do app Flutter)
const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

/**
 * Tela "Dados" (aba de baixo), igual a do app Flutter: busca arredondada, categorias que
 * abrem e fecham e cartoes com a faixa e o icone na cor da tabela, registros e campos.
 * Com uma tabela so, ja abre ela.
 */
export default function TabelasPage() {
  const t = useTranslations('appTables');
  const router = useRouter();
  const { slug } = useActiveTenant();
  const { data: groups, isLoading } = useEntitiesGrouped(slug);
  const [q, setQ] = useState('');
  // Como no app: "sem categoria" aberta, as outras fechadas
  const [open, setOpen] = useState<Set<string>>(() => new Set(['']));

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (groups || [])
      .map((g) => ({
        category: g.category ?? '',
        entities: g.entities.filter((e) => !term
          || [e.name, e.namePlural, e.slug, g.category].some((s) => s?.toLowerCase().includes(term))),
      }))
      .filter((g) => g.entities.length > 0);
  }, [groups, q]);

  // Uma tabela so: abre direto (uma vez)
  const autoOpened = useRef(false);
  const all = filtered.flatMap((g) => g.entities);
  useEffect(() => {
    if (!isLoading && !q && all.length === 1 && !autoOpened.current) {
      autoOpened.current = true;
      router.replace(`/data?entity=${all[0].slug}`);
    }
  }, [isLoading, q, all, router]);

  const toggle = (cat: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });

  let index = 0;
  const card = (e: Entity) => {
    const color = e.color || PALETTE[index++ % PALETTE.length];
    const Icon = entityIconFor(e.icon);
    const count = (e._count?.data ?? 0) + ((e._count as { archivedData?: number } | undefined)?.archivedData ?? 0);
    return (
      <button
        key={e.id}
        type="button"
        onClick={() => router.push(`/data?entity=${e.slug}`)}
        className="flex w-full overflow-hidden rounded-2xl bg-card text-left shadow-[0_2px_10px_rgb(16_24_40/0.08)] active:bg-muted/40"
        data-testid={`app-table-${e.slug}`}
      >
        <span className="w-1 shrink-0" style={{ backgroundColor: color }} />
        <span className="flex min-w-0 flex-1 items-center gap-4 p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
            <Icon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{e.namePlural || e.name}</span>
            <span className="mt-1 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
                <Layers className="h-3 w-3" />{count}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted-foreground/10 px-2 py-1 text-xs font-medium text-muted-foreground">
                <ListChecks className="h-3 w-3" />{t('fields', { count: e.fields?.length ?? 0 })}
              </span>
            </span>
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="-mx-3 -mt-3 lg:mx-0 lg:mt-0" data-testid="app-tables">
      <div className="bg-card p-4 shadow-[0_2px_10px_rgb(16_24_40/0.03)]">
        <p className="mb-2 text-xs text-muted-foreground">{t('pickTable')}</p>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder={t('search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 w-full rounded-full border-0 !bg-muted pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Table2 className="h-10 w-10 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">{t('empty')}</p>
          </div>
        ) : filtered.length === 1 ? (
          filtered[0].entities.map(card)
        ) : (
          filtered.map((g) => {
            const isOpen = !!q || open.has(g.category);
            return (
              <div key={g.category || '_'}>
                <button type="button" onClick={() => toggle(g.category)} className="flex w-full items-center gap-1 rounded-xl px-1 py-2 text-left active:bg-muted/50" data-testid="app-table-category">
                  {isOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  <Folder className="ml-1 h-[18px] w-[18px] text-primary" />
                  <span className="ml-2 min-w-0 flex-1 truncate text-sm font-semibold">{g.category || t('other')}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{g.entities.length}</span>
                </button>
                <div className={cn('space-y-4', isOpen ? 'mt-2 pb-2' : 'hidden')}>{g.entities.map(card)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
