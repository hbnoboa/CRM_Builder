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
// Teto do "carregar tudo" (all=true): trava de seguranca para nenhuma tela ou integracao
// derrubar a API baixando uma tabela enorme. Na pratica nao e atingido: acima de
// SERVER_MODE_THRESHOLD a tela trabalha no modo servidor (paginas e contas no banco).
export const DASHBOARD_MAX_LIMIT = 5000;

// Acima disto a pagina da tabela nao baixa todos os registros: graficos e numeros vem do
// servidor e a tabela pagina no servidor. Abaixo, tudo no navegador (filtro instantaneo).
export const SERVER_MODE_THRESHOLD = 3000;
