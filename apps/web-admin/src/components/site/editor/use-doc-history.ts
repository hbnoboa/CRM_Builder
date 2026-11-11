import { useCallback, useRef, useState } from 'react';

const LIMIT = 80;
/** Mudancas seguidas no mesmo campo (digitando) viram um passo so de desfazer. */
const MERGE_MS = 900;

interface State<T> { past: T[]; present: T; future: T[] }

/**
 * Historico para desfazer/refazer. `update` com `silent` muda sem criar passo
 * (ex.: a grade reajustando alturas sozinha); `checkpoint` registra um passo a
 * partir de um estado anterior (ex.: o inicio de um arrasto).
 */
export function useDocHistory<T>(initial: T) {
  const [state, setState] = useState<State<T>>({ past: [], present: initial, future: [] });
  const last = useRef<{ tag: string; at: number } | null>(null);

  const update = useCallback((fn: (prev: T) => T, opts?: { tag?: string; silent?: boolean }) => {
    const now = Date.now();
    const merge = !!opts?.tag && last.current?.tag === opts.tag && now - last.current.at < MERGE_MS;
    if (!opts?.silent) last.current = opts?.tag ? { tag: opts.tag, at: now } : null;
    setState((s) => {
      const next = fn(s.present);
      if (next === s.present) return s;
      if (opts?.silent) return { ...s, present: next };
      return { past: merge ? s.past : [...s.past.slice(-LIMIT), s.present], present: next, future: [] };
    });
  }, []);

  const checkpoint = useCallback((before: T) => {
    last.current = null;
    setState((s) => (before === s.present ? s : { past: [...s.past.slice(-LIMIT), before], present: s.present, future: [] }));
  }, []);

  const undo = useCallback(() => {
    last.current = null;
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);

  const redo = useCallback(() => {
    last.current = null;
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);

  /** Troca tudo (ao carregar ou depois de salvar), sem historico. */
  const reset = useCallback((doc: T, keepHistory = false) => {
    last.current = null;
    setState((s) => (keepHistory ? { ...s, present: doc } : { past: [], present: doc, future: [] }));
  }, []);

  return { doc: state.present, update, checkpoint, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
