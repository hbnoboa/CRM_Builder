'use client';

import { useEffect, useMemo, ReactNode } from 'react';
import { ThemeProvider as NextThemeProvider } from 'next-themes';
import { useTenant } from '@/stores/tenant-context';
import { generateThemeVariables } from '@/lib/generate-theme';

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
  const { tenant, isPlatformAdmin, selectedTenantId, allTenants } = useTenant();

  // PLATFORM_ADMIN: use the selected tenant's theme; otherwise use own tenant's theme
  const effectiveTenant = useMemo(() => {
    if (isPlatformAdmin && selectedTenantId) {
      return allTenants.find((t) => t.id === selectedTenantId) || tenant;
    }
    return tenant;
  }, [isPlatformAdmin, selectedTenantId, allTenants, tenant]);

  const brandColor = (effectiveTenant?.settings as Record<string, any>)?.theme?.brandColor as string | undefined;
  const tenantDarkMode = (effectiveTenant?.settings as Record<string, any>)?.theme?.darkMode as string | undefined;

  useEffect(() => {
    if (!brandColor) {
      removeThemeFromDOM();
      return;
    }

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
