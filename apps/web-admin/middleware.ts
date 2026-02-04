import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './src/i18n/config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true,
});

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Ignora arquivos estaticos e API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // arquivos com extensao
  ) {
    return NextResponse.next();
  }
  
  // Pega o locale salvo no cookie (se existir)
  const savedLocale = request.cookies.get('NEXT_LOCALE')?.value;
  const localeToUse = savedLocale && locales.includes(savedLocale as any) ? savedLocale : defaultLocale;
  
  // Verifica se o pathname ja tem um locale valido
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
  
  // Se nao tem locale no path, redireciona para a versao com locale
  if (!pathnameHasLocale) {
    // Garante que o path comeca com /
    const pathToRedirect = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const newUrl = new URL(`/${localeToUse}${pathToRedirect}`, request.url);
    newUrl.search = request.nextUrl.search;
    
    const response = NextResponse.redirect(newUrl);
    // Salva o locale no cookie para proximas requisicoes
    response.cookies.set('NEXT_LOCALE', localeToUse, {
      maxAge: 60 * 60 * 24 * 365, // 1 ano
      path: '/',
    });
    return response;
  }
  
  // Extrai o locale atual do path
  const currentLocale = pathname.split('/')[1];
  
  // Executa o middleware do next-intl
  const response = intlMiddleware(request);
  
  // Atualiza o cookie com o locale atual
  if (response && locales.includes(currentLocale as any)) {
    response.cookies.set('NEXT_LOCALE', currentLocale, {
      maxAge: 60 * 60 * 24 * 365, // 1 ano
      path: '/',
    });
  }
  
  return response;
}

export const config = {
  // Matcher que captura todas as rotas exceto arquivos estaticos
  matcher: ['/((?!_next|api|.*\\..*).*)', '/'],
};
