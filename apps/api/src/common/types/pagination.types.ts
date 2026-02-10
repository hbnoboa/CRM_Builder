// Common pagination types used across all services

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface PaginationQuery {
  // Offset-based pagination
  page?: number;
  limit?: number;

  // Cursor-based pagination (para listas grandes)
  cursor?: string;

  // Filtros
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  tenantId?: string; // Para PLATFORM_ADMIN filtrar por tenant

  // Sparse fieldsets - campos a retornar (reduz payload)
  fields?: string; // Ex: "id,name,email" ou "id,name,createdAt"
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  // Cursor pagination info
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ============================================================================
// CURSOR UTILITIES
// ============================================================================

export interface CursorPayload {
  id: string;
  sortValue?: string | number | Date;
  sortField?: string;
}

/**
 * Encoda um cursor para base64 (esconde detalhes de implementacao)
 */
export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString('base64url');
}

/**
 * Decoda um cursor de base64
 */
export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Cria meta de paginacao com suporte a cursor
 */
export function createPaginationMeta(
  total: number,
  page: number,
  limit: number,
  cursorInfo?: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
    previousCursor?: string;
  },
): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: cursorInfo?.hasNextPage ?? page < Math.ceil(total / limit),
    hasPreviousPage: cursorInfo?.hasPreviousPage ?? page > 1,
    nextCursor: cursorInfo?.nextCursor,
    previousCursor: cursorInfo?.previousCursor,
  };
}

// Default pagination values
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Parse e valida parametros de paginacao (offset-based)
 */
export function parsePaginationParams(query: PaginationQuery) {
  const page = Math.max(1, query.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Parse campos selecionados (sparse fieldsets)
 * @param fieldsParam - String com campos separados por virgula
 * @param allowedFields - Lista de campos permitidos
 * @returns Objeto select do Prisma ou undefined
 */
export function parseSelectFields(
  fieldsParam?: string,
  allowedFields?: string[],
): Record<string, boolean> | undefined {
  if (!fieldsParam) return undefined;

  const requestedFields = fieldsParam.split(',').map(f => f.trim()).filter(Boolean);

  if (requestedFields.length === 0) return undefined;

  const select: Record<string, boolean> = {};

  for (const field of requestedFields) {
    // Se allowedFields foi fornecido, valida o campo
    if (allowedFields && !allowedFields.includes(field)) {
      continue;
    }
    select[field] = true;
  }

  // Sempre incluir id se houver select
  if (Object.keys(select).length > 0) {
    select.id = true;
  }

  return Object.keys(select).length > 0 ? select : undefined;
}

/**
 * Gera cursores para os itens de uma lista
 */
export function generateCursors<T extends { id: string }>(
  items: T[],
  sortField: string = 'id',
): { nextCursor?: string; previousCursor?: string } {
  if (items.length === 0) {
    return {};
  }

  const lastItem = items[items.length - 1];
  const firstItem = items[0];

  return {
    nextCursor: encodeCursor({
      id: lastItem.id,
      sortField,
      sortValue: (lastItem as Record<string, unknown>)[sortField] as string,
    }),
    previousCursor: encodeCursor({
      id: firstItem.id,
      sortField,
      sortValue: (firstItem as Record<string, unknown>)[sortField] as string,
    }),
  };
}

// ============================================================================
// PRISMA CURSOR HELPERS
// ============================================================================

export interface CursorPaginationOptions {
  cursor?: string;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Gera clausulas Prisma para cursor pagination
 * Usa estrategia de seek/keyset para performance O(1)
 */
export function buildCursorPagination<T>(
  options: CursorPaginationOptions,
): {
  cursor?: { id: string };
  skip?: number;
  take: number;
  orderBy: Record<string, 'asc' | 'desc'>;
} {
  const { cursor, limit, sortBy, sortOrder } = options;

  const orderBy: Record<string, 'asc' | 'desc'> = {
    [sortBy]: sortOrder,
  };

  // Se nao tem sortBy por id, adiciona como tiebreaker
  if (sortBy !== 'id') {
    orderBy.id = sortOrder;
  }

  if (!cursor) {
    return {
      take: limit,
      orderBy,
    };
  }

  const decoded = decodeCursor(cursor);
  if (!decoded) {
    return {
      take: limit,
      orderBy,
    };
  }

  return {
    cursor: { id: decoded.id },
    skip: 1, // Pula o item do cursor
    take: limit,
    orderBy,
  };
}
