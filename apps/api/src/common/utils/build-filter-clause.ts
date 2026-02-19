import { Prisma } from '@prisma/client';

/**
 * Constroi uma clausula Prisma WHERE para um filtro sobre campo JSON de EntityData.
 * Reutilizado por DataService e DataSourceService.
 */
export function buildFilterClause(
  fieldSlug: string,
  fieldType: string,
  operator: string,
  value: unknown,
  value2?: unknown,
): Prisma.EntityDataWhereInput | null {
  const type = fieldType?.toLowerCase() || 'text';

  // Operadores que nao precisam de valor
  if (operator === 'isEmpty') {
    return {
      OR: [
        { data: { path: [fieldSlug], equals: Prisma.DbNull } },
        { data: { path: [fieldSlug], equals: '' } },
        { data: { path: [fieldSlug], equals: Prisma.JsonNull } },
      ],
    };
  }

  if (operator === 'isNotEmpty') {
    return {
      AND: [
        { NOT: { data: { path: [fieldSlug], equals: Prisma.DbNull } } },
        { NOT: { data: { path: [fieldSlug], equals: '' } } },
        { NOT: { data: { path: [fieldSlug], equals: Prisma.JsonNull } } },
      ],
    };
  }

  // Tipos texto
  const textTypes = ['text', 'textarea', 'richtext', 'email', 'phone', 'url', 'cpf', 'cnpj', 'cep', 'password'];
  // Tipos numero
  const numberTypes = ['number', 'currency', 'percentage', 'rating', 'slider'];
  // Tipos data
  const dateTypes = ['date', 'datetime', 'time'];
  // Tipos select
  const selectTypes = ['select', 'multiselect', 'api-select', 'relation'];

  if (type === 'boolean') {
    if (operator === 'equals') {
      let boolValue: boolean;
      if (value === true || value === 'true' || value === 1 || value === '1') {
        boolValue = true;
      } else {
        boolValue = false;
      }
      return { data: { path: [fieldSlug], equals: boolValue } };
    }
  }

  if (textTypes.includes(type) || selectTypes.includes(type)) {
    const strValue = String(value || '');
    switch (operator) {
      case 'equals':
        return { data: { path: [fieldSlug], equals: strValue } };
      case 'contains':
        return { data: { path: [fieldSlug], string_contains: strValue } };
      case 'startsWith':
        return { data: { path: [fieldSlug], string_starts_with: strValue } };
      case 'endsWith':
        return { data: { path: [fieldSlug], string_ends_with: strValue } };
    }
  }

  if (numberTypes.includes(type)) {
    const numValue = Number(value);
    const numValue2 = value2 !== undefined ? Number(value2) : undefined;
    switch (operator) {
      case 'equals':
        return { data: { path: [fieldSlug], equals: numValue } };
      case 'gt':
        return { data: { path: [fieldSlug], gt: numValue } };
      case 'gte':
        return { data: { path: [fieldSlug], gte: numValue } };
      case 'lt':
        return { data: { path: [fieldSlug], lt: numValue } };
      case 'lte':
        return { data: { path: [fieldSlug], lte: numValue } };
      case 'between':
        if (numValue2 !== undefined) {
          return {
            AND: [
              { data: { path: [fieldSlug], gte: numValue } },
              { data: { path: [fieldSlug], lte: numValue2 } },
            ],
          };
        }
        break;
    }
  }

  if (dateTypes.includes(type)) {
    const strValue = String(value || '');
    const strValue2 = value2 !== undefined ? String(value2) : undefined;
    switch (operator) {
      case 'equals':
        return { data: { path: [fieldSlug], equals: strValue } };
      case 'gt':
        return { data: { path: [fieldSlug], gt: strValue } };
      case 'gte':
        return { data: { path: [fieldSlug], gte: strValue } };
      case 'lt':
        return { data: { path: [fieldSlug], lt: strValue } };
      case 'lte':
        return { data: { path: [fieldSlug], lte: strValue } };
      case 'between':
        if (strValue2) {
          return {
            AND: [
              { data: { path: [fieldSlug], gte: strValue } },
              { data: { path: [fieldSlug], lte: strValue2 } },
            ],
          };
        }
        break;
    }
  }

  // Fallback para texto
  if (operator === 'equals') {
    return { data: { path: [fieldSlug], equals: value as Prisma.InputJsonValue } };
  }
  if (operator === 'contains') {
    return { data: { path: [fieldSlug], string_contains: String(value || '') } };
  }

  return null;
}
