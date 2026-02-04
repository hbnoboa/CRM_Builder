import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from '@/i18n/config';

export default function ApisRedirect() {
  const cookieStore = cookies();
  const savedLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;
  const locale = savedLocale && locales.includes(savedLocale) ? savedLocale : defaultLocale;
  
  redirect(`/${locale}/apis`);
}
