import type { Editor } from 'grapesjs';
import { registerGridRow } from './grid-row';
import { registerGridCell } from './grid-cell';
import { registerBaseField } from './base-field';
import { registerFieldTypes } from './field-types';

/**
 * Registra todos os component types customizados no GrapeJS.
 * Ordem importa: base types primeiro, depois os que estendem.
 * Traits panel e gerenciado via React (FieldPropertiesPanel), nao via GrapeJS traits.
 */
export function registerAllComponents(editor: Editor) {
  registerGridRow(editor);
  registerGridCell(editor);
  registerBaseField(editor);
  registerFieldTypes(editor);
}
