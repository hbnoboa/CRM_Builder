export const locales = ['pt-BR', 'en', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt-BR';

export const localeNames: Record<Locale, string> = {
  'pt-BR': 'Portugues (Brasil)',
  'en': 'English',
  'es': 'Espanol',
};

export const localeFlags: Record<Locale, string> = {
  'pt-BR': 'BR',
  'en': 'US',
  'es': 'ES',
};
