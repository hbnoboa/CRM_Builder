import { locales } from '@/i18n/config';

// Rotas do sistema que nao devem ser convertidas para preview
const SYSTEM_ROUTES = [
  '/dashboard',
  '/pages',
  '/entities',
  '/data',
  '/users',
  '/settings',
  '/apis',
  '/tenants',
  '/login',
  '/register',
  '/profile',
];

/**
 * Normaliza hrefs internos para navegacao de paginas.
 * 
 * Esta funcao:
 * 1. Remove qualquer prefixo de locale (pt-BR, en, es) do href
 * 2. Converte slugs de paginas para o formato /preview/slug
 * 3. Preserva rotas do sistema e URLs externas
 * 
 * O router do i18n automaticamente adiciona o locale correto na navegacao,
 * entao os hrefs devem ser armazenados sem locale para evitar duplicacao.
 * 
 * @example
 * normalizeHref('/pt-BR/sinistro-lista') // '/preview/sinistro-lista'
 * normalizeHref('/en/sinistro-lista')    // '/preview/sinistro-lista'
 * normalizeHref('/sinistro-lista')       // '/preview/sinistro-lista'
 * normalizeHref('/preview/test')         // '/preview/test' (mantido)
 * normalizeHref('/dashboard')            // '/dashboard' (rota sistema)
 * normalizeHref('https://google.com')    // 'https://google.com' (externo)
 */
export function normalizeHref(href: string): string {
  if (!href || href === '#') return href;
  
  // URLs externas - retorna como esta
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  
  let normalized = href;
  
  // Cria regex dinamica com todos os locales configurados
  // Matches: /pt-BR/, /en/, /es/, etc.
  const localePattern = new RegExp(`^/(${locales.join('|')})/`, 'i');
  const localeMatch = normalized.match(localePattern);
  
  if (localeMatch) {
    // Remove o locale prefix, mantendo a barra inicial
    // Ex: /pt-BR/sinistro-lista -> /sinistro-lista
    normalized = normalized.slice(localeMatch[0].length - 1);
  }
  
  // Se ja tem /preview/, mantem como esta
  if (normalized.startsWith('/preview/')) return normalized;
  
  // Rotas do sistema que nao devem ser convertidas para preview
  if (SYSTEM_ROUTES.some(route => normalized.startsWith(route))) {
    return normalized;
  }
  
  // Assume que e um slug de pagina - converte para /preview/slug
  const slug = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  if (slug) {
    return `/preview/${slug}`;
  }
  
  return normalized;
}

/**
 * Versao que aceita undefined (para campos opcionais)
 */
export function normalizeHrefOptional(href: string | undefined): string | undefined {
  if (!href) return href;
  return normalizeHref(href);
}
