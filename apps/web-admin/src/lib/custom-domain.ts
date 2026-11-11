'use client';

import { useEffect, useState } from 'react';

/**
 * Dominio proprio de empresa (Site da empresa › Domínio próprio). No endereco da
 * empresa, o sistema abre so para ela e com a marca dela (tela de login sem CRM Builder,
 * sem troca de empresa). Fora dele (enderecos da plataforma), tudo segue igual.
 */

/** Enderecos da propria plataforma (nunca sao dominio de cliente). */
export function isPlatformHost(host: string): boolean {
  const h = host.split(':')[0].toLowerCase();
  const extra = (process.env.NEXT_PUBLIC_PLATFORM_HOSTS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return h === 'iossystem.com.br' || h.endsWith('.iossystem.com.br') || h === 'localhost'
    || /^\d+\.\d+\.\d+\.\d+$/.test(h) || !h.includes('.') || extra.some((x) => h === x || h.endsWith(`.${x}`));
}

export interface CustomDomainBrand {
  tenant: string;
  name: string;
  logo: string | null;
  brandColor: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

/** Marca da empresa dona do endereco atual; null no endereco da plataforma. */
export function useCustomDomain(): { brand: CustomDomainBrand | null; loading: boolean } {
  const [state, setState] = useState<{ brand: CustomDomainBrand | null; loading: boolean }>({ brand: null, loading: true });
  useEffect(() => {
    const host = window.location.hostname;
    if (isPlatformHost(host)) {
      setState({ brand: null, loading: false });
      return;
    }
    fetch(`${API_URL}/public/domains/resolve?host=${encodeURIComponent(host)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((brand: CustomDomainBrand | null) => setState({ brand, loading: false }))
      .catch(() => setState({ brand: null, loading: false }));
  }, []);
  return state;
}

/** No dominio de uma empresa? (sem esperar a API; so pelo endereco) */
export function onCustomDomain(): boolean {
  return typeof window !== 'undefined' && !isPlatformHost(window.location.hostname);
}
