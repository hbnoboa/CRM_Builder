import { useQuery } from '@tanstack/react-query';
import { auditLogsService, QueryAuditLogsParams } from '@/services/audit-logs.service';

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (params?: QueryAuditLogsParams) => [...auditLogKeys.lists(), params] as const,
};

export function useAuditLogs(params?: QueryAuditLogsParams) {
  return useQuery({
    queryKey: auditLogKeys.list(params),
    queryFn: () => auditLogsService.getAll(params),
  });
}
