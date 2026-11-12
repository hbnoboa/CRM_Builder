// Pure TypeScript HSL-based theme generation from a single brand color.
// No external dependencies — all math is inline.
//
// Garante contraste WCAG AA (>= 4.5:1) em TODO par superfície/texto, para
// QUALQUER cor de marca. A cor do texto (claro/escuro) é escolhida por
// contraste real (luminância percebida), nunca por limiar de lightness HSL,
// e a superfície é ajustada automaticamente quando necessário.

type HSL = { h: number; s: number; l: number };

// Alvo interno com margem acima do mínimo AA (4.5) para nunca encostar na
// borda por arredondamento ao serializar as variáveis.
const AA = 4.6;

export function hexToHSL(hex: string): HSL {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360 * 10) / 10, s: Math.round(s * 1000) / 10, l: Math.round(l * 1000) / 10 };
}

function hslToRGB(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// Relative luminance (WCAG 2.x)
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(a: HSL, b: HSL): number {
  const [r1, g1, b1] = hslToRGB(a.h, a.s, a.l);
  const [r2, g2, b2] = hslToRGB(b.h, b.s, b.l);
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function hsl(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

function hslStr(c: HSL): string {
  return hsl(c.h, c.s, c.l);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// Pick the text color (near-white or hue-tinted near-black) with the BEST
// real contrast against the given surface — by luminance, not HSL lightness.
function pickForeground(bg: HSL): HSL {
  const white: HSL = { h: bg.h, s: clamp(bg.s * 0.1, 0, 8), l: 99 };
  const black: HSL = { h: bg.h, s: clamp(bg.s * 0.2, 0, 14), l: 11 };
  return contrastRatio(bg, white) >= contrastRatio(bg, black) ? white : black;
}

// Guarantee AA: keep the best foreground and nudge the SURFACE lightness
// toward the extreme until contrast >= 4.5. Works for any input color.
function withAA(surface: HSL): { bg: HSL; fg: HSL } {
  const bg: HSL = { ...surface };
  let fg = pickForeground(bg);
  let attempts = 0;
  while (contrastRatio(bg, fg) < AA && attempts < 80) {
    // fg light -> darken surface; fg dark -> lighten surface
    bg.l = fg.l > 50 ? clamp(bg.l - 1.5, 0, 100) : clamp(bg.l + 1.5, 0, 100);
    fg = pickForeground(bg);
    attempts++;
  }
  return { bg, fg };
}

// Ensure a foreground-on-fixed-background pair reaches AA by moving the
// FOREGROUND (used for muted text where the surface must stay put).
function foregroundFor(bg: HSL, hint: HSL): HSL {
  const fg: HSL = { ...hint };
  const darken = luminance(...hslToRGB(bg.h, bg.s, bg.l)) > 0.4; // light bg -> dark text
  let attempts = 0;
  while (contrastRatio(bg, fg) < AA && attempts < 80) {
    fg.l = darken ? clamp(fg.l - 2, 0, 100) : clamp(fg.l + 2, 0, 100);
    attempts++;
  }
  return fg;
}

export interface ThemeVariables {
  light: Record<string, string>;
  dark: Record<string, string>;
}

/** Cor padrao do produto (CRM Builder) para empresas sem cor definida. */
export const DEFAULT_BRAND_COLOR = '#ea580c';

// Escala da marca (50..950) com luminosidade fixa por passo: o mesmo passo tem
// o mesmo peso visual para qualquer cor de empresa (base dos tons suaves do menu,
// etiquetas e destaques). Saturacao menor nas pontas para nao "gritar".
const BRAND_STEPS: Array<[number, number, number]> = [
  // passo, luminosidade, fator de saturacao
  [50, 97, 0.9], [100, 94, 0.9], [200, 87, 0.92], [300, 78, 0.95], [400, 66, 1],
  [500, 56, 1], [600, 48, 1], [700, 40, 0.95], [800, 32, 0.9], [900, 25, 0.85], [950, 16, 0.8],
];

function brandScale(h: number, s: number): Record<string, string> {
  const sat = clamp(s, 30, 92);
  const out: Record<string, string> = {};
  for (const [step, l, f] of BRAND_STEPS) out[`--brand-${step}`] = hsl(h, Math.round(sat * f * 10) / 10, l);
  return out;
}

export function generateThemeVariables(
  hex: string,
  secondaryHex?: string,
  _accentHex?: string,
): ThemeVariables {
  const primary = hexToHSL(hex);
  const secondary = secondaryHex ? hexToHSL(secondaryHex) : null;

  const h = primary.h;
  const s = primary.s;
  const scale = brandScale(h, s);
  const sat = clamp(s, 30, 92);
  // Neutros levemente tingidos pelo matiz da marca (nao competem com ela)
  const nTint = clamp(s * 0.06, 2, 7);

  // ---------- LIGHT MODE ----------
  // Pagina levemente cinza + cartoes brancos: separa as superficies sem sombra pesada
  const lBackground: HSL = { h, s: nTint, l: 97 };
  const lCard: HSL = { h, s: 0, l: 100 };
  const lMuted: HSL = { h, s: nTint, l: 94.5 };
  const lBorder: HSL = { h, s: nTint, l: 89 };
  const lInk: HSL = { h, s: clamp(s * 0.12, 4, 14), l: 12 };

  const lPrimary = withAA({ h, s: clamp(s, 35, 95), l: clamp(primary.l, 20, 50) });
  // Secundario e hover (accent) NEUTROS/suaves, como no shadcn: a marca so aparece
  // em acao principal, item ativo, foco e destaques.
  const lSecondary: HSL = { h, s: nTint, l: 93 };
  const lAccent: HSL = { h, s: sat * 0.9, l: 96 };
  const lDestructive = withAA({ h: 0, s: 75, l: 50 });

  const light: Record<string, string> = {
    ...scale,
    '--background': hslStr(lBackground),
    '--foreground': hslStr(foregroundFor(lBackground, lInk)),
    '--card': hslStr(lCard),
    '--card-foreground': hslStr(foregroundFor(lCard, lInk)),
    '--popover': hslStr(lCard),
    '--popover-foreground': hslStr(foregroundFor(lCard, lInk)),
    '--primary': hslStr(lPrimary.bg),
    '--primary-foreground': hslStr(lPrimary.fg),
    '--secondary': hslStr(secondary ? withAA({ h: secondary.h, s: clamp(secondary.s, 25, 85), l: clamp(secondary.l, 20, 55) }).bg : lSecondary),
    '--secondary-foreground': hslStr(secondary ? withAA({ h: secondary.h, s: clamp(secondary.s, 25, 85), l: clamp(secondary.l, 20, 55) }).fg : foregroundFor(lSecondary, lInk)),
    '--muted': hslStr(lMuted),
    '--muted-foreground': hslStr(foregroundFor(lMuted, { h, s: clamp(s * 0.1, 3, 12), l: 42 })),
    '--accent': hslStr(lAccent),
    '--accent-foreground': hslStr(foregroundFor(lAccent, { h, s: sat, l: 28 })),
    '--destructive': hslStr(lDestructive.bg),
    '--destructive-foreground': hslStr(lDestructive.fg),
    '--border': hslStr(lBorder),
    '--input': hsl(h, nTint, 86),
    '--ring': hslStr(lPrimary.bg),
    // Item ativo do menu: tom claro da marca + texto escuro da marca (nunca bloco solido)
    '--nav-active': hsl(h, sat * 0.9, 94),
    '--nav-active-foreground': hslStr(foregroundFor({ h, s: sat * 0.9, l: 94 }, { h, s: sat, l: 32 })),
  };

  // ---------- DARK MODE ----------
  // Superficies sobem de luminosidade com a elevacao (fundo < cartao < popover)
  const dBackground: HSL = { h, s: clamp(s * 0.08, 2, 8), l: 7 };
  const dCard: HSL = { h, s: clamp(s * 0.08, 2, 8), l: 10 };
  const dMuted: HSL = { h, s: clamp(s * 0.08, 2, 8), l: 15 };
  const dBorder: HSL = { h, s: clamp(s * 0.08, 2, 8), l: 19 };
  const dInk: HSL = { h, s: clamp(s * 0.05, 1, 6), l: 95 };

  const dPrimary = withAA({ h, s: clamp(s * 0.85, 35, 88), l: clamp(primary.l > 50 ? primary.l : 100 - primary.l, 58, 72) });
  const dSecondary: HSL = { h, s: clamp(s * 0.08, 2, 8), l: 17 };
  const dAccent: HSL = { h, s: sat * 0.45, l: 17 };
  const dDestructive = withAA({ h: 0, s: 62, l: 55 });

  const dark: Record<string, string> = {
    ...scale,
    '--background': hslStr(dBackground),
    '--foreground': hslStr(foregroundFor(dBackground, dInk)),
    '--card': hslStr(dCard),
    '--card-foreground': hslStr(foregroundFor(dCard, dInk)),
    '--popover': hsl(dCard.h, dCard.s, 12),
    '--popover-foreground': hslStr(foregroundFor({ ...dCard, l: 12 }, dInk)),
    '--primary': hslStr(dPrimary.bg),
    '--primary-foreground': hslStr(dPrimary.fg),
    '--secondary': hslStr(dSecondary),
    '--secondary-foreground': hslStr(foregroundFor(dSecondary, dInk)),
    '--muted': hslStr(dMuted),
    '--muted-foreground': hslStr(foregroundFor(dMuted, { h, s: clamp(s * 0.05, 2, 8), l: 68 })),
    '--accent': hslStr(dAccent),
    '--accent-foreground': hslStr(foregroundFor(dAccent, { h, s: sat * 0.7, l: 85 })),
    '--destructive': hslStr(dDestructive.bg),
    '--destructive-foreground': hslStr(dDestructive.fg),
    '--border': hslStr(dBorder),
    '--input': hsl(dBorder.h, dBorder.s, 22),
    '--ring': hslStr(dPrimary.bg),
    '--nav-active': hsl(h, sat * 0.45, 18),
    '--nav-active-foreground': hslStr(foregroundFor({ h, s: sat * 0.45, l: 18 }, { h, s: sat * 0.7, l: 82 })),
  };

  return { light, dark };
}

// Preset brand colors for quick selection
export const PRESET_COLORS = [
  { hex: '#2563eb', name: 'Blue' },
  { hex: '#7c3aed', name: 'Purple' },
  { hex: '#dc2626', name: 'Red' },
  { hex: '#059669', name: 'Green' },
  { hex: '#d97706', name: 'Amber' },
  { hex: '#0891b2', name: 'Cyan' },
  { hex: '#e11d48', name: 'Rose' },
  { hex: '#4f46e5', name: 'Indigo' },
  { hex: '#0d9488', name: 'Teal' },
  { hex: '#ea580c', name: 'Orange' },
];
