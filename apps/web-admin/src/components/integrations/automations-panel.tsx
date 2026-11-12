'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight, Loader2, Zap } from 'lucide-react';
import { Link } from '@/i18n/tenant-navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAllAutomations } from '@/hooks/use-integrations';
import { useEntities } from '@/hooks/use-entities';
import type { Entity, EntityField } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { describeAutomation } from '@/lib/automation-describe';
import type { EntityAutomation } from '@/services/entity-automation.service';

/** Indice das automacoes de todas as tabelas; a edicao continua no editor da tabela. */
export function AutomationsPanel() {
  const t = useTranslations('gestao.integrations.automations');
  const { data: entitiesData, isLoading: loadingEntities } = useEntities({ limit: 100 });
  const entities: Entity[] = Array.isArray(entitiesData?.data) ? entitiesData.data : [];
  const results = useAllAutomations(entities.map((e) => e.id), entities.length > 0);
  const loading = loadingEntities || results.some((r) => r.isLoading);
  const rows = entities.flatMap((e, i) => (results[i]?.data ?? []).map((a) => ({ ...a, entity: e })));
  const { data: team } = useQuery({
    queryKey: ['team-directory'],
    queryFn: async () => (await api.get<Array<{ id: string; name: string }>>('/team-directory')).data,
    staleTime: 5 * 60_000,
  });
  const people = new Map((team || []).map((m) => [m.id, m.name]));

  return (
    <Card data-testid="automations-panel">
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
        {rows.map((a) => (
          <Link
            key={a.id}
            href={`/gestao/entities/${a.entity.id}?tab=automations`}
            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
            data-testid={`automation-${a.name}`}
          >
            <Zap className="h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {a.name}
                {!a.isActive && <Badge variant="outline">{t('paused')}</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const d = describeAutomation(a as unknown as EntityAutomation, (a.entity.fields || []) as EntityField[], a.entity.name, people);
                  return `${a.entity.name} · ${d.when}, ${d.then}.`;
                })()}
              </p>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:inline">{t('editInTable')}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
