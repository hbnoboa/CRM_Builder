'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Database } from 'lucide-react';
import { useRouter } from '@/i18n/tenant-navigation';
import { useEntitiesGrouped } from '@/hooks/use-entities';
import { useActiveTenant } from '@/stores/tenant-context';
import { entityIconFor } from '@/components/layout/entity-nav-item';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

/**
 * Tela "Dados" do app instalado: as tabelas da empresa em cartoes (como o app do celular).
 * Tocar abre a tabela. So aparece de verdade no app (o menu normal continua no navegador).
 */
export default function TabelasPage() {
  const t = useTranslations('appTables');
  const router = useRouter();
  const { slug } = useActiveTenant();
  const { data: groups, isLoading } = useEntitiesGrouped(slug);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (groups || [])
      .map((g) => ({ ...g, entities: g.entities.filter((e) => !term || e.name.toLowerCase().includes(term)) }))
      .filter((g) => g.entities.length > 0);
  }, [groups, q]);

  return (
    <div className="mx-auto max-w-lg space-y-4" data-testid="app-tables">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <Input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        filtered.map((group) => (
          <div key={group.category ?? '_'} className="space-y-2">
            {group.category && <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.category}</h2>}
            <div className="space-y-2">
              {group.entities.map((e) => {
                const Icon = entityIconFor(e.icon) || Database;
                const count = (e._count?.data ?? 0) + (e._count?.archivedData ?? 0);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => router.push(`/data?entity=${e.slug}`)}
                    className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left active:bg-muted/50"
                    data-testid={`app-table-${e.slug}`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.name}</span>
                      <span className="block text-xs text-muted-foreground">{t('records', { count })}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
