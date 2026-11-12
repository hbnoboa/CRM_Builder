'use client';

import { useEffect, ReactNode } from 'react';
import { ThemeProvider as NextThemeProvider } from 'next-themes';
import { useTenant } from '@/stores/tenant-context';
import { DEFAULT_BRAND_COLOR, generateThemeVariables } from '@/lib/generate-theme';

const THEME_STYLE_ID = 'tenant-theme';

function applyThemeToDOM(theme: ReturnType<typeof generateThemeVariables>) {
  let styleEl = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const lightRules = Object.entries(theme.light)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n');

  const darkRules = Object.entries(theme.dark)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n');

  styleEl.textContent = `:root {\n${lightRules}\n}\n.dark {\n${darkRules}\n}`;
}

function removeThemeFromDOM() {
  const styleEl = document.getElementById(THEME_STYLE_ID);
  if (styleEl) styleEl.remove();
}

interface TenantThemeProviderProps {
  children: ReactNode;
}

export function TenantThemeProvider({ children }: TenantThemeProviderProps) {
  const { tenant } = useTenant();

  // Tema do tenant atual (GET /tenants/me)
  const effectiveTenant = tenant;

  // Empresa sem cor definida usa a cor do produto (nada de sistema todo preto e cinza)
  const brandColor = ((effectiveTenant?.settings as Record<string, any>)?.theme?.brandColor as string | undefined) || DEFAULT_BRAND_COLOR;
  const tenantDarkMode = (effectiveTenant?.settings as Record<string, any>)?.theme?.darkMode as string | undefined;

  useEffect(() => {
    try {
      const theme = generateThemeVariables(brandColor);
      applyThemeToDOM(theme);
    } catch (err) {
      console.warn('Failed to generate tenant theme:', err);
      removeThemeFromDOM();
    }

    return () => {
      removeThemeFromDOM();
    };
  }, [brandColor]);

  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme={tenantDarkMode || 'system'}
      enableSystem
    >
      {children}
    </NextThemeProvider>
  );
}
