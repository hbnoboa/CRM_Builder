import { BadRequestException } from '@nestjs/common';
import type { SchemaField, SchemaTable } from '../ai-builder/tenant-schema';

/**
 * Blocos das paginas para clientes. A pagina e a unica coisa que decide o que sai
 * para fora: so os campos listados em cada bloco sao mostrados ou aceitos.
 */

export const SITE_BLOCK_TYPES = [
  'heading', 'text', 'image', 'button', 'divider', 'form', 'tracking',
  'hero', 'gallery', 'cards', 'quote', 'catalog',
] as const;
export type SiteBlockType = (typeof SITE_BLOCK_TYPES)[number];

export interface HeadingBlock { id: string; type: 'heading'; text: string; size?: 'lg' | 'md' }
export interface TextBlock { id: string; type: 'text'; text: string }
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
  | HeroBlock | GalleryBlock | CardsBlock | QuoteBlock | CatalogBlock;

// ── Aparencia da pagina ──────────────────────────────────────────────────

export const SITE_STYLES = ['classic', 'scrapbook'] as const;
export const SITE_BACKGROUNDS = ['plain', 'dots', 'hearts', 'stars', 'stripes', 'grid'] as const;
export interface SitePageSettings {
  /** classic: limpo e corporativo; scrapbook: colorido, fotos em polaroide (estilo Tumblr antigo). */
  style: (typeof SITE_STYLES)[number];
  background: (typeof SITE_BACKGROUNDS)[number];
  /** Cor de destaque so desta pagina (senao, a cor da empresa). */
  accent?: string;
  /** Foto de capa no topo da pagina. */
  coverUrl?: string;
  /** Frase curta embaixo do nome da empresa. */
  tagline?: string;
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
  return { style, background, ...(accent ? { accent } : {}), ...(coverUrl ? { coverUrl } : {}), ...(tagline ? { tagline } : {}) };
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
const MAX_BLOCKS = 40;
const MAX_IMAGES = 24;
const MAX_CARDS = 12;
const MAX_CATALOG = 60;

const clip = (s: unknown, max: number): string => String(s ?? '').trim().slice(0, max);
const safeUrl = (u: unknown): string => {
  const url = clip(u, 1000);
  if (/^#[a-zA-Z0-9_-]{1,40}$/.test(url)) return url; // outra parte da mesma pagina
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
}

/** Campos obrigatorios da tabela que o cliente teria de preencher. */
export function requiredFields(rawFields: RawField[], statusField?: string): RawField[] {
  return rawFields.filter((f) => f.required && !NOT_REQUIRED_TYPES.has(f.type) && f.slug !== statusField);
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
        if (text) out.push({ id, type, text, size: b.size === 'md' ? 'md' : 'lg' });
        break;
      }
      case 'text': {
        const text = clip(b.text, 4000);
        if (text) out.push({ id, type, text });
        break;
      }
      case 'image': {
        const url = safeUrl(b.url);
        if (url) out.push({ id, type, url, ...(clip(b.alt, 160) ? { alt: clip(b.alt, 160) } : {}) });
        break;
      }
      case 'button': {
        const label = clip(b.label, 60);
        const url = safeUrl(b.url);
        if (label && url) out.push({ id, type, label, url });
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
        if (!title) break;
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
        if (!images.length) break;
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
        if (!items.length) break;
        const columns = [1, 2, 3].includes(Number(b.columns)) ? (Number(b.columns) as 1 | 2 | 3) : Math.min(3, items.length) as 1 | 2 | 3;
        const title = clip(b.title, 120);
        out.push({ id, type, columns, items, ...(title ? { title } : {}) });
        break;
      }
      case 'quote': {
        const text = clip(b.text, 500);
        const author = clip(b.author, 80);
        if (text) out.push({ id, type, text, ...(author ? { author } : {}) });
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
    }
  }
  return out;
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
