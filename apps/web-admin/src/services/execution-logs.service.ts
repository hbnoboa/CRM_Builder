import { api } from '@/lib/api';

export interface ExecutionLog {
  id: string;
  type: 'webhook' | 'action-chain' | 'scheduled-task' | 'api-execution';
  name: string;
  status: string;
  duration?: number;
  error?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionLogStats {
  period: string;
  startDate: string;
  endDate: string;
  webhook: { success: number; error: number; timeout: number; total: number };
  actionChain: { success: number; error: number; timeout: number; total: number };
  scheduledTask: { success: number; error: number; timeout: number; total: number };
  apiExecution: { success: number; error: number; timeout: number; total: number };
  totals: { success: number; error: number; total: number };
}

export interface QueryExecutionLogsParams {
  page?: number;
  limit?: number;
  type?: 'webhook' | 'action-chain' | 'scheduled-task' | 'api-execution';
  status?: 'success' | 'error' | 'timeout';
  startDate?: string;
  endDate?: string;
}

export const executionLogsService = {
  async findAll(params: QueryExecutionLogsParams = {}) {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));
    if (params.type) searchParams.append('type', params.type);
    if (params.status) searchParams.append('status', params.status);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);

    const response = await api.get<{
      data: ExecutionLog[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(`/execution-logs?${searchParams.toString()}`);

    return response.data;
  },

  async getStats(period: 'day' | 'week' | 'month' = 'day') {
    const response = await api.get<ExecutionLogStats>(`/execution-logs/stats?period=${period}`);
    return response.data;
  },

  async findOne(type: string, id: string) {
    const response = await api.get(`/execution-logs/${type}/${id}`);
    return response.data;
  },
};
