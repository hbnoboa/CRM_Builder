import api from '@/lib/api';

export type FieldRuleType =
  | 'required'
  | 'visible'
  | 'default'
  | 'computed'
  | 'validation';

export interface EntityFieldRule {
  id: string;
  tenantId: string;
  entityId: string;
  fieldSlug: string;
  ruleType: FieldRuleType;
  condition?: { field: string; operator: string; value: unknown };
  config: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFieldRuleData {
  fieldSlug: string;
  ruleType: FieldRuleType;
  condition?: { field: string; operator: string; value: unknown };
  config: Record<string, unknown>;
  priority?: number;
  isActive?: boolean;
}

export type UpdateFieldRuleData = Partial<CreateFieldRuleData>;

export const fieldRulesService = {
  async getAll(entityId: string): Promise<EntityFieldRule[]> {
    const response = await api.get<EntityFieldRule[]>(
      `/entities/${entityId}/field-rules`,
    );
    return response.data;
  },

  async create(
    entityId: string,
    data: CreateFieldRuleData,
  ): Promise<EntityFieldRule> {
    const response = await api.post<EntityFieldRule>(
      `/entities/${entityId}/field-rules`,
      data,
    );
    return response.data;
  },

  async update(
    entityId: string,
    id: string,
    data: UpdateFieldRuleData,
  ): Promise<EntityFieldRule> {
    const response = await api.patch<EntityFieldRule>(
      `/entities/${entityId}/field-rules/${id}`,
      data,
    );
    return response.data;
  },

  async delete(entityId: string, id: string): Promise<void> {
    await api.delete(`/entities/${entityId}/field-rules/${id}`);
  },
};
