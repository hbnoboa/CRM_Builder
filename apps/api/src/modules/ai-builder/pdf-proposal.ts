import type { SchemaField, SchemaTable } from './tenant-schema';

/**
 * Assistente de PDF: a IA descreve o documento em secoes simples (campos, texto,
 * lista de itens, fotos, assinatura) e o servidor monta o modelo real, conferindo
 * cada campo da tabela. Um documento por registro.
 */

export const AI_PDF_SECTION_KINDS = ['heading', 'fields', 'text', 'items', 'photos', 'signature', 'divider'] as const;
type SectionKind = (typeof AI_PDF_SECTION_KINDS)[number];

export interface AiPdfSection {
  kind: SectionKind;
  title?: string;
  fields?: string[];
  columns?: number;
  text?: string;
  field?: string;
}

export interface AiPdfProposal {
  reply: string;
  name: string;
  description: string;
  table: string;
  title: string;
  fileName?: string;
  sections: AiPdfSection[];
}

export const AI_PDF_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    table: { type: 'string' },
    title: { type: 'string' },
    fileName: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...AI_PDF_SECTION_KINDS] },
          title: { type: 'string' },
          fields: { type: 'array', items: { type: 'string' } },
          columns: { type: 'integer', enum: [1, 2, 3] },
          text: { type: 'string' },
          field: { type: 'string' },
        },
        required: ['kind'],
        additionalProperties: false,
      },
    },
  },
  required: ['reply', 'name', 'description', 'table', 'title', 'sections'],
  additionalProperties: false,
};

export const AI_PDF_SYSTEM_PROMPT = `Você é o assistente do CRM Builder que monta MODELOS DE PDF (relatórios, laudos, fichas, ordens de serviço, recibos) para empresas brasileiras. Cada PDF é gerado a partir de UM registro de uma tabela. Quem conversa com você não é programador.

Você recebe a tabela escolhida e as demais com os campos (identificador, tipo, opções). Use SÓ esses identificadores. Nunca invente campos.

Monte o documento em seções ("sections"), na ordem em que aparecem:
- heading: um subtítulo em negrito ("title").
- fields: pares "Rótulo: valor" em colunas. "fields" = lista de campos; "columns" = 1, 2 ou 3 (2 é o normal). "title" opcional vira subtítulo antes.
- text: um parágrafo. "text" pode misturar texto fixo e campos entre chaves duplas, ex.: "Declaro que recebi o veículo {{placa}} em {{data_entrega}}." Bom para textos longos do registro, declarações e observações.
- items: tabela com a lista que fica dentro do registro. "field" = o campo do tipo sub-entity desta tabela; "fields" = colunas (campos da tabela da lista); "title" = subtítulo.
- photos: fotos do registro em grade. "fields" = campos do tipo image; "columns" = 2 ou 3.
- signature: assinatura. "field" = campo do tipo signature; "title" = legenda (ex.: "Assinatura do cliente").
- divider: linha separadora.

Campos do registro "de cima" (quando a tabela é uma lista dentro de outra) se escrevem "_parent.<campo>", ex.: "_parent.nome" — em "fields", em "text" e no "title".

Como montar:
- "title": título no topo de cada página, com campo identificador, ex.: "Ordem de serviço {{numero}}".
- "fileName": nome do arquivo com campos entre chaves simples, ex.: "OS-{numero}".
- Agrupe por assunto com subtítulos (Cliente, Serviço, Valores, Fotos...). Documento enxuto e profissional; não precisa usar todos os campos.
- Não coloque datas de criação/atualização do sistema.

Conversa:
- Devolva sempre o documento COMPLETO atualizado. Mudanças pedidas mantêm o resto igual.
- Se o pedido for vago, monte uma primeira versão útil e faça no máximo 2 perguntas curtas na "reply".
- "reply": 1 a 4 frases, sem termos técnicos.`;

const SIMPLE = new Set([
  'text', 'number', 'currency', 'percentage', 'rating', 'slider', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep',
  'date', 'datetime', 'time', 'boolean', 'select', 'multiselect', 'radio-group', 'checkbox-group', 'tags',
  'relation', 'user-select', 'formula', 'rollup', 'color', 'textarea', 'richtext',
]);
const FORMAT: Record<string, string> = { currency: 'currency', date: 'date', datetime: 'datetime', percentage: 'percentage', number: 'number' };
const RIGHT = new Set(['currency', 'number', 'percentage']);
const MAX_SECTIONS = 30;

export interface NormalizedPdf {
  reply: string;
  warnings: string[];
  proposal: AiPdfProposal;
  table: SchemaTable;
  name: string;
  description: string;
  content: Record<string, unknown>;
}

const clip = (s: unknown, max: number): string => String(s ?? '').trim().slice(0, max);

/**
 * Valida o pedido da IA e devolve o conteudo do modelo. Campos que nao existem
 * saem (com aviso); textos com {{campo}} desconhecido perdem so o campo.
 */
export function normalizePdf(raw: unknown, tables: SchemaTable[], preferredTable?: string): NormalizedPdf {
  const warnings: string[] = [];
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<AiPdfProposal>;
  const bySlug = new Map(tables.map((t) => [t.slug, t]));
  const table = (preferredTable ? bySlug.get(preferredTable) : undefined)
    ?? (typeof input.table === 'string' ? bySlug.get(input.table.trim()) : undefined);
  if (!table) throw new Error('sem-tabela');
  const parent = table.parentSlug ? bySlug.get(table.parentSlug) : undefined;

  /** "campo" ou "_parent.campo" -> { binding, field } */
  const resolve = (ref: unknown): { path: string; field: SchemaField } | null => {
    if (typeof ref !== 'string') return null;
    const key = ref.trim().replace(/^\{\{|\}\}$/g, '').trim();
    const isParent = key.startsWith('_parent.');
    const source = isParent ? parent : table;
    if (!source) return null;
    const name = (isParent ? key.slice('_parent.'.length) : key).toLowerCase();
    const field = source.fields.find((f) => f.slug.toLowerCase() === name) ?? source.fields.find((f) => f.label.toLowerCase() === name);
    return field ? { path: isParent ? `_parent.${field.slug}` : field.slug, field } : null;
  };
  /** Troca {{x}} desconhecido por nada e corrige os conhecidos. */
  const template = (text: string, where: string) =>
    text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, ref: string) => {
      const r = resolve(ref);
      if (!r) {
        warnings.push(`${where}: o campo "${ref}" não existe e saiu do texto.`);
        return '';
      }
      return `{{${r.path}}}`;
    });

  const body: Array<Record<string, unknown>> = [];
  const clean: AiPdfSection[] = [];
  let n = 0;
  const id = (p: string) => `${p}-${++n}`;
  const heading = (text: string) => body.push({ id: id('titulo'), type: 'text', content: text, fontSize: 11, fontWeight: 'bold', marginTop: 10, marginBottom: 4 });

  for (const s of (Array.isArray(input.sections) ? input.sections : []).slice(0, MAX_SECTIONS)) {
    const kind = (AI_PDF_SECTION_KINDS as readonly string[]).includes(String(s?.kind)) ? (s.kind as SectionKind) : null;
    const title = clip(s?.title, 80);
    if (!kind) continue;
    switch (kind) {
      case 'heading':
        if (!title) break;
        heading(title);
        clean.push({ kind, title });
        break;
      case 'divider':
        body.push({ id: id('linha'), type: 'divider', marginTop: 6, marginBottom: 6 });
        clean.push({ kind });
        break;
      case 'text': {
        const text = template(clip(s.text, 2000), title || 'Texto');
        if (!text.trim()) break;
        if (title) heading(title);
        body.push({ id: id('texto'), type: 'text', content: text, fontSize: 9, marginTop: 4 });
        clean.push({ kind, ...(title ? { title } : {}), text });
        break;
      }
      case 'fields': {
        const picked = (Array.isArray(s.fields) ? s.fields : []).map(resolve).filter((r): r is NonNullable<typeof r> => !!r && SIMPLE.has(r.field.type));
        const missing = (Array.isArray(s.fields) ? s.fields : []).length - picked.length;
        if (missing > 0) warnings.push(`${title || 'Campos'}: ${missing} campo(s) não existem ou não cabem como texto e saíram.`);
        if (picked.length === 0) break;
        const columns = [1, 2, 3].includes(Number(s.columns)) ? Number(s.columns) : 2;
        if (title) heading(title);
        body.push({
          id: id('campos'), type: 'field-group', layout: 'grid', columns, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, marginTop: 4,
          fields: picked.map((r) => ({
            label: `${r.field.label}:`, binding: `{{${r.path}}}`, labelBold: true, ...(FORMAT[r.field.type] ? { format: FORMAT[r.field.type] } : {}),
          })),
        });
        clean.push({ kind, ...(title ? { title } : {}), fields: picked.map((r) => r.path), columns });
        break;
      }
      case 'items': {
        const sub = table.fields.find((f) => f.type === 'sub-entity' && (f.slug === s.field || f.subEntitySlug === s.field))
          ?? table.fields.find((f) => f.type === 'sub-entity');
        const child = sub?.subEntitySlug ? bySlug.get(sub.subEntitySlug) : undefined;
        if (!sub || !child) {
          warnings.push(`${title || 'Lista de itens'}: ${table.namePlural} não tem lista de itens; a seção saiu.`);
          break;
        }
        const wanted = (Array.isArray(s.fields) ? s.fields : [])
          .map((r) => child.fields.find((f) => f.slug === r || f.label.toLowerCase() === String(r).toLowerCase()))
          .filter((f): f is SchemaField => !!f && SIMPLE.has(f.type));
        const cols = (wanted.length ? wanted : child.fields.filter((f) => SIMPLE.has(f.type))).slice(0, 6);
        if (cols.length === 0) break;
        const t = title || sub.label;
        heading(t);
        body.push({
          id: id('tabela'), type: 'table', dataSource: sub.slug, showHeader: true, emptyMessage: 'Nenhum item',
          headerStyle: { bold: true, fontSize: 8 }, cellStyle: { fontSize: 8 },
          columns: cols.map((f) => ({ field: f.slug, header: f.label, align: RIGHT.has(f.type) ? 'right' : 'left', ...(FORMAT[f.type] ? { format: FORMAT[f.type] } : {}) })),
        });
        clean.push({ kind, title: t, field: sub.slug, fields: cols.map((f) => f.slug) });
        break;
      }
      case 'photos':
      case 'signature': {
        const allowed = kind === 'photos' ? 'image' : 'signature';
        const refs = kind === 'photos' ? (Array.isArray(s.fields) ? s.fields : []) : [s.field];
        let pics = refs.map((r) => table.fields.find((f) => f.slug === r || f.label.toLowerCase() === String(r ?? '').toLowerCase()))
          .filter((f): f is SchemaField => !!f && f.type === allowed);
        if (pics.length === 0) pics = table.fields.filter((f) => f.type === allowed).slice(0, kind === 'photos' ? 6 : 1);
        if (pics.length === 0) {
          warnings.push(`${title || (kind === 'photos' ? 'Fotos' : 'Assinatura')}: a tabela não tem campo de ${kind === 'photos' ? 'foto' : 'assinatura'}; a seção saiu.`);
          break;
        }
        const columns = kind === 'signature' ? 2 : Number(s.columns) === 3 ? 3 : 2;
        if (kind === 'photos' && title) heading(title);
        body.push({
          id: id(kind === 'photos' ? 'fotos' : 'assinatura'), type: 'image-grid', columns, marginTop: kind === 'photos' ? 8 : 14,
          imageWidth: kind === 'photos' ? (columns === 3 ? 120 : 180) : 160, imageHeight: kind === 'photos' ? (columns === 3 ? 90 : 120) : 60,
          showCaptions: true, dataSource: '_sem_filhos', imageFields: [pics[0].slug], parentImageFields: pics.map((f) => f.slug),
          captionFields: kind === 'signature' && title ? [title] : pics.map((f) => f.label), captionFontSize: 7,
        });
        clean.push(kind === 'photos'
          ? { kind, ...(title ? { title } : {}), fields: pics.map((f) => f.slug), columns }
          : { kind, ...(title ? { title } : {}), field: pics[0].slug });
        break;
      }
    }
  }

  if (body.length === 0) {
    const simple = table.fields.filter((f) => SIMPLE.has(f.type)).slice(0, 12);
    body.push({
      id: id('campos'), type: 'field-group', layout: 'grid', columns: 2, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18,
      fields: simple.map((f) => ({ label: `${f.label}:`, binding: `{{${f.slug}}}`, labelBold: true, ...(FORMAT[f.type] ? { format: FORMAT[f.type] } : {}) })),
    });
    clean.push({ kind: 'fields', fields: simple.map((f) => f.slug), columns: 2 });
    warnings.push('Nenhuma seção pôde ser montada; comecei com os campos principais.');
  }

  const fallbackTitle = table.titleField ? `${table.name} {{${table.titleField}}}` : table.name;
  const title = template(clip(input.title, 120), 'Título') || fallbackTitle;
  const fileName = clip(input.fileName, 80).replace(/\{([^}]+)\}/g, (m, ref: string) => (resolve(ref) ? `{${resolve(ref)!.path}}` : ''))
    || (table.titleField ? `{${table.titleField}}` : '');
  const name = clip(input.name, 80) || table.name;
  const description = clip(input.description, 240);
  const reply = clip(input.reply, 1500) || 'Pronto, veja o PDF ao lado.';
  return {
    reply,
    warnings,
    table,
    name,
    description,
    proposal: { reply, name, description, table: table.slug, title, ...(fileName ? { fileName } : {}), sections: clean },
    content: {
      header: { title: { text: title, bold: true, fontSize: 14 }, showOnAllPages: true },
      body,
      footer: { position: 'right', showPageNumbers: true },
      ...(fileName ? { settings: { fileNamePattern: fileName } } : {}),
    },
  };
}
