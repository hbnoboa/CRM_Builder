'use client';

import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { usePathname } from '@/i18n/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { locales, localeNames, type Locale } from '@/i18n/config';

// Codigo curto do idioma (PT/EN/ES). Antes usavamos emoji de bandeira, mas
// bandeira nao renderiza em varios aparelhos (vira quadradinho) e bandeira nao e
// idioma; o globo + codigo aparece igual em qualquer celular.
const localeShort: Record<Locale, string> = {
  'pt-BR': 'PT',
  'en': 'EN',
  'es': 'ES',
};

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname(); // Returns path WITHOUT locale prefix

  const handleLocaleChange = (newLocale: Locale) => {
    // Full page reload to re-render layout with new locale messages
    window.location.href = `/${newLocale}${pathname}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title={localeNames[currentLocale]} aria-label={localeNames[currentLocale]}>
          <Globe className="h-4 w-4" />
          <span className="sr-only">{localeShort[currentLocale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={currentLocale === loc ? 'bg-accent' : ''}
          >
            <span className="mr-2 inline-flex h-5 w-7 shrink-0 items-center justify-center rounded border text-[11px] font-semibold text-muted-foreground">
              {localeShort[loc]}
            </span>
            {localeNames[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
