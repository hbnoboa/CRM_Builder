'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { locales, localeNames, type Locale } from '@/i18n/config';

// Funcao para salvar locale no cookie
function setLocaleCookie(locale: string) {
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365}`;
}

export function LanguageSwitcher() {
  const currentLocale = useLocale();
  const pathname = usePathname();

  const handleLocaleChange = (newLocale: Locale) => {
    // Salva no cookie antes de navegar
    setLocaleCookie(newLocale);
    
    // Remove o locale atual do path e adiciona o novo
    // pathname vem como /pt-BR/dashboard, /en/users, etc.
    const segments = pathname.split('/');
    
    // Verifica se o primeiro segmento e um locale valido
    if (segments.length > 1 && locales.includes(segments[1] as Locale)) {
      segments[1] = newLocale;
    } else {
      // Se nao tem locale, adiciona no inicio
      segments.splice(1, 0, newLocale);
    }
    
    const newPath = segments.join('/') || `/${newLocale}`;
    
    // Usa window.location para navegacao completa (evita bugs do router)
    window.location.href = newPath;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title={localeNames[currentLocale as Locale]}>
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={currentLocale === loc ? 'bg-accent' : ''}
          >
            {localeNames[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
