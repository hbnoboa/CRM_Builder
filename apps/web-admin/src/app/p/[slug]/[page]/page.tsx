import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from '@/i18n/config';

/** Endereco curto das paginas para clientes: /p/<empresa>/<pagina>[?c=link] -> com idioma. */
export default function SitePageRedirect({ params, searchParams }: { params: { slug: string; page: string }; searchParams: { c?: string } }) {
  const savedLocale = cookies().get('NEXT_LOCALE')?.value as Locale | undefined;
  const locale = savedLocale && locales.includes(savedLocale) ? savedLocale : defaultLocale;
  const token = typeof searchParams.c === 'string' ? `?c=${encodeURIComponent(searchParams.c)}` : '';
  redirect(`/${locale}/p/${encodeURIComponent(params.slug)}/${encodeURIComponent(params.page)}${token}`);
}
