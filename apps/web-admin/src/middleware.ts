import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale } from './i18n/config';

/**
 * Unico middleware que o Next usa (com src/, ele le src/middleware.ts; o arquivo
 * middleware.ts da raiz do app nao roda). So trata as paginas para clientes; todo
 * o resto passa direto, como antes.
 *
 *   <empresa>.iossystem.com.br/<pagina>      -> /<locale>/p/<empresa>/<pagina>
 *   <empresa>.dev.iossystem.com.br/<pagina>  -> idem (ambiente dev)
 *   www.dominiodocliente.com.br/<pagina>     -> idem, achando a empresa pelo dominio
 *                                               (Site da empresa › Domínio próprio)
 *
 * O endereco no navegador continua o do cliente. Precisa do proxy mandando esses
 * hosts para o web (e /api para a API) e de certificado para cada um.
 */
const SITE_HOST = /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.(?:dev\.)?iossystem\.com\.br$/;
const RESERVED_SUBDOMAINS = new Set(['www', 'dev', 'api', 'app', 'admin', 'mail', 'sync']);

/** Enderecos da propria plataforma (nunca sao dominio de cliente). */
function isPlatformHost(host: string) {
  const extra = (process.env.PLATFORM_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return host === 'iossystem.com.br' || host.endsWith('.iossystem.com.br') || host === 'localhost'
    || /^\d+\.\d+\.\d+\.\d+$/.test(host) || !host.includes('.') || extra.some((h) => host === h || host.endsWith(`.${h}`));
}

// Dominio do cliente -> empresa, guardado por alguns minutos (cada instancia do web)
const cache = new Map<string, { tenant: string | null; until: number }>();
const TTL_FOUND = 5 * 60 * 1000;
const TTL_MISSING = 60 * 1000;

async function tenantForHost(host: string): Promise<string | null> {
  const hit = cache.get(host);
  if (hit && hit.until > Date.now()) return hit.tenant;
  const api = process.env.INTERNAL_API_URL;
  if (!api) return null;
  let tenant: string | null = null;
  try {
    const res = await fetch(`${api.replace(/\/$/, '')}/public/domains/resolve?host=${encodeURIComponent(host)}`, { cache: 'no-store' });
    if (res.ok) tenant = ((await res.json()) as { tenant?: string }).tenant ?? null;
  } catch {
    return hit?.tenant ?? null; // API fora do ar: usa o que ja sabia
  }
  cache.set(host, { tenant, until: Date.now() + (tenant ? TTL_FOUND : TTL_MISSING) });
  return tenant;
}

function rewrite(request: NextRequest, tenant: string) {
  const page = request.nextUrl.pathname.split('/').filter(Boolean)[0] || 'inicio';
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}/p/${tenant}/${page}`;
  return NextResponse.rewrite(url);
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  const match = SITE_HOST.exec(host);
  if (match && !RESERVED_SUBDOMAINS.has(match[1])) return rewrite(request, match[1]);
  if (isPlatformHost(host)) return NextResponse.next();

  const tenant = await tenantForHost(host);
  if (tenant) return rewrite(request, tenant);
  return new NextResponse('Este endereço ainda não está ligado a nenhum site.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)', '/'],
};
