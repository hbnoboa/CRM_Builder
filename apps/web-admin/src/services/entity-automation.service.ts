import api from '@/lib/api';

export type AutomationTrigger =
  | 'ON_CREATE'
  | 'ON_UPDATE'
  | 'ON_DELETE'
  | 'ON_FIELD_CHANGE'
  | 'ON_STATUS_CHANGE'
  | 'SCHEDULE'
  | 'MANUAL';

export interface EntityAutomation {
  id: string;
  tenantId: string;
  entityId: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  triggerConfig?: Record<string, unknown>;
  conditions?: Array<{ field: string; operator: string; value: unknown }>;
  actions: Array<{
    order: number;
    type: string;
    config: Record<string, unknown>;
    condition?: Record<string, unknown>;
  }>;
  errorHandling: string;
  maxExecutionsPerHour: number;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationData {
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  triggerConfig?: Record<string, unknown>;
  conditions?: Array<{ field: string; operator: string; value: unknown }>;
  actions: Array<Record<string, unknown>>;
  errorHandling?: string;
  isActive?: boolean;
  maxExecutionsPerHour?: number;
}

export type UpdateAutomationData = Partial<CreateAutomationData>;

export interface AutomationExecution {
  id: string;
  automationId: string;
  tenantId: string;
  recordId?: string;
  triggeredBy: string;
  inputData?: Record<string, unknown>;
  currentStep: number;
  totalSteps: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stepResults: Array<{
    step: number;
    type: string;
    status: string;
    output?: unknown;
    error?: string;
    duration?: number;
  }>;
  errorMessage?: string;
  duration?: number;
  startedAt: string;
  completedAt?: string;
}

export interface QueryAutomationsParams {
  page?: number;
  limit?: number;
}

export const entityAutomationService = {
  async getAll(
    entityId: string,
    params?: QueryAutomationsParams,
  ): Promise<EntityAutomation[]> {
    const response = await api.get<EntityAutomation[]>(
      `/entities/${entityId}/automations`,
      { params },
    );
    return response.data;
  },

  async getById(entityId: string, id: string): Promise<EntityAutomation> {
    const response = await api.get<EntityAutomation>(
      `/entities/${entityId}/automations/${id}`,
    );
    return response.data;
  },

  async create(
    entityId: string,
    data: CreateAutomationData,
  ): Promise<EntityAutomation> {
    const response = await api.post<EntityAutomation>(
      `/entities/${entityId}/automations`,
      data,
    );
    return response.data;
  },

  async update(
    entityId: string,
    id: string,
    data: UpdateAutomationData,
  ): Promise<EntityAutomation> {
    const response = await api.patch<EntityAutomation>(
      `/entities/${entityId}/automations/${id}`,
      data,
    );
    return response.data;
  },

  async delete(entityId: string, id: string): Promise<void> {
    await api.delete(`/entities/${entityId}/automations/${id}`);
  },

  async execute(
    entityId: string,
    id: string,
    data?: { recordId?: string; inputData?: Record<string, unknown> },
  ): Promise<{ executionId: string; message: string }> {
    const response = await api.post<{ executionId: string; message: string }>(
      `/entities/${entityId}/automations/${id}/execute`,
      data,
    );
    return response.data;
  },

  async getExecutions(
    entityId: string,
    id: string,
    params?: { page?: number; limit?: number },
  ) {
    const response = await api.get<{
      data: AutomationExecution[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(`/entities/${entityId}/automations/${id}/executions`, { params });
    return response.data;
  },
};
