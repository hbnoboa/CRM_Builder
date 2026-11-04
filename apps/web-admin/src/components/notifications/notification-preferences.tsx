'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useEntities } from '@/hooks/use-entities';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/get-error-message';
import type { Entity } from '@/types';
import { type NotificationPrefs, useNotificationPrefs, useSaveNotificationPrefs } from './notification-prefs-api';

function Row({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <Label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} data-testid={id} />
    </div>
  );
}

/** Configuracoes > Notificacoes: o que avisar e como (vale nesta empresa). */
export function NotificationPreferences() {
  const t = useTranslations('notificationPrefs');
  const { data: prefs, isLoading } = useNotificationPrefs();
  const save = useSaveNotificationPrefs();
  const { hasEntityPermission } = usePermissions();
  const { data: entitiesData } = useEntities({ limit: 100 });
  const entities: Entity[] = (Array.isArray(entitiesData?.data) ? entitiesData.data : []).filter((e: Entity) => hasEntityPermission(e.slug, 'canRead'));

  if (isLoading || !prefs) return <Skeleton className="h-64" />;

  const update = (next: NotificationPrefs) =>
    save.mutate(next, {
      onSuccess: () => toast.success(t('saved'), { id: 'notification-prefs' }),
      onError: (e) => toast.error(getErrorMessage(e)),
    });

  return (
    <div className="space-y-4">
      <Card data-testid="prefs-events">
        <CardHeader>
          <CardTitle className="text-base">{t('eventsTitle')}</CardTitle>
          <CardDescription>{t('eventsHint')}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {(['created', 'updated', 'deleted'] as const).map((ev) => (
            <Row key={ev} id={`pref-${ev}`} label={t(`events.${ev}`)} checked={prefs.events[ev]}
              onChange={(v) => update({ ...prefs, events: { ...prefs.events, [ev]: v } })} />
          ))}
          <Row id="pref-own" label={t('ownActions')} hint={t('ownActionsHint')} checked={prefs.ownActions}
            onChange={(v) => update({ ...prefs, ownActions: v })} />
        </CardContent>
      </Card>

      <Card data-testid="prefs-channels">
        <CardHeader>
          <CardTitle className="text-base">{t('channelsTitle')}</CardTitle>
          <CardDescription>{t('channelsHint')}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <Row id="pref-popups" label={t('popups')} hint={t('popupsHint')} checked={prefs.popups}
            onChange={(v) => update({ ...prefs, popups: v })} />
          <Row id="pref-push" label={t('push')} hint={t('pushHint')} checked={prefs.push}
            onChange={(v) => update({ ...prefs, push: v })} />
        </CardContent>
      </Card>

      <Card data-testid="prefs-tables">
        <CardHeader>
          <CardTitle className="text-base">{t('tablesTitle')}</CardTitle>
          <CardDescription>{t('tablesHint')}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {entities.length === 0 && <p className="py-2 text-sm text-muted-foreground">{t('noTables')}</p>}
          {entities.map((e) => {
            const muted = prefs.mutedEntities.includes(e.slug);
            return (
              <Row key={e.slug} id={`pref-table-${e.slug}`} label={e.namePlural || e.name} checked={!muted}
                onChange={(on) => update({
                  ...prefs,
                  mutedEntities: on ? prefs.mutedEntities.filter((s) => s !== e.slug) : [...prefs.mutedEntities, e.slug],
                })} />
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
