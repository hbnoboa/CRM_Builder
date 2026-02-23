import { api } from '@/lib/api';

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface QueryAuditLogsParams {
  page?: number;
  limit?: number;
  tenantId?: string;
  action?: string;
  resource?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface PaginatedAuditLogs {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const auditLogsService = {
  async getAll(params?: QueryAuditLogsParams): Promise<PaginatedAuditLogs> {
    const response = await api.get('/audit-logs', { params });
    return response.data;
  },

  async exportJson(params?: { dateFrom?: string; dateTo?: string; tenantId?: string }): Promise<Blob> {
    const response = await api.get('/audit-logs/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};
