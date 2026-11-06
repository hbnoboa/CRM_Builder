import { BadRequestException } from '@nestjs/common';
import type { SchemaField, SchemaTable } from '../ai-builder/tenant-schema';

/**
 * Blocos das paginas para clientes. A pagina e a unica coisa que decide o que sai
 * para fora: so os campos listados em cada bloco sao mostrados ou aceitos.
 */

export const SITE_BLOCK_TYPES = ['heading', 'text', 'image', 'button', 'divider', 'form', 'tracking'] as const;
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
export type SiteBlock = HeadingBlock | TextBlock | ImageBlock | ButtonBlock | DividerBlock | FormBlock | TrackingBlock;

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
const MAX_BLOCKS = 30;

const clip = (s: unknown, max: number): string => String(s ?? '').trim().slice(0, max);
const safeUrl = (u: unknown): string => {
  const url = clip(u, 1000);
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
        if (table.parentSlug) throw new BadRequestException(`Formulário: ${table.namePlural} é uma lista dentro de outra tabela; escolha uma tabela principal.`);
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
        });
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
