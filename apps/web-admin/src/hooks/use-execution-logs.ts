import { useQuery } from '@tanstack/react-query';
import { executionLogsService, type QueryExecutionLogsParams } from '@/services/execution-logs.service';

export function useExecutionLogs(params: QueryExecutionLogsParams = {}) {
  return useQuery({
    queryKey: ['execution-logs', params],
    queryFn: () => executionLogsService.findAll(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useExecutionLogsStats(period: 'day' | 'week' | 'month' = 'day') {
  return useQuery({
    queryKey: ['execution-logs-stats', period],
    queryFn: () => executionLogsService.getStats(period),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useExecutionLogDetail(type: string, id: string) {
  return useQuery({
    queryKey: ['execution-log', type, id],
    queryFn: () => executionLogsService.findOne(type, id),
    enabled: !!type && !!id,
  });
}
