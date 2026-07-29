import { useQuery } from '@tanstack/react-query';
import { executionLogsService, type QueryExecutionLogsParams } from '@/services/execution-logs.service';
import { useActiveTenant } from '@/stores/tenant-context';

export function useExecutionLogs(params: QueryExecutionLogsParams = {}) {
  const { slug } = useActiveTenant();
  return useQuery({
    queryKey: ['execution-logs', params, slug],
    queryFn: () => executionLogsService.findAll(params),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useExecutionLogsStats(period: 'day' | 'week' | 'month' = 'day') {
  const { slug } = useActiveTenant();
  return useQuery({
    queryKey: ['execution-logs-stats', period, slug],
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
