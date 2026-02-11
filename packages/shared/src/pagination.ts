import { SortOrder } from './enums';

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface PaginationQuery {
  page?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
  tenantId?: string;
  fields?: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
// CONSTANTS
// ============================================================================

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
