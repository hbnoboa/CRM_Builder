'use client';

import { useEffect, useState } from 'react';

/**
 * Aplicativo aberto instalado (tela cheia): Android/desktop pelo display-mode standalone,
 * iPhone pelo navigator.standalone. So entao o sistema ganha a cara de app (abas embaixo).
 */
export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const read = () => setStandalone(mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return standalone;
}

/**
 * Tela de celular: largura abaixo de `lg` (1024px), onde o menu lateral ja fica
 * escondido. Nessa faixa o painel ganha a cara de app (abas embaixo, toques maiores)
 * tambem no navegador, sem precisar instalar. Comeca em false para o servidor e o
 * cliente renderizarem igual (evita salto na primeira pintura).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023.98px)');
    const read = () => setIsMobile(mq.matches);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return isMobile;
}
