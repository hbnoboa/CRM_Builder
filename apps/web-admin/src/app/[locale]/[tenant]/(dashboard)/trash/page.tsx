'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Clock, Loader2, Search, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import {
  useEmptyTrash, usePurgeFromTrash, useRestoreFromTrash, useTrash, useTrashTables, useUpdateTrashSettings,
} from '@/hooks/use-trash';
import { getErrorMessage } from '@/lib/get-error-message';
import { TRASH_RETENTION_OPTIONS, type TrashItem } from '@/services/trash.service';

const ALL = '__all__';
const NEVER = 'never';

export default function TrashPage() {
  const t = useTranslations('trash');
  const locale = useLocale();
  const { hasModulePermission } = usePermissions();
  const canManage = hasModulePermission('settings', 'canUpdate');

  const [entitySlug, setEntitySlug] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);
  useEffect(() => setPage(1), [entitySlug, debouncedSearch]);

  const { data: tables } = useTrashTables();
  const { data, isLoading } = useTrash({
    entitySlug: entitySlug === ALL ? undefined : entitySlug,
    search: debouncedSearch || undefined,
    page,
    limit: 25,
  });
  const restore = useRestoreFromTrash();
  const purge = usePurgeFromTrash();
  const empty = useEmptyTrash();
  const updateSettings = useUpdateTrashSettings();

  const [toPurge, setToPurge] = useState<TrashItem | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);

  const when = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: 'short' });
  const total = data?.meta.total ?? 0;

  const doRestore = (item: TrashItem) =>
    restore.mutate({ entitySlug: item.entity.slug, id: item.id }, {
      onSuccess: (r) => toast.success(r.restored > 1 ? t('restoredMany', { n: r.restored }) : t('restored')),
      onError: (e) => toast.error(getErrorMessage(e, t('restoreError'))),
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Trash2 className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            {data?.retentionDays ? t('subtitleRetention', { days: data.retentionDays }) : t('subtitle')}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={data?.retentionDays ? String(data.retentionDays) : NEVER}
              onValueChange={(v) =>
                updateSettings.mutate(v === NEVER ? null : Number(v), {
                  onSuccess: () => toast.success(t('retentionSaved')),
                  onError: (e) => toast.error(getErrorMessage(e)),
                })
              }
            >
              <SelectTrigger className="w-56" data-testid="trash-retention" aria-label={t('retentionLabel')}>
                <Clock className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEVER}>{t('retentionNever')}</SelectItem>
                {TRASH_RETENTION_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{t('retentionDays', { days: d })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="text-destructive" disabled={total === 0} onClick={() => setEmptyOpen(true)} data-testid="trash-empty">
              {t('empty')}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} data-testid="trash-search" />
        </div>
        <Select value={entitySlug} onValueChange={setEntitySlug}>
          <SelectTrigger className="sm:w-64" data-testid="trash-table-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allTables')}</SelectItem>
            {(tables ?? []).map((tb) => (
              <SelectItem key={tb.slug} value={tb.slug}>{tb.name} ({tb.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && !data ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (data?.data.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center" data-testid="trash-empty-state">
            <Trash2 className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">{debouncedSearch || entitySlug !== ALL ? t('noResults') : t('emptyState')}</p>
            <p className="text-sm text-muted-foreground">{t('emptyStateHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2" data-testid="trash-list">
          {data!.data.map((item) => (
            <Card key={item.id} data-testid={`trash-item-${item.id}`}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{item.title}</span>
                    <Badge variant="outline">{item.entity.name}</Badge>
                    {item.isSubRecord && <Badge variant="secondary">{t('subRecord')}</Badge>}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.deletedBy?.name ? t('deletedBy', { name: item.deletedBy.name, when: when(item.deletedAt) }) : t('deletedAt', { when: when(item.deletedAt) })}
                    {item.subRecords > 0 && <> · {t('withSubRecords', { n: item.subRecords })}</>}
                    {item.purgeAt && <> · {t('purgeAt', { date: day(item.purgeAt) })}</>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => doRestore(item)} disabled={restore.isPending} data-testid="trash-restore">
                    <Undo2 className="mr-1 h-4 w-4" /> {t('restore')}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToPurge(item)} data-testid="trash-purge">
                    {t('purge')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {data!.meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-sm">
              <span className="text-muted-foreground">{t('pageOf', { page, pages: data!.meta.totalPages, total })}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('prev')}</Button>
                <Button size="sm" variant="outline" disabled={page >= data!.meta.totalPages} onClick={() => setPage((p) => p + 1)} data-testid="trash-next">{t('next')}</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!toPurge} onOpenChange={(o) => !o && setToPurge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('purgeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('purgeHint', { title: toPurge?.title ?? '' })}
              {toPurge && toPurge.subRecords > 0 && ` ${t('purgeHintSub', { n: toPurge.subRecords })}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="trash-purge-confirm"
              onClick={() => toPurge && purge.mutate({ entitySlug: toPurge.entity.slug, id: toPurge.id }, {
                onSuccess: () => { toast.success(t('purged')); setToPurge(null); },
                onError: (e) => toast.error(getErrorMessage(e)),
              })}
            >
              {purge.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('purge')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{entitySlug === ALL ? t('emptyTitle') : t('emptyTableTitle', { name: tables?.find((x) => x.slug === entitySlug)?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('emptyHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="trash-empty-confirm"
              onClick={() => empty.mutate(entitySlug === ALL ? undefined : entitySlug, {
                onSuccess: (r) => { toast.success(t('emptied', { n: r.purged })); setEmptyOpen(false); },
                onError: (e) => toast.error(getErrorMessage(e)),
              })}
            >
              {t('empty')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
