import { BadRequestException } from '@nestjs/common';
import { hasDefault } from '../../common/utils/field-defaults';
import type { SchemaField, SchemaTable } from '../ai-builder/tenant-schema';
import { normalizeRichDoc, normalizeTheme, richPlainText, type RichNode, type SiteTheme } from './site-theme';
import { EXTRA_BLOCK_TYPES, missingExtra, normalizeExtraBlock, type ExtraBlock } from './site-blocks-more';

/**
 * Blocos das paginas para clientes. A pagina e a unica coisa que decide o que sai
 * para fora: so os campos listados em cada bloco sao mostrados ou aceitos.
 */

export const SITE_BLOCK_TYPES = [
  'heading', 'text', 'image', 'button', 'divider', 'form', 'tracking',
  'hero', 'gallery', 'cards', 'quote', 'catalog', ...EXTRA_BLOCK_TYPES,
] as const;
export type SiteBlockType = (typeof SITE_BLOCK_TYPES)[number];

export interface HeadingBlock { id: string; type: 'heading'; text: string; size?: 'lg' | 'md' }
/** Texto: `doc` e o texto formatado (estilo Word); `text` e o mesmo texto puro. */
export interface TextBlock { id: string; type: 'text'; text: string; doc?: RichNode }
export interface ImageBlock { id: string; type: 'image'; url: string; alt?: string }
export interface ButtonBlock { id: string; type: 'button'; label: string; url: string }
export interface DividerBlock { id: string; type: 'divider' }
export interface FormBlock {
  id: string;
  type: 'form';
  entitySlug: string;
  fields: string[];
  submitLabel?: string;
  successMessage?: string;
  /** Depois de enviar, mostra o link de acompanhamento (se houver pagina de acompanhamento). */
  showTrackingLink?: boolean;
  /**
   * Tabela "de dentro" (ex.: sinistro dentro do segurado): o cliente tambem preenche
   * o registro de cima, criado junto ou reaproveitado pelo campo de identificacao.
   */
  parent?: ParentForm;
}
export interface ParentForm {
  entitySlug: string;
  fields: string[];
  /** Se ja existir registro de cima com o mesmo valor neste campo (ex.: CPF), usa o mesmo. */
  matchField?: string;
  title?: string;
}
export interface TrackingBlock {
  id: string;
  type: 'tracking';
  entitySlug: string;
  fields: string[];
  /** Lista dentro do registro mostrada como historico (ex.: andamentos). */
  timelineField?: string;
  /** Campos de foto/arquivo que o cliente pode enviar pelo link. */
  uploadFields?: string[];
  /** Modelo de PDF (publicado) que o cliente pode baixar. */
  pdfTemplateId?: string;
}
/** Destaque do topo: foto grande com titulo, texto e botao por cima. */
export interface HeroBlock { id: string; type: 'hero'; title: string; text?: string; imageUrl?: string; buttonLabel?: string; buttonUrl?: string }
export interface GalleryImage { url: string; caption?: string }
export interface GalleryBlock { id: string; type: 'gallery'; title?: string; layout: 'polaroid' | 'grid' | 'mosaic'; images: GalleryImage[] }
export interface CardItem { title: string; text?: string; imageUrl?: string; badge?: string }
export interface CardsBlock { id: string; type: 'cards'; title?: string; columns: 1 | 2 | 3; items: CardItem[] }
export interface QuoteBlock { id: string; type: 'quote'; text: string; author?: string }
/**
 * Vitrine de uma tabela (ex.: cardapio): mostra os registros com SO os campos
 * escolhidos aqui. Serve para o que a empresa quer publico (produtos, servicos).
 */
export interface CatalogBlock {
  id: string;
  type: 'catalog';
  title?: string;
  entitySlug: string;
  titleField: string;
  imageField?: string;
  priceField?: string;
  descriptionField?: string;
  /** Lista de opcoes que separa em grupos (ex.: Categoria). */
  groupField?: string;
  /** Campo sim/nao: so aparecem os marcados (ex.: Disponivel). */
  onlyField?: string;
  limit: number;
}
export type SiteBlock =
  | HeadingBlock | TextBlock | ImageBlock | ButtonBlock | DividerBlock | FormBlock | TrackingBlock
  | HeroBlock | GalleryBlock | CardsBlock | QuoteBlock | CatalogBlock | ExtraBlock;

// ── Aparencia da pagina ──────────────────────────────────────────────────

export const SITE_STYLES = ['classic', 'scrapbook'] as const;
export const SITE_BACKGROUNDS = ['plain', 'dots', 'hearts', 'stars', 'stripes', 'grid'] as const;
export interface SitePageSettings {
  /** A pagina tem aparencia propria; senao, usa a aparencia do site. */
  ownLook?: boolean;
  /** classic: limpo e corporativo; scrapbook: colorido, fotos em polaroide (estilo Tumblr antigo). */
  style: (typeof SITE_STYLES)[number];
  background: (typeof SITE_BACKGROUNDS)[number];
  /** Cor de destaque so desta pagina (senao, a cor da empresa). */
  accent?: string;
  /** Foto de capa no topo da pagina. */
  coverUrl?: string;
  /** Frase curta embaixo do nome da empresa. */
  tagline?: string;
  /** Cores, fontes, estilos de texto, botoes, cantos, sombras, espacamento e fundo. */
  theme?: SiteTheme;
}

export function normalizeSettings(raw: unknown): SitePageSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const style = (SITE_STYLES as readonly string[]).includes(String(s.style)) ? (s.style as SitePageSettings['style']) : 'classic';
  const background = (SITE_BACKGROUNDS as readonly string[]).includes(String(s.background))
    ? (s.background as SitePageSettings['background'])
    : style === 'scrapbook' ? 'dots' : 'plain';
  const accent = /^#[0-9a-f]{6}$/i.test(String(s.accent ?? '')) ? String(s.accent).toLowerCase() : undefined;
  const coverUrl = safeUrl(s.coverUrl);
  const tagline = clip(s.tagline, 140);
  const theme = normalizeTheme(s.theme, safeUrl);
  return {
    ...(s.ownLook === true ? { ownLook: true } : {}),
    style, background, ...(accent ? { accent } : {}), ...(coverUrl ? { coverUrl } : {}), ...(tagline ? { tagline } : {}),
    ...(theme ? { theme } : {}),
  };
}

// ── Site (todas as paginas da empresa) ───────────────────────────────────

export interface SiteFooter {
  text?: string;
  address?: string;
  hours?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  email?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
}

/** Topo do site: formato, menu, botao de destaque e comportamento ao rolar. */
export const HEADER_LAYOUTS = ['bar', 'inline', 'centered', 'cover', 'minimal'] as const;
export const MENU_STYLES = ['pills', 'underline', 'plain', 'buttons'] as const;
export interface SiteHeader {
  layout?: (typeof HEADER_LAYOUTS)[number];
  menuStyle?: (typeof MENU_STYLES)[number];
  sticky?: boolean;
  hideLogo?: boolean;
  hideName?: boolean;
  logoSize?: 'sm' | 'md' | 'lg';
  cta?: { label: string; url: string };
}
export const FOOTER_LAYOUTS = ['card', 'columns', 'centered', 'minimal'] as const;
export interface SiteFooterStyle {
  layout?: (typeof FOOTER_LAYOUTS)[number];
  tone?: 'page' | 'surface' | 'dark' | 'accent';
}
export interface SiteConfig {
  /** Aparencia padrao de todas as paginas. */
  look: SitePageSettings;
  /** Paginas no menu, na ordem (vazio = todas as publicadas). */
  menu: Array<{ slug: string; label?: string }>;
  footer: SiteFooter;
  /** Pagina aberta no endereco principal (subdominio sem caminho). */
  homeSlug?: string;
  /** Temas guardados pela empresa ("Meus temas"), para reaproveitar. */
  savedThemes?: Array<{ name: string; look: SitePageSettings }>;
  header?: SiteHeader;
  footerStyle?: SiteFooterStyle;
  /** Link discreto "Area da equipe" no rodape (login dos funcionarios e clientes). */
  teamLink?: boolean;
}

function normalizeHeader(raw: unknown): SiteHeader | undefined {
  const h = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const c = (h.cta && typeof h.cta === 'object' ? h.cta : {}) as Record<string, unknown>;
  const label = clip(c.label, 30);
  const url = safeUrl(c.url);
  const out = Object.fromEntries(Object.entries({
    layout: pick(HEADER_LAYOUTS, h.layout), menuStyle: pick(MENU_STYLES, h.menuStyle),
    sticky: h.sticky === true || undefined, hideLogo: h.hideLogo === true || undefined, hideName: h.hideName === true || undefined,
    logoSize: pick(['sm', 'md', 'lg'] as const, h.logoSize), cta: label && url ? { label, url } : undefined,
  }).filter(([, v]) => v !== undefined));
  return Object.keys(out).length ? (out as SiteHeader) : undefined;
}

function normalizeFooterStyle(raw: unknown): SiteFooterStyle | undefined {
  const f = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = Object.fromEntries(Object.entries({
    layout: pick(FOOTER_LAYOUTS, f.layout), tone: pick(['page', 'surface', 'dark', 'accent'] as const, f.tone),
  }).filter(([, v]) => v !== undefined));
  return Object.keys(out).length ? (out as SiteFooterStyle) : undefined;
}

export function normalizeSiteConfig(raw: unknown, pageSlugs?: Set<string>): SiteConfig {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const { ownLook: _own, ...look } = normalizeSettings(s.look);
  const known = (slug: string) => !pageSlugs || pageSlugs.has(slug);
  const seen = new Set<string>();
  const menu = (Array.isArray(s.menu) ? s.menu : []).slice(0, 12).map((m) => {
    const it = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
    const slug = clip(it.slug, 80);
    const label = clip(it.label, 30);
    if (!slug || !known(slug) || seen.has(slug)) return null;
    seen.add(slug);
    return { slug, ...(label ? { label } : {}) };
  }).filter((m): m is { slug: string; label?: string } => !!m);
  const f = (s.footer && typeof s.footer === 'object' ? s.footer : {}) as Record<string, unknown>;
  const instagram = clip(f.instagram, 80).replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[^a-zA-Z0-9._]/g, '');
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clip(f.email, 120)) ? clip(f.email, 120) : '';
  const social = (v: unknown) => {
    const raw = clip(v, 200);
    // Outro protocolo (javascript:, data:...) nao vira link
    if (!raw || (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:/i.test(raw))) return '';
    return safeUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`);
  };
  const footer: SiteFooter = Object.fromEntries(Object.entries({
    text: clip(f.text, 300), address: clip(f.address, 200), hours: clip(f.hours, 200), phone: clip(f.phone, 30),
    whatsapp: clip(f.whatsapp, 30).replace(/[^\d+]/g, ''), instagram, email,
    facebook: social(f.facebook), tiktok: social(f.tiktok), youtube: social(f.youtube), linkedin: social(f.linkedin),
  }).filter(([, v]) => v));
  const home = clip(s.homeSlug, 80);
  const savedThemes = (Array.isArray(s.savedThemes) ? s.savedThemes : []).slice(0, 12).map((t) => {
    const it = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
    const name = clip(it.name, 40);
    if (!name) return null;
    const { ownLook: _o, ...saved } = normalizeSettings(it.look);
    return { name, look: saved };
  }).filter((t): t is { name: string; look: SitePageSettings } => !!t);
  const header = normalizeHeader(s.header);
  const footerStyle = normalizeFooterStyle(s.footerStyle);
  return {
    look, menu, footer, ...(home && known(home) ? { homeSlug: home } : {}),
    ...(savedThemes.length ? { savedThemes } : {}),
    ...(header ? { header } : {}), ...(footerStyle ? { footerStyle } : {}),
    ...(s.teamLink === true ? { teamLink: true } : {}),
  };
}


// ── Secoes e grade ───────────────────────────────────────────────────────

/**
 * Como os blocos ficam na pagina: secoes (faixas de cima para baixo) com uma grade
 * de 12 colunas no computador. No celular os blocos de cada secao ficam um embaixo
 * do outro, na ordem de leitura (de cima para baixo, da esquerda para a direita).
 * `h` e a altura em linhas da grade, medida no editor; na pagina e so o minimo.
 */
export const SECTION_WIDTHS = ['narrow', 'normal', 'full'] as const;
export const SPACINGS = ['none', 'sm', 'md', 'lg'] as const;
const HIDE_ON = ['mobile', 'desktop'] as const;
const ALIGNS = ['left', 'center', 'right'] as const;
const V_ALIGNS = ['top', 'center', 'bottom'] as const;
const RADII = ['none', 'sm', 'lg'] as const;
/** Animacao ao aparecer na tela (por elemento; sem: a do tema). */
const ANIMS = ['none', 'fade', 'rise', 'zoom', 'slide'] as const;
export const GRID_COLS = 12;
const MAX_SECTIONS = 30;
const MAX_ROW = 20000;

export interface SiteItemStyle {
  align?: (typeof ALIGNS)[number];
  vAlign?: (typeof V_ALIGNS)[number];
  bg?: string;
  padding?: (typeof SPACINGS)[number];
  radius?: (typeof RADII)[number];
  shadow?: boolean;
  /** Texto claro (para fundo escuro). */
  light?: boolean;
  anim?: (typeof ANIMS)[number];
}
export interface SiteLayoutItem {
  /** id do bloco */
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hide?: (typeof HIDE_ON)[number];
  style?: SiteItemStyle;
  /** Posicao no celular dentro da secao (sem: segue a ordem de leitura). */
  order?: number;
  /** Altura escolhida (em linhas da grade); sem: a do conteudo. */
  minH?: number;
}
export interface SiteSection {
  id: string;
  name?: string;
  /** narrow: coluna de leitura; normal: largura de site; full: a tela toda. */
  width: (typeof SECTION_WIDTHS)[number];
  padding: (typeof SPACINGS)[number];
  bg?: string;
  bgImage?: string;
  /** Video de fundo (mp4/webm), toca sem som e em repeticao. */
  bgVideo?: string;
  /** Escurece a foto/video de fundo para o texto aparecer. */
  overlay?: boolean;
  /** Foto de fundo parada enquanto a pagina rola. */
  parallax?: boolean;
  /** Variacao de cor do tema: superficie, destaque, destaque 2 ou escura. */
  tone?: (typeof TONES)[number];
  gradient?: { from: string; to: string; angle: number; kind: 'linear' | 'radial' };
  pattern?: (typeof SITE_BACKGROUNDS)[number];
  light?: boolean;
  hide?: (typeof HIDE_ON)[number];
  items: SiteLayoutItem[];
}
const TONES = ['surface', 'accent', 'accent2', 'dark'] as const;
export interface SiteLayout { sections: SiteSection[] }

const pick = <T extends readonly string[]>(list: T, v: unknown): T[number] | undefined =>
  (list as readonly string[]).includes(String(v)) ? (v as T[number]) : undefined;
const hex = (v: unknown) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v).toLowerCase() : undefined);
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const cleanId = (v: unknown) => clip(v, 40).replace(/[^a-zA-Z0-9_-]/g, '');
const compact = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== false)) as T;

function normalizeItemStyle(raw: unknown): SiteItemStyle | undefined {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const style = compact<SiteItemStyle>({
    align: pick(ALIGNS, s.align), vAlign: pick(V_ALIGNS, s.vAlign), bg: hex(s.bg), padding: pick(SPACINGS, s.padding),
    radius: pick(RADII, s.radius), shadow: s.shadow === true, light: s.light === true, anim: pick(ANIMS, s.anim),
  });
  return Object.keys(style).length ? style : undefined;
}

/** Bloco de largura toda, embaixo do que ja existe na secao. */
const appendItem = (section: SiteSection, id: string) => {
  const y = section.items.reduce((max, it) => Math.max(max, it.y + it.h), 0);
  section.items.push({ id, x: 0, y, w: GRID_COLS, h: 1 });
};

/**
 * Valida as secoes vindas do editor contra os blocos da pagina: cada bloco aparece
 * uma vez; bloco que ficou de fora vai para o fim da ultima secao. Pagina antiga
 * (sem secoes) vira uma secao estreita com os blocos em sequencia, como era antes.
 */
export function normalizeLayout(raw: unknown, blocks: Array<{ id: string }>): SiteLayout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const known = new Set(blocks.map((b) => b.id));
  const used = new Set<string>();
  const sectionIds = new Set<string>();
  const sections: SiteSection[] = (Array.isArray(r.sections) ? r.sections : []).slice(0, MAX_SECTIONS).map((item, index) => {
    const s = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    let id = cleanId(s.id) || `secao-${index + 1}`;
    while (sectionIds.has(id)) id = `${id}-${index + 1}`;
    sectionIds.add(id);
    const items = (Array.isArray(s.items) ? s.items : []).map((it, i) => {
      const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
      const bid = clip(o.id, 40);
      if (!known.has(bid) || used.has(bid)) return null;
      used.add(bid);
      const w = int(o.w, 1, GRID_COLS, GRID_COLS);
      const style = normalizeItemStyle(o.style);
      const minH = o.minH === undefined || o.minH === null ? undefined : int(o.minH, 1, 1000, 1);
      return compact<SiteLayoutItem>({
        id: bid, x: int(o.x, 0, GRID_COLS - w, 0), y: int(o.y, 0, MAX_ROW, i), w, h: Math.max(int(o.h, 1, 1000, 1), minH ?? 1),
        hide: pick(HIDE_ON, o.hide), style,
        order: o.order === undefined || o.order === null ? undefined : int(o.order, 0, 999, 0), minH,
      });
    }).filter((it): it is SiteLayoutItem => !!it);
    const bgImage = safeUrl(s.bgImage);
    const bgVideo = safeUrl(s.bgVideo);
    const name = clip(s.name, 40);
    const g = (s.gradient && typeof s.gradient === 'object' ? s.gradient : {}) as Record<string, unknown>;
    const gradient = hex(g.from) && hex(g.to)
      ? { from: hex(g.from)!, to: hex(g.to)!, angle: int(g.angle, 0, 360, 135), kind: g.kind === 'radial' ? 'radial' as const : 'linear' as const }
      : undefined;
    const pattern = pick(SITE_BACKGROUNDS, s.pattern);
    return compact<SiteSection>({
      id, ...(name ? { name } : {}),
      width: pick(SECTION_WIDTHS, s.width) ?? 'normal',
      padding: pick(SPACINGS, s.padding) ?? 'md',
      bg: hex(s.bg), ...(bgImage ? { bgImage } : {}), ...(bgVideo ? { bgVideo } : {}),
      overlay: s.overlay === true, parallax: s.parallax === true, light: s.light === true,
      tone: pick(TONES, s.tone), gradient, pattern: pattern === 'plain' ? undefined : pattern,
      hide: pick(HIDE_ON, s.hide), items: compactUp(items),
    });
  });
  const missing = blocks.filter((b) => !used.has(b.id));
  if (missing.length) {
    if (!sections.length) sections.push({ id: 'secao-1', width: 'narrow', padding: 'md', items: [] });
    for (const b of missing) appendItem(sections[sections.length - 1], b.id);
  }
  return { sections };
}

/**
 * Sobe cada bloco ate encostar no de cima (como a grade do editor faz): bloco
 * removido ou invalido nao deixa buraco na pagina.
 */
function compactUp(items: SiteLayoutItem[]): SiteLayoutItem[] {
  const placed: SiteLayoutItem[] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const above = placed.filter((p) => p.x < it.x + it.w && it.x < p.x + p.w);
    placed.push({ ...it, y: above.reduce((max, p) => Math.max(max, p.y + p.h), 0) });
  }
  const pos = new Map(placed.map((p) => [p.id, p.y]));
  return items.map((it) => ({ ...it, y: pos.get(it.id)! }));
}

/** Ordem de leitura dos blocos (secao, linha, coluna): e a ordem no celular. */
export function readingOrder(layout: SiteLayout): string[] {
  return layout.sections.flatMap((s) => [...s.items].sort((a, b) => a.y - b.y || a.x - b.x).map((it) => it.id));
}

/** Tipos que o cliente pode preencher num formulario publico. */
export const FORM_FIELD_TYPES = new Set([
  'text', 'textarea', 'number', 'currency', 'percentage', 'rating', 'date', 'datetime', 'time',
  'select', 'multiselect', 'radio-group', 'checkbox-group', 'boolean', 'tags',
  'phone', 'email', 'cpf', 'cnpj', 'cep', 'url', 'image', 'file',
]);
/** Tipos que podem aparecer no acompanhamento. */
export const TRACK_FIELD_TYPES = new Set([
  ...FORM_FIELD_TYPES, 'relation', 'user-select', 'formula', 'rollup', 'workflow-status',
]);
const NOT_REQUIRED_TYPES = new Set(['section-title', 'sub-entity', 'formula', 'rollup', 'timer', 'sla-status', 'action-button', 'hidden']);
const MAX_BLOCKS = 80;
const MAX_IMAGES = 24;
const MAX_CARDS = 12;
const MAX_CATALOG = 60;

const clip = (s: unknown, max: number): string => String(s ?? '').trim().slice(0, max);
const safeUrl = (u: unknown): string => {
  const url = clip(u, 1000);
  if (/^#[a-zA-Z0-9_-]{1,40}$/.test(url)) return url; // outra parte da mesma pagina
  if (/^[a-z0-9][a-z0-9-]{0,79}$/.test(url)) return url; // outra pagina do site (pelo endereco dela)
  return /^(https?:\/\/|mailto:|tel:|\/)/i.test(url) && !/^\/\//.test(url) ? url : '';
};

export interface RawField {
  slug: string;
  label?: string;
  name?: string;
  type: string;
  required?: boolean;
  options?: Array<string | { value: string; label: string; color?: string }>;
  placeholder?: string;
  helpText?: string;
  multiple?: boolean;
  /** Valor padrao: campo obrigatorio com padrao nao precisa estar no formulario. */
  default?: unknown;
}

export { hasDefault, resolveDefault } from '../../common/utils/field-defaults';

/** Campos obrigatorios da tabela que o cliente teria de preencher (os com padrao se preenchem sozinhos). */
export function requiredFields(rawFields: RawField[], statusField?: string): RawField[] {
  return rawFields.filter((f) => f.required && !NOT_REQUIRED_TYPES.has(f.type) && f.slug !== statusField && !hasDefault(f));
}

export interface NormalizeContext {
  tables: SchemaTable[];
  rawFieldsBySlug: Map<string, RawField[]>;
  pdfTemplates: Array<{ id: string; sourceEntityId: string | null }>;
}

/**
 * Valida os blocos vindos do editor. Erros que deixariam a pagina quebrada
 * (formulario sem campo obrigatorio, tabela inexistente) recusam o salvamento.
 */
export function normalizeBlocks(raw: unknown, ctx: NormalizeContext): SiteBlock[] {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_BLOCKS) : [];
  const bySlug = new Map(ctx.tables.map((t) => [t.slug, t]));
  const ids = new Set<string>();
  const out: SiteBlock[] = [];
  let tracking = 0;

  for (const [index, item] of list.entries()) {
    const b = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const type = String(b.type) as SiteBlockType;
    if (!(SITE_BLOCK_TYPES as readonly string[]).includes(type)) continue;
    let id = clip(b.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || `${type}-${index + 1}`;
    while (ids.has(id)) id = `${id}-${index + 1}`;
    ids.add(id);

    switch (type) {
      case 'heading': {
        const text = clip(b.text, 160);
        out.push({ id, type, text, size: b.size === 'md' ? 'md' : 'lg' });
        break;
      }
      case 'text': {
        const doc = normalizeRichDoc(b.doc, safeUrl);
        const text = doc ? richPlainText(doc).slice(0, 20000) : clip(b.text, 4000);
        out.push({ id, type, text, ...(doc ? { doc } : {}) });
        break;
      }
      case 'image': {
        const url = safeUrl(b.url);
        out.push({ id, type, url, ...(clip(b.alt, 160) ? { alt: clip(b.alt, 160) } : {}) });
        break;
      }
      case 'button': {
        const label = clip(b.label, 60);
        const url = safeUrl(b.url);
        out.push({ id, type, label, url });
        break;
      }
      case 'divider':
        out.push({ id, type });
        break;
      case 'form': {
        const table = bySlug.get(clip(b.entitySlug, 100));
        if (!table) throw new BadRequestException('Formulário: escolha a tabela onde as respostas serão guardadas.');
        let parent: ParentForm | undefined;
        if (table.parentSlug) {
          const top = bySlug.get(table.parentSlug);
          if (!top || top.parentSlug) {
            throw new BadRequestException(`Formulário: ${table.namePlural} fica dentro de uma lista que também está dentro de outra; escolha uma tabela de até um nível.`);
          }
          parent = normalizeParent(b.parent, top, ctx);
        }
        const allowed = new Map(table.fields.filter((f) => FORM_FIELD_TYPES.has(f.type)).map((f) => [f.slug, f]));
        const fields = uniq(asStrings(b.fields).filter((s) => allowed.has(s)));
        if (fields.length === 0) throw new BadRequestException('Formulário: escolha pelo menos um campo.');
        const missing = requiredFields(ctx.rawFieldsBySlug.get(table.slug) || [], table.statusField).filter((f) => !fields.includes(f.slug));
        if (missing.length) {
          throw new BadRequestException(`Formulário: os campos obrigatórios de ${table.namePlural} precisam estar no formulário: ${missing.map((f) => f.label || f.slug).join(', ')}.`);
        }
        out.push({
          id, type, entitySlug: table.slug, fields,
          submitLabel: clip(b.submitLabel, 40) || 'Enviar',
          successMessage: clip(b.successMessage, 400) || 'Recebemos suas informações. Obrigado!',
          showTrackingLink: b.showTrackingLink !== false,
          ...(parent ? { parent } : {}),
        });
        break;
      }
      case 'hero': {
        const title = clip(b.title, 120);
        const imageUrl = safeUrl(b.imageUrl);
        const buttonLabel = clip(b.buttonLabel, 40);
        const buttonUrl = safeUrl(b.buttonUrl);
        const text = clip(b.text, 400);
        out.push({
          id, type, title, ...(text ? { text } : {}), ...(imageUrl ? { imageUrl } : {}),
          ...(buttonLabel && buttonUrl ? { buttonLabel, buttonUrl } : {}),
        });
        break;
      }
      case 'gallery': {
        const images = (Array.isArray(b.images) ? b.images : []).slice(0, MAX_IMAGES).map((i) => {
          const img = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
          const url = safeUrl(img.url);
          const caption = clip(img.caption, 80);
          return url ? { url, ...(caption ? { caption } : {}) } : null;
        }).filter((i): i is GalleryImage => !!i);
        const layout = b.layout === 'grid' || b.layout === 'mosaic' ? b.layout : 'polaroid';
        const title = clip(b.title, 120);
        out.push({ id, type, layout, images, ...(title ? { title } : {}) });
        break;
      }
      case 'cards': {
        const items = (Array.isArray(b.items) ? b.items : []).slice(0, MAX_CARDS).map((i) => {
          const it = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
          const t = clip(it.title, 80);
          if (!t) return null;
          const text = clip(it.text, 400);
          const imageUrl = safeUrl(it.imageUrl);
          const badge = clip(it.badge, 24);
          return { title: t, ...(text ? { text } : {}), ...(imageUrl ? { imageUrl } : {}), ...(badge ? { badge } : {}) };
        }).filter((i): i is CardItem => !!i);
        const columns = [1, 2, 3].includes(Number(b.columns)) ? (Number(b.columns) as 1 | 2 | 3) : Math.min(3, items.length) as 1 | 2 | 3;
        const title = clip(b.title, 120);
        out.push({ id, type, columns, items, ...(title ? { title } : {}) });
        break;
      }
      case 'quote': {
        const text = clip(b.text, 500);
        const author = clip(b.author, 80);
        out.push({ id, type, text, ...(author ? { author } : {}) });
        break;
      }
      case 'catalog': {
        const table = bySlug.get(clip(b.entitySlug, 100));
        if (!table) throw new BadRequestException('Vitrine: escolha a tabela que vai aparecer.');
        if (table.parentSlug) throw new BadRequestException(`Vitrine: ${table.namePlural} fica dentro de outra tabela; escolha uma tabela principal.`);
        const field = (slug: unknown, types: string[]) => {
          const f = table.fields.find((x) => x.slug === clip(slug, 100));
          return f && types.includes(f.type) ? f.slug : undefined;
        };
        const titleField = field(b.titleField, CATALOG_TEXT) ?? field(table.titleField, CATALOG_TEXT);
        if (!titleField) throw new BadRequestException('Vitrine: escolha o campo com o nome de cada item.');
        const opt = {
          imageField: field(b.imageField, ['image']),
          priceField: field(b.priceField, ['currency', 'number']),
          descriptionField: field(b.descriptionField, ['text', 'textarea']),
          groupField: field(b.groupField, ['select', 'radio-group']),
          onlyField: field(b.onlyField, ['boolean']),
        };
        const limit = Math.min(MAX_CATALOG, Math.max(1, Number(b.limit) || 30));
        const title = clip(b.title, 120);
        out.push({
          id, type, entitySlug: table.slug, titleField, limit, ...(title ? { title } : {}),
          ...Object.fromEntries(Object.entries(opt).filter(([, v]) => v)),
        } as CatalogBlock);
        break;
      }
      case 'tracking': {
        if (++tracking > 1) throw new BadRequestException('A página pode ter só um bloco de acompanhamento.');
        const table = bySlug.get(clip(b.entitySlug, 100));
        if (!table) throw new BadRequestException('Acompanhamento: escolha a tabela do registro que o cliente vai acompanhar.');
        const byField = new Map(table.fields.map((f) => [f.slug, f]));
        const fields = uniq(asStrings(b.fields).filter((s) => TRACK_FIELD_TYPES.has(byField.get(s)?.type ?? '')));
        const timeline = byField.get(clip(b.timelineField, 100));
        const uploads = uniq(asStrings(b.uploadFields).filter((s) => ['image', 'file'].includes(byField.get(s)?.type ?? '')));
        const pdf = ctx.pdfTemplates.find((p) => p.id === clip(b.pdfTemplateId, 60) && p.sourceEntityId === table.id);
        out.push({
          id, type, entitySlug: table.slug, fields,
          ...(timeline?.type === 'sub-entity' && timeline.subEntitySlug ? { timelineField: timeline.slug } : {}),
          ...(uploads.length ? { uploadFields: uploads } : {}),
          ...(pdf ? { pdfTemplateId: pdf.id } : {}),
        });
        break;
      }
      default: {
        const extra = normalizeExtraBlock(type, b, id, { clip, safeUrl });
        if (extra) out.push(extra);
      }
    }
  }
  return out;
}

/**
 * Bloco ainda incompleto (rascunho do editor): fica guardado, mas nao aparece
 * na pagina publicada. Devolve o que falta.
 */
export function missingPart(b: SiteBlock): string | null {
  switch (b.type) {
    case 'heading': case 'text': case 'quote': return b.text ? null : 'o texto';
    case 'image': return b.url ? null : 'a foto';
    case 'button': return !b.url ? 'o link' : !b.label ? 'o texto' : null;
    case 'hero': return b.title ? null : 'o título';
    case 'gallery': return b.images.length ? null : 'as fotos';
    case 'cards': return b.items.length ? null : 'os cartões';
    default: return missingExtra(b as ExtraBlock);
  }
}

/** Campos que podem ser o nome de um item na vitrine. */
const CATALOG_TEXT = ['text', 'textarea', 'select'];

/** Tipos que identificam o registro de cima (para reaproveitar um que ja existe). */
export const MATCH_FIELD_TYPES = new Set(['text', 'cpf', 'cnpj', 'email', 'phone']);

function normalizeParent(raw: unknown, top: SchemaTable, ctx: NormalizeContext): ParentForm {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const allowed = new Set(top.fields.filter((f) => FORM_FIELD_TYPES.has(f.type)).map((f) => f.slug));
  const fields = uniq(asStrings(p.fields).filter((s) => allowed.has(s)));
  const missing = requiredFields(ctx.rawFieldsBySlug.get(top.slug) || [], top.statusField).filter((f) => !fields.includes(f.slug));
  if (missing.length) {
    throw new BadRequestException(`Formulário: os campos obrigatórios de ${top.namePlural} precisam estar no formulário: ${missing.map((f) => f.label || f.slug).join(', ')}.`);
  }
  if (fields.length === 0) throw new BadRequestException(`Formulário: escolha os dados de ${top.name} que o cliente preenche.`);
  const match = clip(p.matchField, 100);
  const matchField = fields.includes(match) && MATCH_FIELD_TYPES.has(top.fields.find((f) => f.slug === match)?.type ?? '') ? match : undefined;
  const title = clip(p.title, 80);
  return { entitySlug: top.slug, fields, ...(matchField ? { matchField } : {}), ...(title ? { title } : {}) };
}

/** Campo que melhor identifica alguem (CPF/CNPJ/e-mail), para sugerir na pagina nova. */
export function suggestMatchField(top: SchemaTable): string | undefined {
  const byType = (t: string) => top.fields.find((f) => f.type === t)?.slug;
  return byType('cpf') ?? byType('cnpj')
    ?? top.fields.find((f) => f.type === 'text' && /cpf|cnpj|documento/i.test(`${f.slug} ${f.label}`))?.slug
    ?? byType('email') ?? byType('phone');
}

function asStrings(v: unknown): string[] {
  return (Array.isArray(v) ? v : []).map((s) => clip(s, 100)).filter(Boolean);
}
function uniq(v: string[]): string[] {
  return [...new Set(v)];
}

/** O que um campo mostra para fora (nunca o valor; so a definicao). */
export function publicField(f: RawField) {
  return {
    slug: f.slug,
    label: f.label || f.name || f.slug,
    type: f.type,
    required: !!f.required,
    ...(f.placeholder ? { placeholder: f.placeholder } : {}),
    ...(f.helpText ? { helpText: f.helpText } : {}),
    ...(f.multiple ? { multiple: true } : {}),
    ...(f.options?.length
      ? { options: f.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label, ...(o.color ? { color: o.color } : {}) })) }
      : {}),
  };
}

export type { SchemaField };
