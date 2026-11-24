'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';

// So um botao + na tela, mesmo com varias tabelas no painel: o primeiro que pede fica com ele
let owner: symbol | null = null;

/** true para o primeiro componente (ativo) que pedir o botao flutuante. */
export function useAppFab(active: boolean): boolean {
  const [own, setOwn] = useState(false);
  useEffect(() => {
    if (!active || owner) return;
    const me = Symbol('fab');
    owner = me;
    setOwn(true);
    return () => {
      if (owner === me) owner = null;
      setOwn(false);
    };
  }, [active]);
  return own;
}

/**
 * Botao redondo "+" no canto (FloatingActionButton do app Flutter), acima das abas.
 * Vai direto no body: dentro do bloco do painel (que usa transform) o "fixed" nao
 * ficaria preso a tela.
 */
export function AppFab({ onClick, label }: { onClick: () => void; label: string }) {
  return createPortal(
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_3px_8px_rgb(0_0_0/0.2)] transition-transform active:scale-95 lg:hidden"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      data-testid="app-fab"
    >
      <Plus className="h-6 w-6" />
    </button>,
    document.body,
  );
}
