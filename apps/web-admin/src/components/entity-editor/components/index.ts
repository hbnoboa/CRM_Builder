import type { Editor } from 'grapesjs';
import { registerGridRow } from './grid-row';
import { registerGridCell } from './grid-cell';
import { registerBaseField } from './base-field';
import { registerFieldTypes } from './field-types';
import { registerCustomTraits } from '../traits';

/**
 * Registra todos os component types customizados no GrapeJS.
 * Ordem importa: base types primeiro, depois os que estendem.
 * Traits customizados registrados antes dos field types que os usam.
 */
export function registerAllComponents(editor: Editor) {
  registerGridRow(editor);
  registerGridCell(editor);
  registerCustomTraits(editor);
  registerBaseField(editor);
  registerFieldTypes(editor);
}
