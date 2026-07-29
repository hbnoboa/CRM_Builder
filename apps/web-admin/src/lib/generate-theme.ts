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

export function generateThemeVariables(
  hex: string,
  secondaryHex?: string,
  accentHex?: string,
): ThemeVariables {
  const primary = hexToHSL(hex);
  const secondary = secondaryHex ? hexToHSL(secondaryHex) : null;
  const accent = accentHex ? hexToHSL(accentHex) : null;

  const h = primary.h;
  const s = primary.s;

  // ---------- LIGHT MODE ----------
  const lBgTint = clamp(s * 0.05, 1, 4);
  const lBackground: HSL = { h, s: lBgTint, l: 98.5 };
  const lCard: HSL = { h, s: lBgTint, l: 99.5 };
  const lMuted: HSL = { h, s: clamp(s * 0.06, 1, 6), l: 96 };
  const lBorder = { h, s: clamp(s * 0.06, 2, 6), l: 90 };

  const lPrimary = withAA({ h, s: clamp(s, 35, 95), l: clamp(primary.l, 20, 50) });
  const lSecondary = withAA(
    secondary
      ? { h: secondary.h, s: clamp(secondary.s, 25, 85), l: clamp(secondary.l, 20, 55) }
      : { h, s: clamp(s * 0.5, 12, 38), l: 45 },
  );
  const lAccent = withAA(
    accent
      ? { h: accent.h, s: clamp(accent.s, 25, 85), l: clamp(accent.l, 20, 55) }
      : { h: (h + 30) % 360, s: clamp(s * 0.6, 18, 55), l: 45 },
  );
  const lDestructive = withAA({ h: 0, s: 75, l: 50 });

  const light: Record<string, string> = {
    '--background': hslStr(lBackground),
    '--foreground': hslStr(foregroundFor(lBackground, { h, s: clamp(s * 0.1, 3, 12), l: 12 })),
    '--card': hslStr(lCard),
    '--card-foreground': hslStr(foregroundFor(lCard, { h, s: clamp(s * 0.1, 3, 12), l: 12 })),
    '--popover': hslStr(lCard),
    '--popover-foreground': hslStr(foregroundFor(lCard, { h, s: clamp(s * 0.1, 3, 12), l: 12 })),
    '--primary': hslStr(lPrimary.bg),
    '--primary-foreground': hslStr(lPrimary.fg),
    '--secondary': hslStr(lSecondary.bg),
    '--secondary-foreground': hslStr(lSecondary.fg),
    '--muted': hslStr(lMuted),
    '--muted-foreground': hslStr(foregroundFor(lMuted, { h, s: clamp(s * 0.1, 3, 12), l: 40 })),
    '--accent': hslStr(lAccent.bg),
    '--accent-foreground': hslStr(lAccent.fg),
    '--destructive': hslStr(lDestructive.bg),
    '--destructive-foreground': hslStr(lDestructive.fg),
    '--border': hsl(lBorder.h, lBorder.s, lBorder.l),
    '--input': hsl(lBorder.h, lBorder.s, lBorder.l),
    '--ring': hslStr(lPrimary.bg),
  };

  // ---------- DARK MODE ----------
  const dBgTint = clamp(s * 0.08, 1, 6);
  const dBackground: HSL = { h, s: dBgTint, l: 6 };
  const dCard: HSL = { h, s: dBgTint, l: 8 };
  const dMuted: HSL = { h, s: clamp(s * 0.08, 1, 8), l: 15 };
  const dBorder = { h, s: clamp(s * 0.08, 2, 8), l: 18 };

  const dPrimary = withAA({ h, s: clamp(s * 0.9, 35, 90), l: clamp(primary.l > 50 ? primary.l : 100 - primary.l, 55, 78) });
  const dSecondary = withAA(
    secondary
      ? { h: secondary.h, s: clamp(secondary.s * 0.85, 25, 80), l: clamp(secondary.l > 50 ? secondary.l : 100 - secondary.l, 50, 72) }
      : { h, s: clamp(s * 0.45, 12, 36), l: 62 },
  );
  const dAccent = withAA(
    accent
      ? { h: accent.h, s: clamp(accent.s * 0.85, 25, 80), l: clamp(accent.l > 50 ? accent.l : 100 - accent.l, 50, 72) }
      : { h: (h + 30) % 360, s: clamp(s * 0.55, 18, 55), l: 60 },
  );
  const dDestructive = withAA({ h: 0, s: 62, l: 55 });

  const dark: Record<string, string> = {
    '--background': hslStr(dBackground),
    '--foreground': hslStr(foregroundFor(dBackground, { h, s: clamp(s * 0.05, 1, 6), l: 96 })),
    '--card': hslStr(dCard),
    '--card-foreground': hslStr(foregroundFor(dCard, { h, s: clamp(s * 0.05, 1, 6), l: 96 })),
    '--popover': hslStr(dCard),
    '--popover-foreground': hslStr(foregroundFor(dCard, { h, s: clamp(s * 0.05, 1, 6), l: 96 })),
    '--primary': hslStr(dPrimary.bg),
    '--primary-foreground': hslStr(dPrimary.fg),
    '--secondary': hslStr(dSecondary.bg),
    '--secondary-foreground': hslStr(dSecondary.fg),
    '--muted': hslStr(dMuted),
    '--muted-foreground': hslStr(foregroundFor(dMuted, { h, s: clamp(s * 0.05, 2, 8), l: 68 })),
    '--accent': hslStr(dAccent.bg),
    '--accent-foreground': hslStr(dAccent.fg),
    '--destructive': hslStr(dDestructive.bg),
    '--destructive-foreground': hslStr(dDestructive.fg),
    '--border': hsl(dBorder.h, dBorder.s, dBorder.l),
    '--input': hsl(dBorder.h, dBorder.s, dBorder.l),
    '--ring': hslStr(dPrimary.bg),
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
