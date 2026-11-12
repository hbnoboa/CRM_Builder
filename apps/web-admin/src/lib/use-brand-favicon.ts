import { useEffect } from 'react';

/**
 * Icone da aba com o logo da empresa (site e login no dominio dela). Ao sair,
 * volta o icone que estava.
 */
export function useBrandFavicon(logo: string | null | undefined) {
  useEffect(() => {
    if (!logo || typeof document === 'undefined') return;
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]'));
    const before = links.map((l) => [l, l.href] as const);
    const own = document.createElement('link');
    own.rel = 'icon';
    own.href = logo;
    links.forEach((l) => { l.href = logo; });
    if (!links.length) document.head.appendChild(own);
    return () => {
      before.forEach(([l, href]) => { l.href = href; });
      own.remove();
    };
  }, [logo]);
}
