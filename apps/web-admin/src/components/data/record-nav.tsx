'use client';

import { createContext, useCallback, useContext } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/tenant-navigation';

// ─── Endereços ────────────────────────────────────────────────────────────────

/** Caminho (sem locale/tenant) da página de um registro, ou de criação quando sem id. */
export function recordPath(entitySlug: string, recordId?: string | null, opts?: { parent?: string; back?: string }): string {
  const base = recordId ? `/data/${entitySlug}/${recordId}` : `/data/${entitySlug}/novo`;
  const q = new URLSearchParams();
  if (!recordId && opts?.parent) q.set('pai', opts.parent);
  if (opts?.back) q.set('voltar', opts.back);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Tela atual (sem locale/tenant), para o "voltar" das páginas de registro. */
function currentBackPath(locale?: string, tenant?: string): string {
  if (typeof window === 'undefined') return '';
  let path = window.location.pathname;
  for (const seg of [locale, tenant]) {
    if (seg && (path === `/${seg}` || path.startsWith(`/${seg}/`))) path = path.slice(seg.length + 1) || '/';
  }
  return `${path}${window.location.search}`;
}

/** So aceita caminho interno (evita redirecionar para fora do sistema). */
export function safeBack(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

/**
 * Abre a página de um registro: clique normal navega; Ctrl/Cmd/Shift ou botão do meio
 * abre em nova guia. `confirmLeave` é perguntado antes de sair (alteração não salva).
 */
export function useOpenRecord(confirmLeave?: () => boolean) {
  const router = useRouter();
  const params = useParams<{ locale?: string; tenant?: string }>();
  const locale = typeof params?.locale === 'string' ? params.locale : undefined;
  const tenant = typeof params?.tenant === 'string' ? params.tenant : undefined;

  return useCallback((
    entitySlug: string,
    recordId?: string | null,
    opts?: { parent?: string; event?: ReactMouseEvent | MouseEvent },
  ) => {
    const e = opts?.event;
    const newTab = !!e && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1);
    const back = newTab ? undefined : currentBackPath(locale, tenant);
    const path = recordPath(entitySlug, recordId, { parent: opts?.parent, back });
    if (newTab) {
      const prefix = [locale, tenant].filter(Boolean).map((s) => `/${s}`).join('');
      window.open(`${prefix}${path}`, '_blank', 'noopener');
      return;
    }
    if (confirmLeave && !confirmLeave()) return;
    router.push(path);
  }, [router, locale, tenant, confirmLeave]);
}

// Dentro da página de um registro, as sub-tabelas abrem os filhos em páginas próprias
// (e perguntam antes de sair se o pai tem alteração não salva). Fora dela (chat,
// página pública) continuam no painel lateral.
export interface RecordPageNav {
  openRecord: (entitySlug: string, recordId?: string | null, opts?: { parent?: string; event?: ReactMouseEvent | MouseEvent }) => void;
}
export const RecordPageNavContext = createContext<RecordPageNav | null>(null);
export function useRecordPageNav(): RecordPageNav | null {
  return useContext(RecordPageNavContext);
}
