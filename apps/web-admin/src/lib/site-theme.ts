import type { CSSProperties } from 'react';
import { SITE_API_URL, type SiteAppearance, type SiteTextStyle, type SiteTheme } from '@/lib/site-api';

/**
 * Tema das paginas para clientes: fontes guardadas no nosso servidor, temas
 * prontos (ponto de partida, tudo editavel) e a conversao do tema em variaveis
 * CSS que a pagina usa (site-theme.css). Mesmas listas do servidor (site-theme.ts).
 */

export type FontKind = 'sans' | 'serif' | 'display' | 'script' | 'mono';
export const FONT_KINDS: Array<{ kind: FontKind; label: string }> = [
  { kind: 'sans', label: 'Modernas' }, { kind: 'serif', label: 'Clássicas (com serifa)' },
  { kind: 'display', label: 'De impacto' }, { kind: 'script', label: 'Manuscritas' }, { kind: 'mono', label: 'Máquina de escrever' },
];
const FALLBACK: Record<FontKind, string> = {
  sans: 'system-ui, sans-serif', serif: 'Georgia, serif', display: 'Impact, sans-serif', script: 'cursive', mono: 'monospace',
};

export const SITE_FONTS: Array<{ id: string; name: string; kind: FontKind }> = [
  { id: 'inter', name: 'Inter', kind: 'sans' }, { id: 'roboto', name: 'Roboto', kind: 'sans' },
  { id: 'open-sans', name: 'Open Sans', kind: 'sans' }, { id: 'montserrat', name: 'Montserrat', kind: 'sans' },
  { id: 'poppins', name: 'Poppins', kind: 'sans' }, { id: 'lato', name: 'Lato', kind: 'sans' },
  { id: 'nunito', name: 'Nunito', kind: 'sans' }, { id: 'raleway', name: 'Raleway', kind: 'sans' },
  { id: 'work-sans', name: 'Work Sans', kind: 'sans' }, { id: 'dm-sans', name: 'DM Sans', kind: 'sans' },
  { id: 'outfit', name: 'Outfit', kind: 'sans' }, { id: 'rubik', name: 'Rubik', kind: 'sans' },
  { id: 'playfair-display', name: 'Playfair Display', kind: 'serif' }, { id: 'merriweather', name: 'Merriweather', kind: 'serif' },
  { id: 'lora', name: 'Lora', kind: 'serif' }, { id: 'cormorant-garamond', name: 'Cormorant Garamond', kind: 'serif' },
  { id: 'libre-baskerville', name: 'Libre Baskerville', kind: 'serif' }, { id: 'eb-garamond', name: 'EB Garamond', kind: 'serif' },
  { id: 'dm-serif-display', name: 'DM Serif Display', kind: 'serif' },
  { id: 'bebas-neue', name: 'Bebas Neue', kind: 'display' }, { id: 'oswald', name: 'Oswald', kind: 'display' },
  { id: 'abril-fatface', name: 'Abril Fatface', kind: 'display' }, { id: 'righteous', name: 'Righteous', kind: 'display' },
  { id: 'fredoka', name: 'Fredoka', kind: 'display' },
  { id: 'dancing-script', name: 'Dancing Script', kind: 'script' }, { id: 'pacifico', name: 'Pacifico', kind: 'script' },
  { id: 'caveat', name: 'Caveat', kind: 'script' }, { id: 'great-vibes', name: 'Great Vibes', kind: 'script' },
  { id: 'satisfy', name: 'Satisfy', kind: 'script' },
  { id: 'space-mono', name: 'Space Mono', kind: 'mono' },
];

export type SiteCustomFont = { id: string; name: string };

/** CSS font-family de uma fonte da lista ou enviada ("custom:<id>"). */
export function fontStack(ref: string | undefined, custom: SiteCustomFont[] = []): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith('custom:')) {
    const f = custom.find((c) => `custom:${c.id}` === ref);
    return f ? `'site-font-${f.id}', ${FALLBACK.sans}` : undefined;
  }
  const f = SITE_FONTS.find((x) => x.id === ref);
  return f ? `'${f.name}', ${FALLBACK[f.kind]}` : undefined;
}

export function fontName(ref: string | undefined, custom: SiteCustomFont[] = []): string {
  if (!ref) return '';
  if (ref.startsWith('custom:')) return custom.find((c) => `custom:${c.id}` === ref)?.name ?? 'Fonte enviada';
  return SITE_FONTS.find((x) => x.id === ref)?.name ?? ref;
}

/** @font-face das fontes enviadas pela empresa (arquivos servidos pela API). */
export function customFontCss(custom: SiteCustomFont[]): string {
  return custom.map((f) => `@font-face{font-family:'site-font-${f.id}';src:url(${SITE_API_URL}/site/fonts/${f.id});font-display:swap}`).join('\n');
}

// ── Cores ────────────────────────────────────────────────────────────────

const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
/** Mistura duas cores (pct da primeira). */
export function mix(a: string, b: string, pct: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex(x.map((v, i) => v * (pct / 100) + y[i] * (1 - pct / 100)));
}
const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Branco ou quase preto, o que ler melhor sobre a cor. */
export const readableOn = (hex: string) => (luminance(hex) > 0.45 ? '#111827' : '#ffffff');
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// ── Tema resolvido ───────────────────────────────────────────────────────

export interface ResolvedTextStyle { font: string; size: number; bold: boolean; italic: boolean; upper: boolean; color?: string; spacing: number; line: number }
export interface ResolvedTheme {
  decor: 'classic' | 'scrapbook';
  pattern: SiteAppearance['background'];
  colors: { bg: string; surface: string; text: string; muted: string; accent: string; accent2: string };
  fonts: { heading: string; body: string };
  text: Record<'h1' | 'h2' | 'h3' | 'body', ResolvedTextStyle>;
  buttons: { shape: 'square' | 'rounded' | 'pill'; fill: 'solid' | 'outline' | 'soft' | 'shadow' };
  radius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  shadow: 'none' | 'soft' | 'strong';
  spacing: 'compact' | 'normal' | 'airy';
  bgImage?: string;
  bgVideo?: string;
  bgDim: number;
  animation: 'none' | 'fade' | 'rise' | 'zoom' | 'slide';
}

const TS = (font: string, size: number, extra: Partial<ResolvedTextStyle> = {}): ResolvedTextStyle =>
  ({ font, size, bold: true, italic: false, upper: false, spacing: 0, line: 120, ...extra });

/** Padrao de cada estilo antigo (pagina sem tema escolhido fica como era). */
function baseTheme(decor: 'classic' | 'scrapbook', accent: string): Omit<ResolvedTheme, 'pattern' | 'animation'> {
  if (decor === 'scrapbook') {
    return {
      decor,
      colors: { bg: mix(accent, '#ffffff', 9), surface: '#ffffff', text: '#1e293b', muted: '#64748b', accent, accent2: mix(accent, '#ffffff', 45) },
      fonts: { heading: 'dancing-script', body: 'lora' },
      text: {
        h1: TS('dancing-script', 56, { bold: false, color: accent, line: 110 }),
        h2: TS('dancing-script', 44, { bold: false, color: accent, line: 110 }),
        h3: TS('lora', 22, { italic: true }),
        body: TS('lora', 17, { bold: false, line: 170 }),
      },
      buttons: { shape: 'pill', fill: 'shadow' }, radius: 'xl', shadow: 'soft', spacing: 'airy', bgDim: 0,
    };
  }
  return {
    decor,
    colors: { bg: '#f8fafc', surface: '#ffffff', text: '#0f172a', muted: '#64748b', accent, accent2: mix(accent, '#0f172a', 60) },
    fonts: { heading: 'inter', body: 'inter' },
    text: {
      h1: TS('inter', 32, { line: 115 }), h2: TS('inter', 24), h3: TS('inter', 19),
      body: TS('inter', 15, { bold: false, line: 165 }),
    },
    buttons: { shape: 'rounded', fill: 'solid' }, radius: 'lg', shadow: 'soft', spacing: 'normal', bgDim: 0,
  };
}

/** Aparencia da pagina (estilo antigo + tema) com tudo preenchido. */
export function resolveTheme(look: SiteAppearance | undefined, brand: string): ResolvedTheme {
  const accent = look?.accent || brand;
  const decor = look?.style === 'scrapbook' ? 'scrapbook' : 'classic';
  const base = baseTheme(decor, accent);
  const t: SiteTheme = look?.theme ?? {};
  const fonts = { heading: t.fonts?.heading ?? base.fonts.heading, body: t.fonts?.body ?? base.fonts.body };
  const style = (key: 'h1' | 'h2' | 'h3' | 'body'): ResolvedTextStyle => {
    const b = base.text[key];
    // Fonte do estilo: a escolhida nele, senao a do titulo/texto do tema
    const fontFromTheme = key === 'body' ? (t.fonts?.body ? fonts.body : undefined) : (t.fonts?.heading ? fonts.heading : undefined);
    const own: SiteTextStyle = t.text?.[key] ?? {};
    return {
      font: own.font ?? fontFromTheme ?? b.font,
      size: own.size ?? b.size,
      bold: own.bold ?? b.bold,
      italic: own.italic ?? b.italic,
      upper: own.upper ?? b.upper,
      // Cor do estilo antigo (scrapbook: titulo na cor de destaque) so sem cor de texto escolhida
      color: own.color ?? (t.colors?.text ? undefined : b.color),
      spacing: own.spacing ?? b.spacing,
      line: own.line ?? b.line,
    };
  };
  return {
    decor,
    pattern: look?.background ?? (decor === 'scrapbook' ? 'dots' : 'plain'),
    colors: {
      bg: isHex(t.colors?.bg) ? t.colors.bg : base.colors.bg,
      surface: isHex(t.colors?.surface) ? t.colors.surface : base.colors.surface,
      text: isHex(t.colors?.text) ? t.colors.text : base.colors.text,
      muted: isHex(t.colors?.muted) ? t.colors.muted : base.colors.muted,
      accent,
      accent2: isHex(t.colors?.accent2) ? t.colors.accent2 : base.colors.accent2,
    },
    fonts,
    text: { h1: style('h1'), h2: style('h2'), h3: style('h3'), body: style('body') },
    buttons: { shape: t.buttons?.shape ?? base.buttons.shape, fill: t.buttons?.fill ?? base.buttons.fill },
    radius: t.radius ?? base.radius,
    shadow: t.shadow ?? base.shadow,
    spacing: t.spacing ?? base.spacing,
    bgImage: t.bgImage,
    bgVideo: t.bgVideo,
    bgDim: t.bgDim ?? 0,
    animation: t.animation ?? 'none',
  };
}

const RADIUS = { none: '0px', sm: '6px', md: '12px', lg: '18px', xl: '30px' };
const BTN_RADIUS = { square: '2px', rounded: '10px', pill: '999px' };
const SPACE = { compact: '0.6', normal: '1', airy: '1.45' };

/** Variaveis CSS do tema (usadas em site-theme.css). */
export function themeVars(th: ResolvedTheme, custom: SiteCustomFont[]): CSSProperties {
  const c = th.colors;
  const darkText = luminance(c.text) < luminance(c.bg);
  const vars: Record<string, string> = {
    '--site-bg': c.bg,
    '--site-surface': c.surface,
    '--site-text': c.text,
    '--site-text-2': mix(c.text, c.bg, 82),
    '--site-muted': c.muted,
    '--site-line': mix(c.text, c.bg, 14),
    '--site-accent': c.accent,
    '--site-brand': c.accent,
    '--site-on-accent': readableOn(c.accent),
    '--site-accent-2': c.accent2,
    '--site-on-accent-2': readableOn(c.accent2),
    // Cores originais: as secoes coloridas trocam --site-accent por dentro e precisam delas
    '--site-accent-base': c.accent,
    '--site-on-accent-base': readableOn(c.accent),
    '--site-accent-2-base': c.accent2,
    '--site-on-accent-2-base': readableOn(c.accent2),
    '--site-dark': darkText ? c.text : mix(c.bg, '#000000', 70),
    '--site-font-heading': fontStack(th.fonts.heading, custom) ?? FALLBACK.sans,
    '--site-font-body': fontStack(th.fonts.body, custom) ?? FALLBACK.sans,
    '--site-radius': RADIUS[th.radius],
    '--site-btn-radius': BTN_RADIUS[th.buttons.shape],
    '--site-space': SPACE[th.spacing],
  };
  for (const key of ['h1', 'h2', 'h3', 'body'] as const) {
    const s = th.text[key];
    const stack = fontStack(s.font, custom);
    if (stack) vars[`--ts-${key}-font`] = stack;
    vars[`--ts-${key}-size`] = `${s.size}px`;
    vars[`--ts-${key}-weight`] = s.bold ? '700' : '400';
    vars[`--ts-${key}-style`] = s.italic ? 'italic' : 'normal';
    vars[`--ts-${key}-transform`] = s.upper ? 'uppercase' : 'none';
    vars[`--ts-${key}-ls`] = `${s.spacing / 100}em`;
    vars[`--ts-${key}-lh`] = `${s.line / 100}`;
    if (s.color) vars[`--ts-${key}-color`] = s.color;
  }
  return vars as CSSProperties;
}

// ── Temas prontos ────────────────────────────────────────────────────────

export interface ThemePreset {
  id: string;
  name: string;
  hint: string;
  style: 'classic' | 'scrapbook';
  background: SiteAppearance['background'];
  /** Sem cor: usa a cor da empresa. */
  accent?: string;
  theme: SiteTheme;
}

const preset = (p: ThemePreset): ThemePreset => ({ ...p, theme: { ...p.theme, preset: p.id } });

export const THEME_PRESETS: ThemePreset[] = [
  preset({ id: 'classico', name: 'Clássico', hint: 'Limpo, com a cor da empresa', style: 'classic', background: 'plain', theme: {} }),
  preset({
    id: 'scrapbook', name: 'Scrapbook', hint: 'Fofo, polaroides e letra à mão', style: 'scrapbook', background: 'dots', theme: {},
  }),
  preset({
    id: 'minimalista', name: 'Minimalista', hint: 'Preto e branco, muito espaço', style: 'classic', background: 'plain', accent: '#111111',
    theme: {
      colors: { bg: '#ffffff', surface: '#ffffff', text: '#111111', muted: '#6b7280', accent2: '#e5e7eb' },
      fonts: { heading: 'dm-sans', body: 'dm-sans' }, text: { h1: { size: 44 }, h2: { size: 30 } },
      buttons: { shape: 'square', fill: 'outline' }, radius: 'none', shadow: 'none', spacing: 'airy',
    },
  }),
  preset({
    id: 'elegante', name: 'Elegante', hint: 'Creme, dourado e serifa fina', style: 'classic', background: 'plain', accent: '#a8834a',
    theme: {
      colors: { bg: '#faf7f2', surface: '#ffffff', text: '#2b2622', muted: '#7d7268', accent2: '#e9dfcf' },
      fonts: { heading: 'cormorant-garamond', body: 'lora' },
      text: { h1: { size: 52, bold: false }, h2: { size: 38, bold: false }, h3: { size: 22, upper: true, spacing: 12 } },
      buttons: { shape: 'square', fill: 'outline' }, radius: 'sm', shadow: 'none', spacing: 'airy',
    },
  }),
  preset({
    id: 'escuro', name: 'Escuro moderno', hint: 'Fundo escuro e roxo vibrante', style: 'classic', background: 'plain', accent: '#8b5cf6',
    theme: {
      colors: { bg: '#0b0f19', surface: '#151b2b', text: '#e5e7eb', muted: '#94a3b8', accent2: '#22d3ee' },
      fonts: { heading: 'outfit', body: 'inter' }, text: { h1: { size: 44 } },
      buttons: { shape: 'pill', fill: 'solid' }, radius: 'lg', shadow: 'strong', spacing: 'normal',
    },
  }),
  preset({
    id: 'corporativo', name: 'Corporativo', hint: 'Sério e organizado, azul', style: 'classic', background: 'plain', accent: '#1d4ed8',
    theme: {
      colors: { bg: '#ffffff', surface: '#f1f5f9', text: '#0f172a', muted: '#475569', accent2: '#0f172a' },
      fonts: { heading: 'montserrat', body: 'open-sans' },
      buttons: { shape: 'rounded', fill: 'solid' }, radius: 'sm', shadow: 'soft', spacing: 'normal',
    },
  }),
  preset({
    id: 'rustico', name: 'Rústico', hint: 'Madeira, papel e serifa', style: 'classic', background: 'grid', accent: '#a0522d',
    theme: {
      colors: { bg: '#f5efe6', surface: '#fffaf3', text: '#3e2c1c', muted: '#7a6552', accent2: '#6b8e23' },
      fonts: { heading: 'playfair-display', body: 'merriweather' }, text: { h1: { size: 42 } },
      buttons: { shape: 'rounded', fill: 'solid' }, radius: 'md', shadow: 'soft', spacing: 'normal',
    },
  }),
  preset({
    id: 'boutique', name: 'Boutique', hint: 'Rosé, delicado e manuscrito', style: 'classic', background: 'plain', accent: '#c2185b',
    theme: {
      colors: { bg: '#fdf2f4', surface: '#ffffff', text: '#3b1f2b', muted: '#8a6573', accent2: '#f8bbd0' },
      fonts: { heading: 'great-vibes', body: 'raleway' }, text: { h1: { size: 60, bold: false }, h2: { size: 44, bold: false }, h3: { font: 'raleway', size: 18, upper: true, spacing: 15 } },
      buttons: { shape: 'pill', fill: 'outline' }, radius: 'xl', shadow: 'soft', spacing: 'airy',
    },
  }),
  preset({
    id: 'tecnologia', name: 'Tecnologia', hint: 'Claro, ciano e índigo', style: 'classic', background: 'grid', accent: '#0891b2',
    theme: {
      colors: { bg: '#f8fafc', surface: '#ffffff', text: '#0f172a', muted: '#64748b', accent2: '#6366f1' },
      fonts: { heading: 'rubik', body: 'inter' }, text: { h3: { font: 'space-mono', size: 16, upper: true } },
      buttons: { shape: 'rounded', fill: 'solid' }, radius: 'lg', shadow: 'soft', spacing: 'normal',
    },
  }),
  preset({
    id: 'infantil', name: 'Infantil', hint: 'Colorido, redondo e alegre', style: 'classic', background: 'stars', accent: '#ff6b6b',
    theme: {
      colors: { bg: '#fff7e6', surface: '#ffffff', text: '#3d3d3d', muted: '#7a7a7a', accent2: '#4ecdc4' },
      fonts: { heading: 'fredoka', body: 'nunito' }, text: { h1: { size: 46 } },
      buttons: { shape: 'pill', fill: 'shadow' }, radius: 'xl', shadow: 'soft', spacing: 'normal',
    },
  }),
  preset({
    id: 'impacto', name: 'Impacto', hint: 'Escuro, amarelo e letras grandes', style: 'classic', background: 'plain', accent: '#facc15',
    theme: {
      colors: { bg: '#111111', surface: '#1c1c1c', text: '#fafafa', muted: '#a3a3a3', accent2: '#ef4444' },
      fonts: { heading: 'bebas-neue', body: 'work-sans' },
      text: { h1: { size: 72, bold: false, upper: true, spacing: 2 }, h2: { size: 48, bold: false, upper: true }, h3: { size: 26, bold: false, upper: true } },
      buttons: { shape: 'square', fill: 'solid' }, radius: 'none', shadow: 'none', spacing: 'normal',
    },
  }),
  preset({
    id: 'natureza', name: 'Natureza', hint: 'Verde, calmo e acolhedor', style: 'classic', background: 'plain', accent: '#2f855a',
    theme: {
      colors: { bg: '#f3f7f2', surface: '#ffffff', text: '#1f2d24', muted: '#5f7466', accent2: '#c6a15b' },
      fonts: { heading: 'lora', body: 'nunito' }, text: { h1: { size: 40 } },
      buttons: { shape: 'rounded', fill: 'solid' }, radius: 'lg', shadow: 'soft', spacing: 'airy',
    },
  }),
  preset({
    id: 'verao', name: 'Verão', hint: 'Laranja, azul e descontraído', style: 'classic', background: 'stripes', accent: '#f97316',
    theme: {
      colors: { bg: '#fffaf0', surface: '#ffffff', text: '#1e293b', muted: '#64748b', accent2: '#0ea5e9' },
      fonts: { heading: 'pacifico', body: 'poppins' }, text: { h1: { size: 46, bold: false }, h2: { size: 34, bold: false }, h3: { font: 'poppins' } },
      buttons: { shape: 'pill', fill: 'solid' }, radius: 'xl', shadow: 'soft', spacing: 'normal',
    },
  }),
  preset({
    id: 'editorial', name: 'Editorial', hint: 'Cara de revista, vermelho', style: 'classic', background: 'plain', accent: '#dc2626',
    theme: {
      colors: { bg: '#ffffff', surface: '#f7f7f5', text: '#111111', muted: '#6b6b6b', accent2: '#111111' },
      fonts: { heading: 'dm-serif-display', body: 'libre-baskerville' },
      text: { h1: { size: 56, bold: false }, h2: { size: 38, bold: false }, body: { size: 16, line: 180 } },
      buttons: { shape: 'square', fill: 'solid' }, radius: 'none', shadow: 'none', spacing: 'airy',
    },
  }),
  preset({
    id: 'cafe', name: 'Café', hint: 'Marrom, aconchego e letra à mão', style: 'classic', background: 'plain', accent: '#6f4e37',
    theme: {
      colors: { bg: '#f6f1eb', surface: '#ffffff', text: '#2d1e16', muted: '#7b675a', accent2: '#c08552' },
      fonts: { heading: 'caveat', body: 'lato' }, text: { h1: { size: 56 }, h2: { size: 42 } },
      buttons: { shape: 'rounded', fill: 'solid' }, radius: 'md', shadow: 'soft', spacing: 'normal',
    },
  }),
  preset({
    id: 'saude', name: 'Saúde', hint: 'Azul claro, limpo e confiável', style: 'classic', background: 'plain', accent: '#0284c7',
    theme: {
      colors: { bg: '#f0f9ff', surface: '#ffffff', text: '#0c4a6e', muted: '#4b6b80', accent2: '#14b8a6' },
      fonts: { heading: 'poppins', body: 'poppins' },
      buttons: { shape: 'pill', fill: 'solid' }, radius: 'lg', shadow: 'soft', spacing: 'normal',
    },
  }),
];
