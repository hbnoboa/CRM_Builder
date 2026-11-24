'use client';

import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

const TRIGGER = 96; // px arrastados para a esquerda para pedir a exclusao

/**
 * Arrastar o cartao para a esquerda pede para excluir (como o Dismissible do app
 * Flutter): aparece o fundo vermelho com a lixeira e, ao soltar, a confirmacao.
 * So com o dedo; o mouse continua clicando normal.
 */
export function SwipeToDelete({ enabled, onDelete, children }: { enabled: boolean; onDelete: () => void; children: React.ReactNode }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);
  const moved = useRef(false);
  const last = useRef(0);

  if (!enabled) return <>{children}</>;

  const end = () => {
    if (swiping.current && last.current <= -TRIGGER) onDelete();
    start.current = null;
    swiping.current = false;
    last.current = 0;
    setDragging(false);
    setDx(0);
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return;
        start.current = { x: e.clientX, y: e.clientY };
        moved.current = false;
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const ddx = e.clientX - start.current.x;
        const ddy = e.clientY - start.current.y;
        if (!swiping.current) {
          if (ddx < -10 && Math.abs(ddx) > Math.abs(ddy) * 1.5) {
            swiping.current = true;
            setDragging(true);
          } else if (Math.abs(ddy) > 10) {
            start.current = null;
            return;
          } else return;
        }
        moved.current = true;
        last.current = Math.max(Math.min(ddx, 0), -window.innerWidth * 0.6);
        setDx(last.current);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onClickCapture={(e) => {
        // Soltou depois de arrastar: nao abre o registro
        if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; }
      }}
      data-testid="swipe-to-delete"
    >
      <div className="absolute inset-0 flex items-center justify-end rounded-xl bg-destructive pr-5 text-destructive-foreground" style={{ opacity: dx < 0 ? 1 : 0 }} aria-hidden>
        <Trash2 className="h-5 w-5" />
      </div>
      <div className="relative" style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 0.2s ease' }}>
        {children}
      </div>
    </div>
  );
}
