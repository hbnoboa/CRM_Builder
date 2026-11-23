import { ImageResponse } from 'next/og';
import { DEFAULT_BRAND_COLOR } from '@/lib/generate-theme';
import { fetchTenantApp, fetchTenantAppLogo } from '@/lib/tenant-app';

export const dynamic = 'force-dynamic';

const SIZES = new Set([180, 192, 512]);

/** Iniciais do nome da empresa (ate 2), para quem nao tem logo. */
function initials(name: string): string {
  const words = name.split(/\s+/).map((w) => w.replace(/[^0-9A-Za-zÀ-ÿ]/g, '')).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
}

/** Cor clara pede texto escuro (iniciais legiveis em qualquer cor de marca). */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 165;
}

/**
 * Icone do aplicativo: fundo na cor da marca com o logo numa placa branca (ou as
 * iniciais). `maskable=1`: conteudo dentro da zona segura (o Android recorta em circulo).
 */
export async function GET(request: Request, { params }: { params: { tenant: string; file: string } }) {
  const size = Number(params.file.replace(/\.png$/, ''));
  if (!SIZES.has(size)) return new Response(null, { status: 404 });
  const info = await fetchTenantApp(params.tenant);
  if (!info) return new Response(null, { status: 404 });

  const maskable = new URL(request.url).searchParams.get('maskable') === '1';
  const color = info.brandColor || DEFAULT_BRAND_COLOR;
  const logo = info.hasLogo ? await fetchTenantAppLogo(info.slug) : null;
  const plate = Math.round(size * (maskable ? 0.6 : 0.76));
  const logoSrc = logo ? `data:image/png;base64,${Buffer.from(logo).toString('base64')}` : null;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color }}>
        {logoSrc ? (
          <div
            style={{
              width: plate, height: plate, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#ffffff', borderRadius: Math.round(plate * 0.22),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" style={{ width: Math.round(plate * 0.8), height: Math.round(plate * 0.8), objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', color: isLight(color) ? '#111827' : '#ffffff', fontSize: Math.round(size * (maskable ? 0.32 : 0.42)), fontWeight: 700 }}>
            {initials(info.name)}
          </div>
        )}
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
