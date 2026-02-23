/**
 * Avalia condicoes de notificacao in-memory contra dados de um registro.
 * Mesma logica de buildFilterClause, mas sem Prisma (avaliacao pura em JS).
 */

interface FilterCondition {
  fieldSlug: string;
  fieldType: string;
  operator: string;
  value?: unknown;
  value2?: unknown;
}

const TEXT_TYPES = ['text', 'textarea', 'richtext', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep', 'password'];
const NUMBER_TYPES = ['number', 'currency', 'percentage', 'rating', 'slider'];
const DATE_TYPES = ['date', 'datetime', 'time'];

function evaluateCondition(
  recordData: Record<string, unknown>,
  filter: FilterCondition,
): boolean {
  const fieldValue = recordData[filter.fieldSlug];
  const { operator, value, value2 } = filter;
  const type = filter.fieldType?.toLowerCase() || 'text';

  // Operadores que nao precisam de valor
  if (operator === 'isEmpty') {
    return fieldValue === null || fieldValue === undefined || fieldValue === '';
  }
  if (operator === 'isNotEmpty') {
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
  }

  // Boolean
  if (type === 'boolean') {
    if (operator === 'equals') {
      const boolValue = value === true || value === 'true' || value === 1 || value === '1';
      const fieldBool = fieldValue === true || fieldValue === 'true' || fieldValue === 1 || fieldValue === '1';
      return fieldBool === boolValue;
    }
    return false;
  }

  // Texto e select
  if (TEXT_TYPES.includes(type) || ['select', 'multiselect', 'api-select', 'relation'].includes(type)) {
    const strField = String(fieldValue ?? '');
    const strValue = String(value ?? '');
    switch (operator) {
      case 'equals': return strField === strValue;
      case 'contains': return strField.includes(strValue);
      case 'startsWith': return strField.startsWith(strValue);
      case 'endsWith': return strField.endsWith(strValue);
      default: return false;
    }
  }

  // Numeros
  if (NUMBER_TYPES.includes(type)) {
    const numField = Number(fieldValue);
    const numValue = Number(value);
    if (isNaN(numField)) return false;
    switch (operator) {
      case 'equals': return numField === numValue;
      case 'gt': return numField > numValue;
      case 'gte': return numField >= numValue;
      case 'lt': return numField < numValue;
      case 'lte': return numField <= numValue;
      case 'between': {
        const numValue2 = Number(value2);
        return numField >= numValue && numField <= numValue2;
      }
      default: return false;
    }
  }

  // Datas
  if (DATE_TYPES.includes(type)) {
    const strField = String(fieldValue ?? '');
    const strValue = String(value ?? '');
    if (!strField) return false;
    switch (operator) {
      case 'equals': return strField === strValue;
      case 'gt': return strField > strValue;
      case 'gte': return strField >= strValue;
      case 'lt': return strField < strValue;
      case 'lte': return strField <= strValue;
      case 'between': {
        const strValue2 = String(value2 ?? '');
        return strField >= strValue && strField <= strValue2;
      }
      default: return false;
    }
  }

  // Fallback: comparacao por string
  if (operator === 'equals') {
    return String(fieldValue ?? '') === String(value ?? '');
  }

  return false;
}

/**
 * Avalia todas as condicoes (AND logic).
 * Retorna true se TODAS as condicoes sao satisfeitas.
 */
export function evaluateConditions(
  recordData: Record<string, unknown>,
  conditions: FilterCondition[],
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(recordData, c));
}
