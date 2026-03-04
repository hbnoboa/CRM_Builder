import type { EntityField } from '@crm-builder/shared';
import type { GjsProjectData, GjsComponentDef } from './serialize';
import { gjsPropsToEntityField } from './field-mappers';

/**
 * Converte GrapeJS ProjectData de volta para EntityField[].
 * Extrai campos dos componentes grid-row > grid-cell > crm-field.
 */
export function deserializeFromGjs(projectData: GjsProjectData): EntityField[] {
  const fields: EntityField[] = [];

  if (!projectData?.pages?.[0]?.component) {
    return fields;
  }

  const root = projectData.pages[0].component;
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

        const field = gjsPropsToEntityField(props, globalOrder);

        // Sobrescrever grid positioning com valores reais do layout
        field.gridRow = rowIndex;
        field.gridColSpan = colSpan;
        field.gridColStart = colStart;

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
 */
function extractColSpanFromClass(cell: GjsComponentDef): number {
  const classes = cell.attributes?.class || '';
  const match = classes.match(/col-span-(\d+)/);
  return match ? parseInt(match[1], 10) : 12;
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
      const origVal = (original as Record<string, unknown>)[prop];
      const rtVal = (rt as Record<string, unknown>)[prop];

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
