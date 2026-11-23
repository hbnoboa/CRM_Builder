import { NextResponse } from 'next/server';
import { locales } from '@/i18n/config';
import { DEFAULT_BRAND_COLOR } from '@/lib/generate-theme';
import { fetchTenantApp } from '@/lib/tenant-app';

export const dynamic = 'force-dynamic';

/** Manifesto do aplicativo instalavel (PWA) da empresa: nome, icone e cor dela. */
export async function GET(_request: Request, { params }: { params: { locale: string; tenant: string } }) {
  if (!(locales as readonly string[]).includes(params.locale)) return new NextResponse(null, { status: 404 });
  const info = await fetchTenantApp(params.tenant);
  if (!info) return new NextResponse(null, { status: 404 });

  const base = `/${params.locale}/${info.slug}`;
  const icon = (size: number, purpose: 'any' | 'maskable') => ({
    src: `${base}/app-icon/${size}.png?v=${info.version}${purpose === 'maskable' ? '&maskable=1' : ''}`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose,
  });

  const manifest = {
    id: `${base}/`,
    name: info.name,
    short_name: info.shortName,
    lang: params.locale,
    start_url: `${base}/home`,
    // Escopo amplo: login e telas de conta ficam dentro do aplicativo (sem barra do navegador)
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: info.brandColor || DEFAULT_BRAND_COLOR,
    icons: [icon(192, 'any'), icon(512, 'any'), icon(512, 'maskable')],
  };
  return new NextResponse(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
