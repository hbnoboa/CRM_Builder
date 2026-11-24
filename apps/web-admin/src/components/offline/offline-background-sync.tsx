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
    let interval: ReturnType<typeof setInterval> | undefined;
    const timer = setTimeout(async () => {
      try {
        const [{ connectOffline }, { cleanPhotoQueue }] = await Promise.all([import('@/lib/offline/offline-db'), import('@/lib/offline/photo-queue')]);
        // Conectado, o que ficou na fila (com as fotos) sobe tambem com o sistema normal aberto
        const { db } = await connectOffline(tenantId, userId);
        const clean = () => void cleanPhotoQueue(db, { tenantId, userId }).catch(() => undefined);
        clean();
        interval = setInterval(clean, 30_000);
      } catch { /* sem modo sem internet agora */ }
    }, 3000); // depois de a tela carregar
    return () => { clearTimeout(timer); if (interval) clearInterval(interval); };
  }, [tenantId, userId]);
  return null;
}
