'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTenant } from '@/stores/tenant-context';
import { DEFAULT_BRAND_COLOR } from '@/lib/generate-theme';
import { isIos, isStandalone, usePwaInstallStore, type BeforeInstallPromptEvent } from '@/stores/pwa-install-store';

type AppSettings = { app?: { enabled?: boolean; shortName?: string }; theme?: { brandColor?: string } };

/** Pequeno hash so para o navegador buscar o icone de novo quando a marca muda. */
function brandVersion(parts: string[]): string {
  let h = 0;
  for (const ch of parts.join('|')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Aplicativo instalavel (PWA) da empresa. Com "Permitir instalar como aplicativo" ligado:
 * poe o manifesto e as marcas do iPhone na pagina, registra o service worker e guarda o
 * convite de instalacao do navegador (o menu do usuario oferece "Instalar aplicativo").
 */
export function AppInstall() {
  const { tenant } = useTenant();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || 'pt-BR';
  const settings = (tenant?.settings ?? {}) as AppSettings;
  const enabled = settings.app?.enabled === true;
  const { setEnabled, setDeferredPrompt, setInstalled } = usePwaInstallStore();

  useEffect(() => {
    setEnabled(enabled);
    setInstalled(isStandalone());
  }, [enabled, setEnabled, setInstalled]);

  // Convite de instalacao (Chrome/Edge/Android): o navegador manda uma vez; guardamos
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [setDeferredPrompt, setInstalled]);

  // Manifesto, icone e cor no <head> (so com a opcao ligada)
  useEffect(() => {
    if (!enabled || !tenant) return;
    const base = `/${locale}/${tenant.slug}`;
    const color = settings.theme?.brandColor || DEFAULT_BRAND_COLOR;
    const title = settings.app?.shortName || tenant.name;
    const v = brandVersion([tenant.name, title, tenant.logo || '', color]);
    const tags: HTMLElement[] = [];
    const add = (tag: 'link' | 'meta', attrs: Record<string, string>) => {
      const el = document.createElement(tag);
      for (const [k, value] of Object.entries(attrs)) el.setAttribute(k, value);
      el.setAttribute('data-app-install', '');
      document.head.appendChild(el);
      tags.push(el);
    };
    add('link', { rel: 'manifest', href: `${base}/app.webmanifest` });
    add('link', { rel: 'apple-touch-icon', href: `${base}/app-icon/180.png?v=${v}` });
    add('meta', { name: 'theme-color', content: color });
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'apple-mobile-web-app-title', content: title });
    add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' });
    return () => tags.forEach((el) => el.remove());
  }, [enabled, tenant, locale, settings.theme?.brandColor, settings.app?.shortName]);

  // Service worker: abrir rapido e tela amigavel sem internet
  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* sem SW o sistema segue normal */ });
  }, [enabled]);

  return null;
}

/** Abre o convite do navegador ou, sem ele (iPhone, Safari...), o passo a passo. */
export function useInstallApp() {
  const { enabled, deferredPrompt, installed, setDeferredPrompt } = usePwaInstallStore();
  const [helpOpen, setHelpOpen] = useState(false);
  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => undefined);
      setDeferredPrompt(null);
      return;
    }
    setHelpOpen(true);
  };
  return { available: enabled && !installed, install, helpOpen, setHelpOpen };
}

/** Passo a passo de instalacao para quem nao tem o convite do navegador. */
export function InstallAppHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('appInstall');
  const ios = isIos();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="install-app-help">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          {ios ? (
            <>
              <li className="flex items-start gap-2"><Share className="mt-0.5 h-4 w-4 shrink-0" />{t('ios.step1')}</li>
              <li className="flex items-start gap-2"><SquarePlus className="mt-0.5 h-4 w-4 shrink-0" />{t('ios.step2')}</li>
              <li className="text-xs text-muted-foreground">{t('ios.note')}</li>
            </>
          ) : (
            <>
              <li className="flex items-start gap-2"><EllipsisVertical className="mt-0.5 h-4 w-4 shrink-0" />{t('other.step1')}</li>
              <li className="text-xs text-muted-foreground">{t('other.note')}</li>
            </>
          )}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
