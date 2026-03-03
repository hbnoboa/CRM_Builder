/**
 * Avaliador de condicoes para automacoes.
 * Suporta operadores de comparacao, texto, lista e nullability.
 */
export class ConditionEvaluator {
  /**
   * Avalia uma lista de condicoes (AND logico) contra os dados de um registro.
   * Retorna true se TODAS as condicoes forem satisfeitas (ou se nao houver condicoes).
   */
  static evaluate(
    conditions: Array<{ field: string; operator: string; value: unknown }> | null | undefined,
    recordData: Record<string, unknown>,
  ): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((condition) =>
      this.evaluateCondition(condition, recordData),
    );
  }

  /**
   * Avalia uma condicao individual contra os dados.
   */
  private static evaluateCondition(
    condition: { field: string; operator: string; value: unknown },
    recordData: Record<string, unknown>,
  ): boolean {
    const fieldValue = this.getNestedValue(recordData, condition.field);

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;

      case 'neq':
        return fieldValue !== condition.value;

      case 'contains':
        return String(fieldValue || '')
          .toLowerCase()
          .includes(String(condition.value).toLowerCase());

      case 'not_contains':
        return !String(fieldValue || '')
          .toLowerCase()
          .includes(String(condition.value).toLowerCase());

      case 'starts_with':
        return String(fieldValue || '')
          .toLowerCase()
          .startsWith(String(condition.value).toLowerCase());

      case 'ends_with':
        return String(fieldValue || '')
          .toLowerCase()
          .endsWith(String(condition.value).toLowerCase());

      case 'gt':
        return Number(fieldValue) > Number(condition.value);

      case 'gte':
        return Number(fieldValue) >= Number(condition.value);

      case 'lt':
        return Number(fieldValue) < Number(condition.value);

      case 'lte':
        return Number(fieldValue) <= Number(condition.value);

      case 'in':
        return (
          Array.isArray(condition.value) &&
          condition.value.includes(fieldValue)
        );

      case 'not_in':
        return (
          Array.isArray(condition.value) &&
          !condition.value.includes(fieldValue)
        );

      case 'is_empty':
        return (
          fieldValue === null ||
          fieldValue === undefined ||
          fieldValue === ''
        );

      case 'is_not_empty':
        return (
          fieldValue !== null &&
          fieldValue !== undefined &&
          fieldValue !== ''
        );

      case 'regex':
        try {
          const regex = new RegExp(String(condition.value), 'i');
          return regex.test(String(fieldValue || ''));
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * Obtem valor aninhado de um objeto usando notacao de ponto.
   * Ex: getNestedValue({ a: { b: 1 } }, 'a.b') => 1
   */
  private static getNestedValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
