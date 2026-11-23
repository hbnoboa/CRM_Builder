/**
 * Aplicativo instalavel (PWA) de uma empresa: dados publicos vindos da API interna.
 * So no servidor (rotas do manifesto e dos icones); a API responde 404 quando a empresa
 * nao ligou "Permitir instalar como aplicativo".
 */
export interface TenantAppInfo {
  slug: string;
  name: string;
  shortName: string;
  brandColor: string | null;
  hasLogo: boolean;
  version: string;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

function apiBase(): string | null {
  const api = process.env.INTERNAL_API_URL;
  return api ? api.replace(/\/$/, '') : null;
}

export async function fetchTenantApp(slug: string): Promise<TenantAppInfo | null> {
  const api = apiBase();
  if (!api || !SLUG.test(slug)) return null;
  try {
    const res = await fetch(`${api}/public/tenants/${slug}/app`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as TenantAppInfo) : null;
  } catch {
    return null;
  }
}

/** Logo da empresa ja em PNG (a API converte); null quando nao ha. */
export async function fetchTenantAppLogo(slug: string): Promise<ArrayBuffer | null> {
  const api = apiBase();
  if (!api || !SLUG.test(slug)) return null;
  try {
    const res = await fetch(`${api}/public/tenants/${slug}/app/logo.png`, { cache: 'no-store' });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}
