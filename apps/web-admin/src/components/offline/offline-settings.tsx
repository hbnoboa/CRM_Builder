'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { PowerSyncDatabase } from '@powersync/web';
import { CloudOff, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import { connectOffline, offlineEnabled, removeOfflineData, setOfflineEnabled } from '@/lib/offline/offline-db';
import { useLocalQuery, useOfflineStatus } from '@/lib/offline/hooks';
import { clearOfflineProfile, saveOfflineProfile } from '@/lib/offline/profile';
import { clearQueuedPhotos, listQueuedPhotos } from '@/lib/offline/photo-queue';

/** Carrega a tela de campo escondida: o service worker guarda a pagina e os arquivos dela. */
export function prepareCampoPage(locale: string, slug: string) {
  const frame = document.createElement('iframe');
  frame.style.display = 'none';
  frame.src = `/${locale}/${slug}/campo?preparar=1`;
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 20_000);
}

/** Configuracoes > Sem internet: baixa os dados para este aparelho e abre o modo de campo. */
export function OfflineSettings() {
  const t = useTranslations('offline.settings');
  const params = useParams<{ locale: string }>();
  const locale = params?.locale || 'pt-BR';
  const { tenant } = useTenant();
  const { user } = useAuthStore();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [db, setDb] = useState<PowerSyncDatabase | null>(null);
  const [storage, setStorage] = useState<string | null>(null);
  const tenantId = tenant?.id ?? '';
  const userId = user?.id ?? '';

  useEffect(() => {
    if (!tenantId || !userId) return;
    const on = offlineEnabled(tenantId, userId);
    setEnabled(on);
    if (on) void connectOffline(tenantId, userId).then((h) => setDb(h.db)).catch(() => undefined);
  }, [tenantId, userId]);

  useEffect(() => {
    if (!enabled || !navigator.storage?.estimate) return;
    const tick = () => navigator.storage.estimate().then((e) => setStorage(`${((e.usage ?? 0) / 1024 / 1024).toFixed(0)} MB`)).catch(() => undefined);
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [enabled]);

  const { status, pending } = useOfflineStatus(db);
  const records = useLocalQuery<{ n: number }>(db, 'SELECT count(*) AS n FROM EntityData');

  if (!tenant || !user) return null;

  const turnOn = async () => {
    setBusy(true);
    try {
      // Pede ao navegador para nao apagar os dados quando faltar espaco
      await navigator.storage?.persist?.().catch(() => false);
      const role = (user as { customRole?: { id?: string; permissions?: unknown; modulePermissions?: unknown } }).customRole;
      saveOfflineProfile({
        tenantId, tenantSlug: tenant.slug, tenantName: tenant.name,
        brandColor: tenant.settings?.theme?.brandColor ?? null,
        userId, userName: user.name ?? '', roleId: role?.id ?? null,
        role: role ? { permissions: role.permissions, modulePermissions: role.modulePermissions } : null,
      });
      setOfflineEnabled(tenantId, userId, true);
      const handle = await connectOffline(tenantId, userId);
      setDb(handle.db);
      setEnabled(true);
      prepareCampoPage(locale, tenant.slug);
      toast.success(t('enabled'));
    } catch (error) {
      setOfflineEnabled(tenantId, userId, false);
      toast.error((error as Error).message || t('failed'));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    const photos = (await listQueuedPhotos({ tenantId, userId }).catch(() => [])).length;
    if ((pending > 0 || photos > 0) && !window.confirm(t('confirmOffPending', { n: pending, photos }))) return;
    setBusy(true);
    try {
      await removeOfflineData(tenantId, userId);
      await clearQueuedPhotos({ tenantId, userId }).catch(() => undefined);
      clearOfflineProfile(tenant.slug);
      setDb(null);
      setEnabled(false);
      toast.success(t('disabled'));
    } finally {
      setBusy(false);
    }
  };

  const syncing = status?.dataFlowStatus?.downloading || status?.dataFlowStatus?.uploading;
  return (
    <Card data-testid="offline-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CloudOff className="h-4 w-4" /> {t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <Label htmlFor="offline-enabled" className="cursor-pointer">
            <span className="block text-sm font-medium">{t('enable')}</span>
            <span className="block text-xs font-normal text-muted-foreground">{t('enableHint')}</span>
          </Label>
          <Switch id="offline-enabled" checked={enabled} disabled={busy} data-testid="offline-enabled"
            onCheckedChange={(v) => void (v ? turnOn() : turnOff())} />
        </div>
        {enabled && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm" data-testid="offline-status">
            <p className="flex items-center gap-2">
              {(busy || syncing || !status?.hasSynced) && <Loader2 className="h-4 w-4 animate-spin" />}
              {!status?.hasSynced ? t('downloading') : syncing ? t('syncing') : t('ready')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('stats', { records: Number(records.data[0]?.n ?? 0).toLocaleString('pt-BR'), pending })}
              {storage && ` · ${t('storage', { size: storage })}`}
              {status?.lastSyncedAt && ` · ${t('lastSync', { when: status.lastSyncedAt.toLocaleString('pt-BR') })}`}
            </p>
            <Button asChild size="sm" variant="outline" data-testid="offline-open">
              <a href={`/${locale}/${tenant.slug}/campo`}><ExternalLink className="mr-1.5 h-4 w-4" />{t('open')}</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
