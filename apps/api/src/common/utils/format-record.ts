import { formatFieldValue, type FormatFieldOptions, type FieldType } from '@crm-builder/shared';

interface FieldDef {
  slug: string;
  type: string;
  name?: string;
}

interface FormatRecordOptions {
  locale?: string;
  currency?: string;
  emptyValue?: string;
  visibleFields?: string[];
}

/**
 * Gera um mapa de valores formatados para um record de EntityData.
 * Usado para retornar `_formatted` nos endpoints de dados.
 */
export function formatRecordData(
  data: Record<string, unknown> | null | undefined,
  fields: FieldDef[],
  options?: FormatRecordOptions,
): Record<string, string> {
  if (!data) return {};

  const { locale = 'pt-BR', currency = 'BRL', emptyValue = '-', visibleFields } = options || {};
  const result: Record<string, string> = {};

  // Criar mapa de tipo por slug para lookup rapido
  const fieldTypeMap = new Map<string, string>();
  for (const field of fields) {
    fieldTypeMap.set(field.slug, field.type);
  }

  for (const [key, value] of Object.entries(data)) {
    // Se ha visibleFields, so formatar campos visiveis
    if (visibleFields && !visibleFields.includes(key)) continue;

    const fieldType = fieldTypeMap.get(key);
    if (!fieldType) {
      // Campo nao definido na entidade (campo extra), formatar como string
      result[key] = value === null || value === undefined ? emptyValue : String(value);
      continue;
    }

    // Pular campos que nao sao dados exibiveis
    if (fieldType === 'section-title' || fieldType === 'action-button') continue;

    const formatOpts: FormatFieldOptions = {
      type: fieldType as FieldType,
      locale,
      currency,
      emptyValue,
    };

    result[key] = formatFieldValue(value, formatOpts);
  }

  return result;
}
