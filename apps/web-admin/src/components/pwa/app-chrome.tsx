'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Cara de app (como o app Flutter): a barra do topo mostra o titulo da tela e o
 * menu (ou voltar). A moldura guarda o titulo; cada tela informa o seu com
 * useAppTitle. Fora do modo app (computador) nada disso aparece.
 */
export interface AppChrome {
  title?: string;
  /** Mostra a seta de voltar no lugar do menu */
  onBack?: () => void;
}

interface AppChromeCtx {
  appMode: boolean;
  setChrome: (chrome: AppChrome | null) => void;
}

export const AppChromeContext = createContext<AppChromeCtx>({ appMode: false, setChrome: () => {} });

/** Celular ou app instalado: as telas trocam o proprio cabecalho pela barra do topo. */
export function useAppMode(): boolean {
  return useContext(AppChromeContext).appMode;
}

/** Titulo da tela na barra do topo (e a seta de voltar, se onBack vier). */
export function useAppTitle(title: string | undefined, onBack?: () => void) {
  const { setChrome } = useContext(AppChromeContext);
  const backRef = useRef(onBack);
  backRef.current = onBack;
  const hasBack = !!onBack;
  useEffect(() => {
    setChrome({ title, onBack: hasBack ? () => backRef.current?.() : undefined });
    return () => setChrome(null);
  }, [title, hasBack, setChrome]);
}

/**
 * Estado da moldura de app, para os shells (principal e operacional): se esta no
 * modo app, o titulo/voltar informados pela tela e o valor do contexto.
 */
export function useAppFrame(appMode: boolean, pathname: string) {
  const tNav = useTranslations('navigation');
  const [chrome, setChrome] = useState<AppChrome | null>(null);
  const labels: Record<string, string> = {
    '/home': tNav('home'),
    '/dashboard': tNav('appNav.dashboard'),
    '/tabelas': tNav('appNav.data'),
    '/data': tNav('appNav.data'),
    '/chat': tNav('chat'),
    '/profile': tNav('profile'),
    '/settings': tNav('settings'),
    '/trash': tNav('trash'),
    '/support': tNav('support'),
  };
  const ctx = useMemo(() => ({ appMode, setChrome }), [appMode]);
  // Titulo padrao pela rota, ate a tela informar o dela (ex.: o nome da tabela)
  const fallback = Object.entries(labels).find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1];
  return { ctx, title: chrome?.title ?? fallback, onBack: chrome?.onBack };
}
