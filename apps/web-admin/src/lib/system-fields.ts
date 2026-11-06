/**
 * Campos de sistema que a API acrescenta na leitura da tabela (datas de criacao e
 * atualizacao). Servem para colunas, filtros, paineis e PDFs, mas nao sao editaveis:
 * ficam fora do formulario do registro e do editor de campos.
 */
export const SYSTEM_FIELD_SLUGS = new Set(['createdAt', 'updatedAt']);

export function withoutSystemFields<T extends { slug: string }>(fields: T[] | undefined | null): T[] {
  return (fields || []).filter((f) => !SYSTEM_FIELD_SLUGS.has(f.slug));
}
