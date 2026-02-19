// Pure TypeScript HSL-based theme generation from a single brand color.
// No external dependencies — all math is inline.

type HSL = { h: number; s: number; l: number };

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

function contrastRatio(hsl1: HSL, hsl2: HSL): number {
  const [r1, g1, b1] = hslToRGB(hsl1.h, hsl1.s, hsl1.l);
  const [r2, g2, b2] = hslToRGB(hsl2.h, hsl2.s, hsl2.l);
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function hsl(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// Ensure primary has at least 4.5:1 contrast ratio against the given background
function ensureContrast(primary: HSL, bg: HSL, darken: boolean): HSL {
  const p = { ...primary };
  let attempts = 0;
  while (contrastRatio(p, bg) < 4.5 && attempts < 40) {
    p.l = darken ? p.l - 2 : p.l + 2;
    p.l = clamp(p.l, 5, 95);
    attempts++;
  }
  return p;
}

export interface ThemeVariables {
  light: Record<string, string>;
  dark: Record<string, string>;
}

export function generateThemeVariables(hex: string): ThemeVariables {
  const brand = hexToHSL(hex);
  const h = brand.h;
  const s = brand.s;

  // ---- LIGHT MODE ----
  const lightBg: HSL = { h: 0, s: 0, l: 100 };
  const lightPrimary = ensureContrast(
    { h, s: clamp(s, 40, 90), l: clamp(brand.l, 15, 45) },
    lightBg,
    true, // darken to get contrast on white
  );

  const light: Record<string, string> = {
    '--background': hsl(0, 0, 100),
    '--foreground': hsl(h, clamp(s, 30, 80), 5),
    '--card': hsl(0, 0, 100),
    '--card-foreground': hsl(h, clamp(s, 30, 80), 5),
    '--popover': hsl(0, 0, 100),
    '--popover-foreground': hsl(h, clamp(s, 30, 80), 5),
    '--primary': hsl(lightPrimary.h, lightPrimary.s, lightPrimary.l),
    '--primary-foreground': lightPrimary.l < 50 ? hsl(0, 0, 100) : hsl(h, clamp(s, 40, 80), 5),
    '--secondary': hsl(h, clamp(s * 0.4, 20, 40), 96),
    '--secondary-foreground': hsl(lightPrimary.h, lightPrimary.s, lightPrimary.l),
    '--muted': hsl(h, clamp(s * 0.25, 10, 25), 96.5),
    '--muted-foreground': hsl(h, clamp(s * 0.2, 10, 20), 46),
    '--accent': hsl((h + 15) % 360, clamp(s * 0.4, 25, 40), 96),
    '--accent-foreground': hsl(lightPrimary.h, lightPrimary.s, lightPrimary.l),
    '--destructive': hsl(0, 84.2, 60.2),
    '--destructive-foreground': hsl(0, 0, 100),
    '--border': hsl(h, clamp(s * 0.35, 15, 32), 91),
    '--input': hsl(h, clamp(s * 0.35, 15, 32), 91),
    '--ring': hsl(lightPrimary.h, lightPrimary.s, lightPrimary.l),
  };

  // ---- DARK MODE ----
  const darkBg: HSL = { h, s: clamp(s, 30, 80), l: 5 };
  const darkPrimary = ensureContrast(
    { h, s: clamp(s * 0.85, 35, 85), l: clamp(brand.l > 50 ? brand.l : 100 - brand.l, 55, 75) },
    darkBg,
    false, // lighten to get contrast on dark bg
  );

  const dark: Record<string, string> = {
    '--background': hsl(h, clamp(s, 30, 80), 5),
    '--foreground': hsl(h, clamp(s * 0.4, 15, 40), 98),
    '--card': hsl(h, clamp(s, 30, 80), 5),
    '--card-foreground': hsl(h, clamp(s * 0.4, 15, 40), 98),
    '--popover': hsl(h, clamp(s, 30, 80), 5),
    '--popover-foreground': hsl(h, clamp(s * 0.4, 15, 40), 98),
    '--primary': hsl(darkPrimary.h, darkPrimary.s, darkPrimary.l),
    '--primary-foreground': hsl(h, clamp(s, 40, 80), 8),
    '--secondary': hsl(h, clamp(s * 0.35, 18, 35), 17),
    '--secondary-foreground': hsl(h, clamp(s * 0.4, 15, 40), 98),
    '--muted': hsl(h, clamp(s * 0.35, 18, 35), 17),
    '--muted-foreground': hsl(h, clamp(s * 0.2, 10, 22), 65),
    '--accent': hsl((h + 15) % 360, clamp(s * 0.35, 18, 35), 17),
    '--accent-foreground': hsl(h, clamp(s * 0.4, 15, 40), 98),
    '--destructive': hsl(0, 62.8, 30.6),
    '--destructive-foreground': hsl(0, 0, 98),
    '--border': hsl(h, clamp(s * 0.35, 18, 35), 17),
    '--input': hsl(h, clamp(s * 0.35, 18, 35), 17),
    '--ring': hsl(darkPrimary.h, clamp(darkPrimary.s * 0.6, 15, 30), 83),
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
