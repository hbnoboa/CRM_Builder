import type { EntityField } from '@crm-builder/shared';
import { entityFieldToGjsProps } from './field-mappers';

/**
 * Estrutura de dados do GrapeJS para armazenamento.
 * Corresponde ao que `editor.getProjectData()` retorna.
 */
export interface GjsProjectData {
  pages: Array<{
    component: GjsComponentDef;
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
  const rowMap = new Map<number, EntityField[]>();

  fields.forEach((field, index) => {
    const row = field.gridRow ?? index + 1;
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
      const fieldProps = entityFieldToGjsProps(field);

      return {
        type: 'grid-cell',
        attributes: { class: `grid-cell col-span-${colSpan}` },
        colSpan,
        components: [
          {
            type: `crm-field-${field.type}`,
            ...fieldProps,
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
