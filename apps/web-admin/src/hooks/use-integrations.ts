import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { integrationsService } from '@/services/integrations.service';

const keys = {
  apiKeys: ['integrations', 'api-keys'] as const,
  webhooks: ['integrations', 'webhooks'] as const,
  runs: (id: string) => ['integrations', 'webhooks', id, 'runs'] as const,
  automations: (entityId: string) => ['integrations', 'automations', entityId] as const,
};

function useInvalidating<V, R>(fn: (v: V) => Promise<R>, key: readonly unknown[]) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
}

export const useApiKeys = (enabled = true) => useQuery({ queryKey: keys.apiKeys, queryFn: integrationsService.listKeys, enabled });
export const useCreateApiKey = () => useInvalidating(integrationsService.createKey, keys.apiKeys);
export const useRevokeApiKey = () => useInvalidating(integrationsService.revokeKey, keys.apiKeys);

export const useWebhooks = (enabled = true) => useQuery({ queryKey: keys.webhooks, queryFn: integrationsService.listWebhooks, enabled });
export const useCreateWebhook = () => useInvalidating(integrationsService.createWebhook, keys.webhooks);
export const useUpdateWebhook = () => useInvalidating(integrationsService.updateWebhook, keys.webhooks);
export const useDeleteWebhook = () => useInvalidating(integrationsService.deleteWebhook, keys.webhooks);
export const useTestWebhook = () => useInvalidating(integrationsService.testWebhook, ['integrations', 'webhooks']);
export const useWebhookRuns = (id: string | null) =>
  useQuery({ queryKey: keys.runs(id ?? ''), queryFn: () => integrationsService.webhookRuns(id!), enabled: !!id });

/** Automacoes de todas as tabelas (uma consulta por tabela). */
export function useAllAutomations(entityIds: string[], enabled = true) {
  return useQueries({
    queries: entityIds.map((id) => ({
      queryKey: keys.automations(id),
      queryFn: async () => {
        const data = await integrationsService.listAutomations(id);
        return Array.isArray(data) ? data : data.data;
      },
      enabled,
    })),
  });
}
