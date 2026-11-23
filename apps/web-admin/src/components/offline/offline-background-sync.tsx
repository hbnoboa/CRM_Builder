'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useTenant } from '@/stores/tenant-context';
import { offlineEnabled } from '@/lib/offline/flags';

/**
 * Com o modo sem internet ligado neste aparelho, mantem os dados em dia enquanto o
 * sistema esta aberto e envia o que ficou na fila quando a internet volta.
 */
export function OfflineBackgroundSync() {
  const { tenant } = useTenant();
  const { user } = useAuthStore();
  const tenantId = tenant?.id;
  const userId = user?.id;
  useEffect(() => {
    if (!tenantId || !userId || !offlineEnabled(tenantId, userId)) return;
    const timer = setTimeout(() => {
      void import('@/lib/offline/offline-db').then((m) => m.connectOffline(tenantId, userId)).catch(() => undefined);
    }, 3000); // depois de a tela carregar
    return () => clearTimeout(timer);
  }, [tenantId, userId]);
  return null;
}
