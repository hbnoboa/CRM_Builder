import type { EntityField } from '@crm-builder/shared';
import type { GjsProjectData, GjsComponentDef } from './serialize';
import { gjsPropsToEntityField } from './field-mappers';

/**
 * Converte GrapeJS ProjectData de volta para EntityField[].
 * Extrai campos dos componentes grid-row > grid-cell > crm-field.
 *
 * GrapeJS 0.22+ retorna `pages[].frames[].component` em `getProjectData()`,
 * mas `loadProjectData()` aceita `pages[].component` como atalho.
 * Esta funcao suporta ambos os formatos para compatibilidade.
 */
export function deserializeFromGjs(projectData: GjsProjectData): EntityField[] {
  const fields: EntityField[] = [];

  if (!projectData?.pages?.[0]) {
    return fields;
  }

  // GrapeJS 0.22+ usa pages[0].frames[0].component no getProjectData(),
  // mas loadProjectData() aceita pages[0].component como atalho.
  // Suportar ambos os formatos.
  const page = projectData.pages[0];
  const framesArr = page.frames as Array<{ component?: GjsComponentDef }> | undefined;
  const root: GjsComponentDef | undefined =
    (page.component as GjsComponentDef | undefined) ?? framesArr?.[0]?.component;

  if (!root) {
    return fields;
  }

  const rows = root.components || [];

  let globalOrder = 0;
  let rowIndex = 1;

  for (const row of rows) {
    if (row.type !== 'grid-row') continue;

    const cells = row.components || [];
    let colStart = 1;

    for (const cell of cells) {
      if (cell.type !== 'grid-cell') continue;

      const colSpan = (cell.colSpan as number) || extractColSpanFromClass(cell);
      const rowSpan = (cell.rowSpan as number) || extractRowSpanFromClass(cell);
      const fieldComponents = cell.components || [];

      for (const fieldComp of fieldComponents) {
        if (!fieldComp.type?.startsWith('crm-field')) continue;

        globalOrder++;

        // Extrair todas as propriedades do componente
        const props: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fieldComp)) {
          if (key !== 'type' && key !== 'tagName' && key !== 'components' && key !== 'attributes') {
            props[key] = value;
          }
        }

        // GrapeJS omite propriedades que igualam o default do component type.
        // O fieldType e definido como default em cada tipo registrado, entao
        // GrapeJS o omite no getProjectData(). Extrair do nome do component type.
        // Ex: "crm-field-select" -> "select", "crm-field-workflow-status" -> "workflow-status"
        if (!props.fieldType && fieldComp.type) {
          const extracted = fieldComp.type.replace(/^crm-field-/, '');
          if (extracted && extracted !== fieldComp.type) {
            props.fieldType = extracted;
          }
        }

        const field = gjsPropsToEntityField(props, globalOrder);

        // Sobrescrever grid positioning com valores reais do layout
        field.gridRow = rowIndex;
        field.gridColSpan = colSpan;
        field.gridColStart = colStart;
        if (rowSpan > 1) {
          (field as Record<string, unknown>).gridRowSpan = rowSpan;
        }

        fields.push(field);
      }

      colStart += colSpan;
    }

    rowIndex++;
  }

  return fields;
}

/**
 * Extrai colSpan da classe CSS do grid-cell.
 * Ex: "grid-cell col-span-6" -> 6
 *
 * GrapeJS pode retornar classes em `attributes.class` (string)
 * ou em `classes` (array de strings). Suportar ambos os formatos.
 */
function extractColSpanFromClass(cell: GjsComponentDef): number {
  // Formato GrapeJS getProjectData(): classes como array
  const classesArray = (cell as Record<string, unknown>).classes;
  if (Array.isArray(classesArray)) {
    for (const cls of classesArray) {
      const str = typeof cls === 'string' ? cls : (cls as Record<string, unknown>)?.name;
      if (typeof str === 'string') {
        const match = str.match(/col-span-(\d+)/);
        if (match) return parseInt(match[1], 10);
      }
    }
  }

  // Formato loadProjectData(): class como string no attributes
  const classStr = cell.attributes?.class || '';
  const match = classStr.match(/col-span-(\d+)/);
  return match ? parseInt(match[1], 10) : 12;
}

/**
 * Extrai rowSpan da classe CSS do grid-cell.
 * Ex: "grid-cell col-span-6 row-span-2" -> 2
 */
function extractRowSpanFromClass(cell: GjsComponentDef): number {
  const classesArray = (cell as Record<string, unknown>).classes;
  if (Array.isArray(classesArray)) {
    for (const cls of classesArray) {
      const str = typeof cls === 'string' ? cls : (cls as Record<string, unknown>)?.name;
      if (typeof str === 'string') {
        const match = str.match(/row-span-(\d+)/);
        if (match) return parseInt(match[1], 10);
      }
    }
  }

  const classStr = cell.attributes?.class || '';
  const match = classStr.match(/row-span-(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Converte EntityField[] para GjsProjectData e de volta,
 * verificando que nenhuma propriedade foi perdida.
 * Util para testes.
 */
export function verifyRoundtrip(fields: EntityField[]): {
  success: boolean;
  original: EntityField[];
  roundtripped: EntityField[];
  differences: Array<{ index: number; field: string; original: unknown; roundtripped: unknown }>;
} {
  // Importar dinamicamente para evitar dependencia circular
  const { serializeToGjs } = require('./serialize');

  const serialized = serializeToGjs(fields);
  const roundtripped = deserializeFromGjs(serialized);

  const differences: Array<{ index: number; field: string; original: unknown; roundtripped: unknown }> = [];

  const criticalProps = [
    'slug', 'name', 'label', 'type', 'required', 'placeholder', 'helpText',
    'gridRow', 'gridColSpan', 'gridColStart',
    'options', 'relatedEntityId', 'relatedEntitySlug', 'relatedDisplayField',
    'subEntityId', 'subEntitySlug', 'workflowConfig', 'formulaConfig',
    'rollupConfig', 'lookupConfig', 'actionButtonConfig',
    'min', 'max', 'step', 'apiEndpoint', 'valueField', 'labelField',
    'hidden', 'disabled', 'unique', 'multiple', 'maxFiles',
  ];

  fields.forEach((original, index) => {
    const rt = roundtripped[index];
    if (!rt) {
      differences.push({ index, field: '_missing', original: original.slug, roundtripped: undefined });
      return;
    }

    for (const prop of criticalProps) {
      const origVal = (original as unknown as Record<string, unknown>)[prop];
      const rtVal = (rt as unknown as Record<string, unknown>)[prop];

      if (origVal === undefined && rtVal === undefined) continue;
      if (origVal === null && rtVal === undefined) continue;
      if (origVal === false && rtVal === undefined) continue;
      if (origVal === 0 && rtVal === undefined) continue;

      const origStr = JSON.stringify(origVal);
      const rtStr = JSON.stringify(rtVal);

      if (origStr !== rtStr) {
        differences.push({ index, field: prop, original: origVal, roundtripped: rtVal });
      }
    }
  });

  return {
    success: differences.length === 0,
    original: fields,
    roundtripped,
    differences,
  };
}
