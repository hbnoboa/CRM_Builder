import { CursorPaginatedResponse, CursorPaginationMeta } from '../dto/cursor-pagination.dto';

interface BuildCursorResponseOptions<T> {
  items: T[];
  limit: number;
  getCursorValue: (item: T) => string;
}

/**
 * Constrói response de cursor pagination padronizado
 *
 * @param options.items - Array de items retornados (deve ter limit + 1 para detectar hasMore)
 * @param options.limit - Limite de items por página
 * @param options.getCursorValue - Função para extrair cursor value de um item (geralmente item.id)
 * @returns Response formatado com data e meta
 */
export function buildCursorResponse<T>(
  options: BuildCursorResponseOptions<T>,
): CursorPaginatedResponse<T> {
  const { items, limit, getCursorValue } = options;

  // Se retornou limit + 1, significa que tem mais páginas
  const hasMore = items.length > limit;

  // Remover o item extra (usado apenas para detectar hasMore)
  const data = hasMore ? items.slice(0, -1) : items;

  // Próximo cursor é o ID do último item da página
  const nextCursor = hasMore && data.length > 0 ? getCursorValue(data[data.length - 1]) : null;

  const meta: CursorPaginationMeta = {
    nextCursor,
    hasMore,
    limit,
  };

  return { data, meta };
}

/**
 * Constrói cláusula de cursor para Prisma
 *
 * @param cursor - Cursor string (ID do último item)
 * @param sortBy - Campo usado para ordenação
 * @returns Objeto com cursor e skip para Prisma
 */
export function buildPrismaCursor(
  cursor: string | undefined,
  sortBy: string = 'id',
): { cursor?: Record<string, string>; skip?: number } {
  if (!cursor) {
    return {};
  }

  return {
    cursor: { [sortBy]: cursor },
    skip: 1, // Pular o item do cursor
  };
}
