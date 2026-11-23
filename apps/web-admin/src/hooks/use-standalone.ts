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
