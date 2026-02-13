'use client';

import { useLocale } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { locales, localeNames, type Locale } from '@/i18n/config';

const localeFlags: Record<Locale, string> = {
  'pt-BR': '🇧🇷',
  'en': '🇺🇸',
  'es': '🇲🇽',
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
        <Button variant="ghost" size="icon" title={localeNames[currentLocale]}>
          {localeFlags[currentLocale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={currentLocale === loc ? 'bg-accent' : ''}
          >
            <span className="text-lg mr-2">{localeFlags[loc]}</span>
            {localeNames[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
