import type { Entity, EntityField } from '@/types';
import type { FieldFormat, PdfElement } from '@/services/pdf-templates.service';
import { withoutSystemFields } from './system-fields';

/** Tipos que viram "Rótulo: valor" na ficha. */
const SIMPLE_TYPES = new Set([
  'text', 'number', 'currency', 'percentage', 'rating', 'slider', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep',
  'date', 'datetime', 'time', 'boolean', 'select', 'multiselect', 'radio-group', 'checkbox-group', 'tags',
  'relation', 'user-select', 'formula', 'rollup', 'color',
]);
const LONG_TEXT = new Set(['textarea', 'richtext']);
const PICTURES = new Set(['image', 'signature']);

const FORMAT_BY_TYPE: Record<string, FieldFormat> = {
  currency: 'currency', date: 'date', datetime: 'datetime', percentage: 'percentage', number: 'number',
} as Record<string, FieldFormat>;

const label = (f: EntityField) => f.label || f.name || f.slug;

/**
 * Ficha pronta para um PDF novo de "1 documento por registro": título com o nome do
 * registro, os campos em duas colunas, textos longos, listas de itens em tabela,
 * fotos e assinaturas. A pessoa só ajusta, em vez de montar do zero.
 */
export function buildStarterPdfBody(entity: Entity, allEntities: Entity[]): { title: string; body: PdfElement[] } {
  const fields = withoutSystemFields(entity.fields as EntityField[]);
  const titleSlug = (entity.settings as { titleField?: string } | undefined)?.titleField
    ?? fields.find((f) => f.type === 'text')?.slug;
  const body: PdfElement[] = [];
  let n = 0;
  const id = (p: string) => `${p}-${++n}`;

  // Campos simples em blocos, quebrando nos titulos de secao
  let group: EntityField[] = [];
  const flush = () => {
    if (group.length === 0) return;
    body.push({
      id: id('campos'), type: 'field-group', layout: 'grid', columns: 2,
      labelFontSize: 9, valueFontSize: 10, lineSpacing: 18, marginTop: 4,
      fields: group.map((f) => ({ label: `${label(f)}:`, binding: `{{${f.slug}}}`, labelBold: true, format: FORMAT_BY_TYPE[f.type] })),
    } as PdfElement);
    group = [];
  };

  for (const f of fields) {
    if (f.type === 'section-title') {
      flush();
      body.push({ id: id('secao'), type: 'text', content: label(f), fontSize: 11, fontWeight: 'bold', marginTop: 10, marginBottom: 2 } as PdfElement);
    } else if (SIMPLE_TYPES.has(f.type)) {
      group.push(f);
    } else if (LONG_TEXT.has(f.type)) {
      flush();
      body.push({ id: id('texto'), type: 'text', content: `${label(f)}: {{${f.slug}}}`, fontSize: 9, marginTop: 6 } as PdfElement);
    } else if (f.type === 'sub-entity') {
      flush();
      const child = allEntities.find((e) => e.slug === f.subEntitySlug || e.id === f.subEntityId);
      const childFields = withoutSystemFields((child?.fields || []) as EntityField[])
        .filter((cf) => SIMPLE_TYPES.has(cf.type))
        .slice(0, 6);
      if (childFields.length === 0) continue;
      body.push({ id: id('titulo'), type: 'text', content: label(f), fontSize: 11, fontWeight: 'bold', marginTop: 10, marginBottom: 4 } as PdfElement);
      body.push({
        id: id('tabela'), type: 'table', dataSource: f.slug, showHeader: true, emptyMessage: 'Nenhum item',
        headerStyle: { bold: true, fontSize: 8 }, cellStyle: { fontSize: 8 },
        columns: childFields.map((cf) => ({
          field: cf.slug, header: label(cf), align: ['currency', 'number', 'percentage'].includes(cf.type) ? 'right' : 'left',
          format: FORMAT_BY_TYPE[cf.type],
        })),
      } as PdfElement);
    }
  }
  flush();

  // Fotos e assinaturas no fim, duas por linha
  const pictures = fields.filter((f) => PICTURES.has(f.type));
  if (pictures.length > 0) {
    body.push({ id: id('div'), type: 'divider', marginTop: 8, marginBottom: 4 } as PdfElement);
    body.push({
      id: id('fotos'), type: 'image-grid', columns: 2, marginTop: 8, imageWidth: 180, imageHeight: 120, showCaptions: true,
      dataSource: '_sem_filhos', imageFields: [pictures[0].slug],
      parentImageFields: pictures.map((f) => f.slug), captionFields: pictures.map((f) => label(f)), captionFontSize: 7,
    } as PdfElement);
  }

  return { title: titleSlug ? `${entity.name} {{${titleSlug}}}` : entity.name, body };
}

/**
 * Um elemento de PDF ja ligado aos campos da tabela (no lugar de "{{campo}}" e
 * "Coluna 1"). Usado ao adicionar e na previa do "?". null = a tabela nao tem
 * o que esse elemento precisa (ex.: lista de itens para a Tabela).
 */
export function smartPdfElement(type: string, entity: Entity | undefined, allEntities: Entity[]): PdfElement | null {
  const id = `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fields = withoutSystemFields((entity?.fields || []) as EntityField[]);
  const simple = fields.filter((f) => SIMPLE_TYPES.has(f.type));
  switch (type) {
    case 'text': {
      const long = fields.find((f) => LONG_TEXT.has(f.type)) ?? simple[0];
      return { id, type: 'text', content: long ? `${label(long)}: {{${long.slug}}}` : 'Texto do documento', fontSize: 10, align: 'left' } as PdfElement;
    }
    case 'field-group':
      if (simple.length === 0) return null;
      return {
        id, type: 'field-group', layout: 'grid', columns: 2, labelFontSize: 9, valueFontSize: 10, lineSpacing: 18,
        fields: simple.slice(0, 6).map((f) => ({ label: `${label(f)}:`, binding: `{{${f.slug}}}`, labelBold: true, format: FORMAT_BY_TYPE[f.type] })),
      } as PdfElement;
    case 'table': {
      const sub = fields.find((f) => f.type === 'sub-entity');
      const child = sub && allEntities.find((e) => e.slug === sub.subEntitySlug || e.id === sub.subEntityId);
      const cols = withoutSystemFields((child?.fields || []) as EntityField[]).filter((cf) => SIMPLE_TYPES.has(cf.type)).slice(0, 5);
      if (!sub || cols.length === 0) return null;
      return {
        id, type: 'table', title: label(sub), dataSource: sub.slug, showHeader: true, emptyMessage: 'Nenhum item',
        headerStyle: { bold: true, fontSize: 8 }, cellStyle: { fontSize: 8 },
        columns: cols.map((cf) => ({ field: cf.slug, header: label(cf), align: ['currency', 'number', 'percentage'].includes(cf.type) ? 'right' : 'left', format: FORMAT_BY_TYPE[cf.type] })),
      } as PdfElement;
    }
    case 'image-grid': {
      const pics = fields.filter((f) => PICTURES.has(f.type));
      if (pics.length === 0) return null;
      return {
        id, type: 'image-grid', columns: 2, imageWidth: 180, imageHeight: 120, showCaptions: true, dataSource: '_sem_filhos',
        imageFields: [pics[0].slug], parentImageFields: pics.map((f) => f.slug), captionFields: pics.map((f) => label(f)), captionFontSize: 7,
      } as PdfElement;
    }
    case 'statistics': {
      const group = fields.find((f) => ['select', 'radio-group'].includes(f.type));
      if (!group) return null;
      return { id, type: 'statistics', title: `Por ${label(group).toLowerCase()}`, groupBy: [group.slug], metrics: [{ field: '_count', aggregation: 'count', label: 'Total' }] } as PdfElement;
    }
    case 'divider': return { id, type: 'divider', color: '#cccccc', thickness: 1 } as PdfElement;
    case 'spacer': return { id, type: 'spacer', height: 20 } as PdfElement;
    default: return null;
  }
}
