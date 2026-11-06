'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TourStep {
  /** Valor do atributo data-tour do elemento destacado (sem alvo = mensagem no centro). */
  target?: string;
  title: string;
  text: string;
  /** Prepara a tela antes do passo (ex.: carregar um exemplo, trocar de aba). */
  onEnter?: () => void | Promise<void>;
}

const PAD = 6;

/**
 * Tutorial passo a passo: escurece a tela, recorta o elemento do passo e mostra a
 * explicacao ao lado (no celular, embaixo). Esc ou "Pular" fecham.
 */
export function GuidedTour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  // Quem usa recria a lista a cada desenho: os efeitos olham so a troca de passo
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const step = steps[index];

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const measure = useCallback(() => {
    const target = stepsRef.current[index]?.target;
    if (!target) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    setRect(el && el.offsetParent !== null ? el.getBoundingClientRect() : null);
  }, [index]);

  useLayoutEffect(() => {
    const step = stepsRef.current[index];
    if (!open || !step) return;
    let cancelled = false;
    void (async () => {
      await step.onEnter?.();
      // Espera a tela desenhar o que o passo preparou
      for (let i = 0; i < 20 && !cancelled; i++) {
        const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
        if (!step.target || (el && el.offsetParent !== null)) {
          el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!cancelled) setTimeout(measure, 350);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, index, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, measure, onClose]);

  if (!open || !mounted || !step) return null;
  const last = index === steps.length - 1;
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640;
  const below = rect ? rect.bottom + 220 < window.innerHeight : true;
  const cardStyle: React.CSSProperties = narrow || !rect
    ? {}
    : {
      top: below ? rect.bottom + PAD + 10 : Math.max(12, rect.top - PAD - 10 - 200),
      left: Math.min(Math.max(12, rect.left), window.innerWidth - 372),
    };

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={step.title} data-testid="guided-tour">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-200"
          style={{
            top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/60" />
      )}
      <div
        className={
          narrow || !rect
            ? `absolute inset-x-3 ${rect ? 'bottom-3' : 'top-1/2 -translate-y-1/2'} mx-auto max-w-md rounded-xl border bg-card p-4 shadow-2xl`
            : 'absolute w-[360px] rounded-xl border bg-card p-4 shadow-2xl'
        }
        style={cardStyle}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="font-semibold">{step.title}</p>
          <button type="button" onClick={onClose} aria-label="Fechar o tutorial" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{index + 1} de {steps.length}</span>
          <div className="flex gap-2">
            {index > 0 && (
              <Button size="sm" variant="outline" onClick={() => setIndex(index - 1)}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Voltar
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? onClose() : setIndex(index + 1))} data-testid="tour-next">
              {last ? 'Entendi' : <>Próximo <ArrowRight className="ml-1 h-3.5 w-3.5" /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
