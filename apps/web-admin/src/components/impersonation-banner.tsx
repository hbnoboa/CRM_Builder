'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';

type ImpersonatedBy = { id: string; name: string };

/**
 * Banner fixo e visível durante uma sessão de impersonação.
 * Lê `impersonatedBy` do localStorage (gravado por authStore.impersonate) e
 * permite encerrar restaurando a sessão original (stopImpersonation).
 */
export function ImpersonationBanner() {
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);
  const user = useAuthStore((s) => s.user);
  const locale = useLocale();
  const [impersonatedBy, setImpersonatedBy] = useState<ImpersonatedBy | null>(null);

  // Ao encerrar, volta para a home do tenant do admin restaurado (slug pode mudar).
  const handleStop = async () => {
    await stopImpersonation();
    const u = useAuthStore.getState().user as { tenant?: { slug?: string } } | null;
    const slug = u?.tenant?.slug;
    window.location.href = slug ? `/${locale}/${slug}/home` : `/${locale}/home`;
  };

  useEffect(() => {
    const read = () => {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem('impersonatedBy');
      try {
        setImpersonatedBy(raw ? (JSON.parse(raw) as ImpersonatedBy) : null);
      } catch {
        setImpersonatedBy(null);
      }
    };
    read();
    window.addEventListener('tenant-changed', read);
    return () => window.removeEventListener('tenant-changed', read);
  }, [user]);

  if (!impersonatedBy) return null;

  return (
    <div
      data-testid="impersonation-banner"
      className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow"
    >
      <span>
        Você está impersonando <strong>{user?.name ?? 'usuário'}</strong> (por {impersonatedBy.name})
      </span>
      <button
        type="button"
        data-testid="stop-impersonation"
        onClick={handleStop}
        className="rounded bg-amber-950 px-2 py-0.5 text-xs font-semibold text-amber-50 hover:bg-amber-900"
      >
        Sair da impersonação
      </button>
    </div>
  );
}
