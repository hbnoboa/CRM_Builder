'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight, Plus, TableProperties } from 'lucide-react';
import { Link } from '@/i18n/tenant-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntities } from '@/hooks/use-entities';
import { usePermissions } from '@/hooks/use-permissions';
import { GestaoPageHeader } from '@/components/gestao/gestao-ui';
import type { Entity } from '@/types';

/** Estrutura das tabelas da empresa (os registros ficam na operacao). */
export default function GestaoEntitiesPage() {
  const t = useTranslations('gestao.entities');
  const { hasModulePermission } = usePermissions();
  const { data, isLoading } = useEntities({ limit: 100 });
  const entities: Entity[] = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="space-y-6">
      <GestaoPageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={hasModulePermission('entities', 'canCreate') && (
          <Button asChild>
            <Link href="/gestao/entities/new"><Plus className="mr-2 h-4 w-4" />{t('new')}</Link>
          </Button>
        )}
      />
      {isLoading && <Skeleton className="h-40" />}
      {!isLoading && entities.length === 0 && (
        <Card><CardContent className="p-10 text-center text-muted-foreground">{t('empty')}</CardContent></Card>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {entities.map((e) => (
          <Link key={e.id} href={`/gestao/entities/${e.id}`} data-testid={`gestao-entity-${e.slug}`}>
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted" style={{ color: e.color || undefined }}>
                  <TableProperties className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t('meta', { fields: e.fields?.length ?? 0, records: (e._count?.data ?? 0) + (e._count?.archivedData ?? 0) })}
                    {e.category ? ` · ${e.category}` : ''}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
