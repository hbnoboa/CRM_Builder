/**
 * Tema das paginas para clientes (cores, fontes, estilos de texto, botoes, cantos,
 * sombras, espacamento, fundo) e o texto formatado (estilo Word). O servidor so
 * aceita o que esta nas listas daqui: nada de CSS ou HTML livre vindo do editor.
 * Os temas prontos e a aplicacao das cores ficam no web (lib/site-theme.ts).
 */

/** Fontes guardadas no nosso servidor (public/fonts/site). Mesma lista do web. */
export const SITE_FONT_IDS = [
  'inter', 'roboto', 'open-sans', 'montserrat', 'poppins', 'lato', 'nunito', 'raleway', 'work-sans', 'dm-sans', 'outfit', 'rubik',
  'playfair-display', 'merriweather', 'lora', 'cormorant-garamond', 'libre-baskerville', 'eb-garamond', 'dm-serif-display',
  'bebas-neue', 'oswald', 'abril-fatface', 'righteous', 'fredoka',
  'dancing-script', 'pacifico', 'caveat', 'great-vibes', 'satisfy',
  'space-mono',
] as const;

const COLOR_KEYS = ['bg', 'surface', 'text', 'muted', 'accent2'] as const;
const TEXT_KEYS = ['h1', 'h2', 'h3', 'body'] as const;
const SHAPES = ['square', 'rounded', 'pill'] as const;
const FILLS = ['solid', 'outline', 'soft', 'shadow'] as const;
const RADII = ['none', 'sm', 'md', 'lg', 'xl'] as const;
const SHADOWS = ['none', 'soft', 'strong'] as const;
const SPACINGS = ['compact', 'normal', 'airy'] as const;

export interface SiteTextStyle {
  font?: string;
  /** px (no computador; no celular a pagina reduz os titulos) */
  size?: number;
  bold?: boolean;
  italic?: boolean;
  upper?: boolean;
  color?: string;
  /** espaco entre letras, em centesimos de em (-5 a 40) */
  spacing?: number;
  /** altura da linha, em % (90 a 250) */
  line?: number;
}

export interface SiteTheme {
  preset?: string;
  colors?: Partial<Record<(typeof COLOR_KEYS)[number], string>>;
  fonts?: { heading?: string; body?: string };
  text?: Partial<Record<(typeof TEXT_KEYS)[number], SiteTextStyle>>;
  buttons?: { shape?: (typeof SHAPES)[number]; fill?: (typeof FILLS)[number] };
  radius?: (typeof RADII)[number];
  shadow?: (typeof SHADOWS)[number];
  spacing?: (typeof SPACINGS)[number];
  /** Fundo da pagina inteira: foto ou video (enviados do computador ou link). */
  bgImage?: string;
  bgVideo?: string;
  /** Escurece/clareia a foto ou video de fundo (0 a 80 %). */
  bgDim?: number;
}

const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const hex = (v: unknown) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : undefined);
const pick = <T extends readonly string[]>(list: T, v: unknown): T[number] | undefined =>
  (list as readonly string[]).includes(String(v)) ? (v as T[number]) : undefined;
const num = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v));
  return v === undefined || v === null || v === '' || !Number.isFinite(n) ? undefined : Math.min(max, Math.max(min, n));
};
const clean = <T extends object>(o: T): T | undefined => {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== false));
  return Object.keys(out).length ? (out as T) : undefined;
};

/** Fonte da lista ou enviada pela empresa ("custom:<id>"). */
export function fontRef(v: unknown): string | undefined {
  const s = String(v ?? '');
  if ((SITE_FONT_IDS as readonly string[]).includes(s)) return s;
  return /^custom:[a-z0-9]{10,40}$/.test(s) ? s : undefined;
}

export function normalizeTextStyle(raw: unknown): SiteTextStyle | undefined {
  const t = obj(raw);
  return clean<SiteTextStyle>({
    font: fontRef(t.font), size: num(t.size, 10, 120), bold: t.bold === true ? true : undefined,
    italic: t.italic === true, upper: t.upper === true, color: hex(t.color),
    spacing: num(t.spacing, -5, 40), line: num(t.line, 90, 250),
  });
}

export function normalizeTheme(raw: unknown, safeUrl: (u: unknown) => string): SiteTheme | undefined {
  const t = obj(raw);
  const colors = obj(t.colors);
  const fonts = obj(t.fonts);
  const text = obj(t.text);
  const buttons = obj(t.buttons);
  const bgImage = safeUrl(t.bgImage);
  const bgVideo = safeUrl(t.bgVideo);
  // bold: false explicito importa (titulo sem negrito); guarda como "bold: false" so dentro do estilo
  const styles = Object.fromEntries(TEXT_KEYS.map((k) => {
    const st = normalizeTextStyle(text[k]);
    const explicitNotBold = obj(text[k]).bold === false;
    return [k, explicitNotBold ? { ...(st || {}), bold: false } : st];
  }).filter(([, v]) => v));
  return clean<SiteTheme>({
    preset: String(t.preset ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || undefined,
    colors: clean(Object.fromEntries(COLOR_KEYS.map((k) => [k, hex(colors[k])]))),
    fonts: clean({ heading: fontRef(fonts.heading), body: fontRef(fonts.body) }),
    text: Object.keys(styles).length ? styles : undefined,
    buttons: clean({ shape: pick(SHAPES, buttons.shape), fill: pick(FILLS, buttons.fill) }),
    radius: pick(RADII, t.radius),
    shadow: pick(SHADOWS, t.shadow),
    spacing: pick(SPACINGS, t.spacing),
    bgImage: bgImage || undefined,
    bgVideo: bgVideo || undefined,
    bgDim: num(t.bgDim, 0, 80),
  });
}

// ── Texto formatado (estilo Word) ─────────────────────────────────────────

/**
 * Documento do editor de texto (formato do Tiptap/ProseMirror), conferido no
 * servidor: so os tipos e marcas daqui, com atributos validados. A pagina monta
 * o texto a partir disto (nunca HTML vindo de fora).
 */
export interface RichNode {
  type: string;
  attrs?: Record<string, string | number>;
  marks?: Array<{ type: string; attrs?: Record<string, string> }>;
  text?: string;
  content?: RichNode[];
}

const BLOCK_NODES = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote']);
const ALIGNS = ['left', 'center', 'right', 'justify'];
const MAX_NODES = 2000;
const MAX_TEXT = 20000;

export function normalizeRichDoc(raw: unknown, safeUrl: (u: unknown) => string): RichNode | undefined {
  const root = obj(raw);
  if (root.type !== 'doc' || !Array.isArray(root.content)) return undefined;
  let nodes = 0;
  let chars = 0;

  const marksOf = (list: unknown): RichNode['marks'] => {
    const out: NonNullable<RichNode['marks']> = [];
    for (const m of Array.isArray(list) ? list.slice(0, 10) : []) {
      const mk = obj(m);
      const a = obj(mk.attrs);
      switch (mk.type) {
        case 'bold': case 'italic': case 'underline': case 'strike':
          out.push({ type: String(mk.type) });
          break;
        case 'textStyle': {
          const size = num(String(a.fontSize ?? '').replace('px', ''), 8, 120);
          const attrs = clean({
            color: hex(a.color), fontFamily: fontRef(a.fontFamily),
            fontSize: size ? `${size}px` : undefined, backgroundColor: hex(a.backgroundColor),
          }) as Record<string, string> | undefined;
          if (attrs) out.push({ type: 'textStyle', attrs });
          break;
        }
        case 'highlight': {
          const color = hex(a.color);
          out.push({ type: 'highlight', ...(color ? { attrs: { color } } : {}) });
          break;
        }
        case 'link': {
          const href = safeUrl(a.href);
          if (href) out.push({ type: 'link', attrs: { href } });
          break;
        }
      }
    }
    return out.length ? out : undefined;
  };

  const walk = (raw: unknown, depth: number): RichNode | null => {
    if (++nodes > MAX_NODES || depth > 8) return null;
    const n = obj(raw);
    const type = String(n.type);
    if (type === 'text') {
      const text = String(n.text ?? '').slice(0, Math.max(0, MAX_TEXT - chars));
      if (!text) return null;
      chars += text.length;
      const marks = marksOf(n.marks);
      return { type, text, ...(marks ? { marks } : {}) };
    }
    if (type === 'hardBreak') return { type };
    if (!BLOCK_NODES.has(type)) return null;
    const a = obj(n.attrs);
    const attrs: Record<string, string | number> = {};
    if (type === 'heading') attrs.level = Math.min(3, Math.max(1, Number(a.level) || 2));
    if ((type === 'paragraph' || type === 'heading') && ALIGNS.includes(String(a.textAlign))) attrs.textAlign = String(a.textAlign);
    if (type === 'orderedList' && Number(a.start) > 1) attrs.start = Math.min(999, Math.round(Number(a.start)));
    const content = (Array.isArray(n.content) ? n.content : []).map((c) => walk(c, depth + 1)).filter((c): c is RichNode => !!c);
    return { type, ...(Object.keys(attrs).length ? { attrs } : {}), ...(content.length ? { content } : {}) };
  };

  const content = (root.content as unknown[]).map((c) => walk(c, 1)).filter((c): c is RichNode => !!c);
  return content.length ? { type: 'doc', content } : undefined;
}

/** Texto puro do documento (para busca, avisos e quem le so o texto). */
export function richPlainText(doc: RichNode | undefined): string {
  if (!doc) return '';
  const parts: string[] = [];
  const walk = (n: RichNode) => {
    if (n.type === 'text') parts.push(n.text || '');
    else if (n.type === 'hardBreak') parts.push('\n');
    n.content?.forEach(walk);
    if (BLOCK_NODES.has(n.type) && n.type !== 'listItem') parts.push('\n');
  };
  walk(doc);
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}
