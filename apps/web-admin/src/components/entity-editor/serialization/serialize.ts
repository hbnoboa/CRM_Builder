import type { EntityField } from '@crm-builder/shared';
import { entityFieldToGjsProps } from './field-mappers';

/**
 * Estrutura de dados do GrapeJS para armazenamento.
 *
 * `loadProjectData()` aceita `pages[].component` como atalho,
 * mas `getProjectData()` retorna `pages[].frames[].component` (GrapeJS 0.22+).
 * A interface aceita ambos os formatos para compatibilidade.
 */
export interface GjsProjectData {
  pages: Array<{
    component?: GjsComponentDef;
    frames?: Array<{ component?: GjsComponentDef; [key: string]: unknown }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface GjsComponentDef {
  type?: string;
  tagName?: string;
  attributes?: Record<string, string>;
  components?: GjsComponentDef[];
  [key: string]: unknown;
}

/**
 * Converte EntityField[] para GrapeJS ProjectData.
 *
 * Estrutura gerada:
 * - Root wrapper
 *   - grid-row (para cada linha)
 *     - grid-cell (para cada campo, com colSpan)
 *       - crm-field (o campo em si)
 */
export function serializeToGjs(fields: EntityField[]): GjsProjectData {
  if (!fields || fields.length === 0) {
    return {
      pages: [{
        component: {
          type: 'wrapper',
          components: [createEmptyRow()],
        },
      }],
    };
  }

  // Agrupar campos por gridRow
  // Campos sem gridRow recebem rows sequenciais que nao colidem com rows existentes
  const rowMap = new Map<number, EntityField[]>();

  // Primeiro: coletar todas as rows explicitas
  const usedRows = new Set<number>();
  fields.forEach((field) => {
    if (field.gridRow != null) usedRows.add(field.gridRow);
  });

  // Segundo: atribuir rows sequenciais para campos sem gridRow
  let nextRow = 1;
  fields.forEach((field) => {
    let row: number;
    if (field.gridRow != null) {
      row = field.gridRow;
    } else {
      // Encontrar proxima row livre
      while (usedRows.has(nextRow)) nextRow++;
      row = nextRow;
      usedRows.add(row);
      nextRow++;
    }
    if (!rowMap.has(row)) {
      rowMap.set(row, []);
    }
    rowMap.get(row)!.push(field);
  });

  // Ordenar rows
  const sortedRows = Array.from(rowMap.entries()).sort(([a], [b]) => a - b);

  // Construir componentes
  const rowComponents: GjsComponentDef[] = sortedRows.map(([_rowNum, rowFields]) => {
    // Ordenar campos dentro da row por gridColStart
    const sortedFields = [...rowFields].sort(
      (a, b) => (a.gridColStart ?? 0) - (b.gridColStart ?? 0),
    );

    const cellComponents: GjsComponentDef[] = sortedFields.map((field) => {
      const colSpan = field.gridColSpan ?? 12;
      const rowSpan = field.gridRowSpan ?? 1;
      const fieldProps = entityFieldToGjsProps(field);

      const cellClasses = [`grid-cell`, `col-span-${colSpan}`];
      if (rowSpan > 1) cellClasses.push(`row-span-${rowSpan}`);

      return {
        type: 'grid-cell',
        attributes: { class: cellClasses.join(' ') },
        colSpan,
        rowSpan,
        components: [
          {
            type: `crm-field-${field.type}`,
            ...fieldProps,
            // Setar fieldColSpan como string para consistencia com select trait
            fieldColSpan: String(colSpan),
            fieldRowSpan: rowSpan,
          },
        ],
      } as GjsComponentDef;
    });

    return {
      type: 'grid-row',
      attributes: { class: 'grid-row' },
      components: cellComponents,
    } as GjsComponentDef;
  });

  return {
    pages: [{
      component: {
        type: 'wrapper',
        components: rowComponents,
      },
    }],
  };
}

function createEmptyRow(): GjsComponentDef {
  return {
    type: 'grid-row',
    attributes: { class: 'grid-row' },
    components: [],
  };
}
