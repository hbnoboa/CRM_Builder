import { create } from 'zustand';

/** Evento do Chrome/Edge que permite abrir o "Instalar aplicativo" quando quisermos. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallState {
  /** A empresa liberou instalar como aplicativo. */
  enabled: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** Ja aberto como aplicativo (tela cheia), ou acabou de instalar. */
  installed: boolean;
  setEnabled: (enabled: boolean) => void;
  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void;
  setInstalled: (installed: boolean) => void;
}

export const usePwaInstallStore = create<PwaInstallState>((set) => ({
  enabled: false,
  deferredPrompt: null,
  installed: false,
  setEnabled: (enabled) => set({ enabled }),
  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),
  setInstalled: (installed) => set({ installed }),
}));

/** Aberto como aplicativo instalado (tela cheia), inclusive no iPhone. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone/iPad: instalacao so pelo "Compartilhar > Adicionar a Tela de Inicio". */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
