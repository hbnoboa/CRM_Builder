'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRIGGER = 64; // px puxados (ja amortecidos) para atualizar
const MAX = 96;

/** Algum pai do toque ja rolou para baixo: o gesto e para rolar ele, nao para atualizar. */
function scrolledInside(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) if (n.scrollTop > 0) return true;
  return false;
}

/**
 * Puxar a tela para baixo atualiza os dados, como no app Flutter (RefreshIndicator).
 * Recarrega as consultas e avisa as tabelas (evento "app-refresh"). O "puxar" nativo
 * do navegador fica desligado no modo app (overscroll-behavior no CSS).
 */
export function PullToRefresh() {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let active = false;
    let dist = 0;
    const onStart = (e: TouchEvent) => {
      const target = e.target as Element | null;
      active = !busyRef.current && e.touches.length === 1 && window.scrollY <= 0
        && !scrolledInside(target) && !target?.closest('[role="dialog"], [data-no-pull]');
      if (!active) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dist = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
        dist = 0;
        setPull(0);
        return;
      }
      dist = Math.min(dy * 0.5, MAX);
      setPull(dist);
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      setPull(0);
      if (dist < TRIGGER) return;
      busyRef.current = true;
      setBusy(true);
      window.dispatchEvent(new Event('app-refresh'));
      void qc.invalidateQueries().finally(() => {
        setTimeout(() => { busyRef.current = false; setBusy(false); }, 400);
      });
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [qc]);

  if (!pull && !busy) return null;
  const offset = busy ? TRIGGER : pull;
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-[calc(var(--banner-h,0px)+3.5rem)] z-40"
      style={{ transform: `translate(-50%, ${offset - 40}px)`, opacity: busy ? 1 : Math.min(1, pull / TRIGGER) }}
      data-testid="pull-to-refresh"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-primary shadow-md">
        <RefreshCw className={cn('h-5 w-5', busy && 'animate-spin')} style={busy ? undefined : { transform: `rotate(${pull * 3}deg)` }} />
      </span>
    </div>
  );
}
