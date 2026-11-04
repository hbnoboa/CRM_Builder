import api from '@/lib/api';

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  customRole: { id: string; name: string };
  createdBy: { id: string; name: string };
}

export interface CreatedApiKey {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string | null;
  /** So aparece na criacao. */
  key: string;
}

export type WebhookEvent = 'created' | 'updated' | 'deleted';

export interface WebhookRow {
  id: string;
  name: string;
  url: string;
  entityId: string | null;
  events: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
  secret: string | null;
  createdAt: string;
}

export interface WebhookBody {
  name: string;
  url: string;
  entityId?: string;
  events: WebhookEvent[];
  secret?: string;
  status?: WebhookRow['status'];
}

export interface WebhookRun {
  status: string;
  responseStatus: number | null;
  errorMessage: string | null;
  responseTime?: number | null;
  createdAt: string;
  event?: string;
}

export interface AutomationRow {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
}

export const integrationsService = {
  listKeys: async () => (await api.get<ApiKeyRow[]>('/api-keys')).data,
  createKey: async (body: { name: string; customRoleId: string; expiresInDays: number | null }) =>
    (await api.post<CreatedApiKey>('/api-keys', body)).data,
  revokeKey: async (id: string) => { await api.delete(`/api-keys/${id}`); },

  listWebhooks: async () => (await api.get<WebhookRow[]>('/webhooks')).data,
  createWebhook: async (body: WebhookBody) => (await api.post<WebhookRow>('/webhooks', body)).data,
  updateWebhook: async ({ id, ...body }: Partial<WebhookBody> & { id: string }) =>
    (await api.put<WebhookRow>(`/webhooks/${id}`, body)).data,
  deleteWebhook: async (id: string) => { await api.delete(`/webhooks/${id}`); },
  testWebhook: async (id: string) => (await api.post<WebhookRun | null>(`/webhooks/${id}/test`)).data,
  webhookRuns: async (id: string) => {
    const { data } = await api.get<{ data: WebhookRun[] } | WebhookRun[]>(`/webhooks/${id}/executions`, { params: { limit: 20 } });
    return Array.isArray(data) ? data : data.data;
  },

  listAutomations: async (entityId: string) =>
    (await api.get<AutomationRow[] | { data: AutomationRow[] }>(`/entities/${entityId}/automations`)).data,
};
