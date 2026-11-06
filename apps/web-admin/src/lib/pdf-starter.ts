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
