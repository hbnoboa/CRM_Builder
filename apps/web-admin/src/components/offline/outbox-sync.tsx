'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CloudUpload, Loader2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dataKeys } from '@/hooks/use-data';
import { cleanFormPhotos } from '@/lib/offline/photo-queue';
import { discard, outboxRefs, processOutbox, setOnSent, useOutbox, type Owner } from '@/lib/outbox';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';

/**
 * Envia a fila da tela normal: ao abrir o sistema, quando a internet volta e a cada 30s.
 * A pessoa nao precisa ficar na tela do registro (igual ao app do celular).
 */
export function OutboxSync({ owner }: { owner: Owner | null }) {
  const queryClient = useQueryClient();
  const tenantId = owner?.tenantId;
  const userId = owner?.userId;
  useEffect(() => {
    if (!tenantId || !userId) return;
    const me = { tenantId, userId };
    setOnSent(() => void queryClient.invalidateQueries({ queryKey: dataKeys.all }));
    const run = () => {
      void processOutbox(me).catch(() => undefined);
      void outboxRefs(me).then((refs) => cleanFormPhotos(me, refs)).catch(() => undefined);
    };
    const timer = setTimeout(run, 1500);
    const interval = setInterval(run, 30_000);
    window.addEventListener('online', run);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('online', run);
      setOnSent(null);
    };
  }, [tenantId, userId, queryClient]);
  return null;
}

/** No layout da empresa (qualquer tela: painel, operacional, gestao). */
export function OutboxHost() {
  const { tenant } = useTenant();
  const userId = useAuthStore((st) => st.user?.id);
  return <OutboxSync owner={tenant?.id && userId ? { tenantId: tenant.id, userId } : null} />;
}

/** Faixa no topo: quantas alteracoes faltam subir e as que o servidor recusou. */
export function OutboxBanner() {
  const t = useTranslations('outbox');
  const { items, sending } = useOutbox();
  const pending = items.filter((i) => !i.error).length;
  const failed = items.filter((i) => i.error);
  if (!pending && !failed.length) return null;
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div className="mb-4 space-y-2" data-testid="outbox-banner">
      {pending > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          {sending ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : offline ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> : <CloudUpload className="mt-0.5 h-4 w-4 shrink-0" />}
          <span data-testid="outbox-pending">{sending ? t('sending', { n: pending }) : t('waiting', { n: pending })}</span>
        </div>
      )}
      {failed.map((item) => (
        <div key={item.key} className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm" data-testid="outbox-failed">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span className="flex-1">{t('rejected', { name: item.entityName || item.entitySlug, error: item.error ?? '' })}</span>
          <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => void discard(item.key)}>{t('discard')}</Button>
        </div>
      ))}
    </div>
  );
}
