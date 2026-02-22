// Re-export shared pagination types
export type {
  PaginationQuery,
  PaginationMeta,
  PaginatedResponse,
} from '@crm-builder/shared';

export { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@crm-builder/shared';

import type { PaginationQuery, PaginationMeta } from '@crm-builder/shared';
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@crm-builder/shared';

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

/**
 * Parse e valida parametros de paginacao (offset-based)
 */
export function parsePaginationParams(query: PaginationQuery) {
  const page = Math.max(1, query.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

