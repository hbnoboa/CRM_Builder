/**
 * Elementos a mais das paginas para clientes: video, mapa, perguntas frequentes,
 * icones com texto, redes sociais, espaco, numeros, precos, depoimentos e logos.
 * Mesmo principio dos outros blocos: so o que esta nas listas e links seguros.
 */

export const EXTRA_BLOCK_TYPES = [
  'video', 'map', 'faq', 'icons', 'social', 'spacer', 'stats', 'pricing', 'testimonials', 'logos',
] as const;

/** Icones que a pagina pode mostrar (nomes do lucide). Mesma lista do web (lib/site-icons.ts). */
export const SITE_ICONS = [
  'star', 'heart', 'phone', 'mail', 'map-pin', 'clock', 'check', 'shield-check', 'truck', 'coffee', 'cake', 'gift',
  'sparkles', 'smile', 'users', 'user', 'calendar', 'camera', 'music', 'house', 'car', 'wrench', 'leaf', 'sun', 'moon',
  'zap', 'award', 'thumbs-up', 'shopping-bag', 'credit-card', 'wifi', 'paw-print', 'scissors', 'stethoscope',
  'graduation-cap', 'briefcase', 'globe', 'message-circle', 'utensils', 'baby', 'dumbbell', 'palette', 'plane',
  'package', 'headphones', 'lightbulb', 'target', 'trending-up', 'lock', 'rocket', 'flower-2', 'bike', 'pizza',
  'ice-cream-cone', 'wine', 'sofa', 'hammer', 'brush',
] as const;

export const SOCIAL_NETWORKS = ['instagram', 'facebook', 'whatsapp', 'tiktok', 'youtube', 'linkedin', 'x', 'email', 'phone', 'site'] as const;

export interface VideoBlock { id: string; type: 'video'; url: string; caption?: string }
export interface MapBlock { id: string; type: 'map'; address: string; zoom: number; height: number }
export interface FaqBlock { id: string; type: 'faq'; title?: string; items: Array<{ q: string; a: string }> }
export interface IconsBlock {
  id: string; type: 'icons'; title?: string; columns: 1 | 2 | 3 | 4; layout: 'top' | 'side';
  items: Array<{ icon: string; title: string; text?: string }>;
}
export interface SocialBlock { id: string; type: 'social'; style: 'icons' | 'labels'; links: Array<{ network: string; url: string }> }
export interface SpacerBlock { id: string; type: 'spacer'; height: number }
export interface StatsBlock { id: string; type: 'stats'; items: Array<{ value: string; label: string }> }
export interface PricingBlock {
  id: string; type: 'pricing'; title?: string;
  plans: Array<{ name: string; price: string; period?: string; features: string[]; buttonLabel?: string; buttonUrl?: string; highlight?: boolean }>;
}
export interface TestimonialsBlock { id: string; type: 'testimonials'; title?: string; items: Array<{ text: string; author: string; role?: string; photo?: string }> }
export interface LogosBlock { id: string; type: 'logos'; title?: string; gray: boolean; images: Array<{ url: string; alt?: string }> }

export type ExtraBlock =
  | VideoBlock | MapBlock | FaqBlock | IconsBlock | SocialBlock | SpacerBlock | StatsBlock | PricingBlock | TestimonialsBlock | LogosBlock;

type Tools = { clip: (s: unknown, max: number) => string; safeUrl: (u: unknown) => string };

const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []).map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}));
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const opt = <K extends string, V>(key: K, v: V | '' | undefined) => (v ? ({ [key]: v } as Record<K, V>) : {});

/** Video aceito: YouTube, Vimeo ou arquivo de video (mp4/webm). */
export function videoUrl(raw: unknown, safeUrl: Tools['safeUrl']): string {
  const url = safeUrl(raw);
  if (!/^https?:\/\//i.test(url)) return '';
  if (/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(url)) return url;
  if (/^https?:\/\/(www\.|player\.)?vimeo\.com\//i.test(url)) return url;
  return /\.(mp4|webm)(\?|#|$)/i.test(url) || url.includes('storage.googleapis.com') ? url : '';
}

export function normalizeExtraBlock(type: string, b: Record<string, unknown>, id: string, { clip, safeUrl }: Tools): ExtraBlock | null {
  switch (type) {
    case 'video': {
      const url = videoUrl(b.url, safeUrl);
      return { id, type, url, ...opt('caption', clip(b.caption, 160)) };
    }
    case 'map':
      return { id, type, address: clip(b.address, 200), zoom: int(b.zoom, 3, 20, 15), height: int(b.height, 160, 800, 320) };
    case 'faq': {
      const items = arr(b.items, 30).map((i) => ({ q: clip(i.q, 200), a: clip(i.a, 2000) })).filter((i) => i.q);
      return { id, type, items, ...opt('title', clip(b.title, 120)) };
    }
    case 'icons': {
      const items = arr(b.items, 16).map((i) => {
        const title = clip(i.title, 80);
        if (!title) return null;
        const icon = (SITE_ICONS as readonly string[]).includes(String(i.icon)) ? String(i.icon) : 'star';
        return { icon, title, ...opt('text', clip(i.text, 300)) };
      }).filter((i): i is { icon: string; title: string; text?: string } => !!i);
      const columns = [1, 2, 3, 4].includes(Number(b.columns)) ? (Number(b.columns) as 1 | 2 | 3 | 4) : 3;
      return { id, type, columns, layout: b.layout === 'side' ? 'side' : 'top', items, ...opt('title', clip(b.title, 120)) };
    }
    case 'social': {
      const links = arr(b.links, 12).map((l) => {
        const network = (SOCIAL_NETWORKS as readonly string[]).includes(String(l.network)) ? String(l.network) : '';
        const raw = clip(l.url, 300);
        if (!network || !raw) return null;
        // E-mail e telefone viram mailto:/tel:; o resto precisa ser link seguro
        const url = network === 'email' ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? `mailto:${raw}` : safeUrl(raw))
          : network === 'phone' ? `tel:${raw.replace(/[^\d+]/g, '')}`
          : network === 'whatsapp' && /^[\d\s()+-]+$/.test(raw) ? `https://wa.me/${raw.replace(/\D/g, '')}`
          : safeUrl(/^[a-z]+:/i.test(raw) || raw.startsWith('/') ? raw : `https://${raw}`);
        return url ? { network, url } : null;
      }).filter((l): l is { network: string; url: string } => !!l);
      return { id, type, style: b.style === 'labels' ? 'labels' : 'icons', links };
    }
    case 'spacer':
      return { id, type, height: int(b.height, 8, 400, 48) };
    case 'stats': {
      const items = arr(b.items, 8).map((i) => ({ value: clip(i.value, 20), label: clip(i.label, 80) })).filter((i) => i.value);
      return { id, type, items };
    }
    case 'pricing': {
      const plans = arr(b.plans, 6).map((p) => {
        const name = clip(p.name, 60);
        if (!name) return null;
        const features = (Array.isArray(p.features) ? p.features : String(p.features ?? '').split('\n'))
          .slice(0, 15).map((f) => clip(f, 120)).filter(Boolean);
        const buttonUrl = safeUrl(p.buttonUrl);
        const buttonLabel = clip(p.buttonLabel, 40);
        return {
          name, price: clip(p.price, 30), features, ...opt('period', clip(p.period, 30)),
          ...(buttonLabel && buttonUrl ? { buttonLabel, buttonUrl } : {}), ...(p.highlight === true ? { highlight: true } : {}),
        };
      }).filter((p): p is PricingBlock['plans'][number] => !!p);
      return { id, type, plans, ...opt('title', clip(b.title, 120)) };
    }
    case 'testimonials': {
      const items = arr(b.items, 12).map((i) => {
        const text = clip(i.text, 600);
        if (!text) return null;
        return { text, author: clip(i.author, 80), ...opt('role', clip(i.role, 80)), ...opt('photo', safeUrl(i.photo)) };
      }).filter((i): i is TestimonialsBlock['items'][number] => !!i);
      return { id, type, items, ...opt('title', clip(b.title, 120)) };
    }
    case 'logos': {
      const images = arr(b.images, 24).map((i) => {
        const url = safeUrl(i.url);
        return url ? { url, ...opt('alt', clip(i.alt, 80)) } : null;
      }).filter((i): i is { url: string; alt?: string } => !!i);
      return { id, type, gray: b.gray !== false, images, ...opt('title', clip(b.title, 120)) };
    }
    default:
      return null;
  }
}

/** O que falta para o elemento aparecer na pagina publicada (rascunho). */
export function missingExtra(b: ExtraBlock): string | null {
  switch (b.type) {
    case 'video': return b.url ? null : 'o link do vídeo';
    case 'map': return b.address ? null : 'o endereço';
    case 'faq': return b.items.length ? null : 'as perguntas';
    case 'icons': return b.items.length ? null : 'os itens';
    case 'social': return b.links.length ? null : 'os links';
    case 'stats': return b.items.length ? null : 'os números';
    case 'pricing': return b.plans.length ? null : 'os planos';
    case 'testimonials': return b.items.length ? null : 'os depoimentos';
    case 'logos': return b.images.length ? null : 'as imagens';
    default: return null;
  }
}
