import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale } from './i18n/config';

/**
 * Unico middleware que o Next usa (com src/, ele le src/middleware.ts; o arquivo
 * middleware.ts da raiz do app nao roda). So trata as paginas para clientes no
 * subdominio da empresa; todo o resto passa direto, como antes.
 *
 *   <empresa>.iossystem.com.br/<pagina>      -> /<locale>/p/<empresa>/<pagina>
 *   <empresa>.dev.iossystem.com.br/<pagina>  -> idem (ambiente dev)
 *
 * O endereco no navegador continua o do subdominio. Precisa de DNS curinga,
 * certificado curinga e o nginx mandando esses hosts para o web (e /api para a API).
 */
const SITE_HOST = /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.(?:dev\.)?iossystem\.com\.br$/;
const RESERVED_SUBDOMAINS = new Set(['www', 'dev', 'api', 'app', 'admin', 'mail', 'sync']);

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  const match = SITE_HOST.exec(host);
  if (!match || RESERVED_SUBDOMAINS.has(match[1])) return NextResponse.next();

  const page = request.nextUrl.pathname.split('/').filter(Boolean)[0] || 'inicio';
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}/p/${match[1]}/${page}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)', '/'],
};
