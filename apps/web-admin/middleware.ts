import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './src/i18n/config';

// Modelo B: o tenant ativo viaja no header X-Tenant-Id (api.ts) + localStorage,
// não na URL. O rewrite de slug foi removido por quebrar o root layout do next-intl
// (o <html>/<body> vive em [locale]/layout; desviar do middleware do next-intl perdia
// esses tags). "Tenant na URL" como segmento exige reestruturar as rotas sob
// [locale]/[tenantSlug] (mudança maior) — fica para um passo dedicado.
export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: false,
});

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)', '/'],
};
