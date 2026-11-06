import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { EntityField } from '@/types';
import { entityKeys } from './use-entities';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiPreviewTable {
  key: string;
  name: string;
  namePlural: string;
  description: string;
  icon: string;
  color: string;
  parentKey: string | null;
  fields: EntityField[];
  settings: {
    titleField?: string;
    statusField?: string;
    doneValues?: string[];
    deadlineField?: string;
    assigneeField?: string;
  };
}

export interface AiProposeResult {
  reply: string;
  warnings: string[];
  /** Volta como "proposta atual" na proxima mensagem e e o que se aplica. */
  proposal: Record<string, unknown>;
  tables: AiPreviewTable[];
  existingNames: Record<string, string>;
}

export interface AiApplyResult {
  rootId?: string;
  warnings: string[];
  tables: Array<{ key: string; id: string; slug: string; name: string }>;
}

export function useAiBuilderStatus() {
  return useQuery({
    queryKey: ['ai-builder', 'status'],
    queryFn: async () => (await api.get<{ enabled: boolean; provider: string | null }>('/ai-builder/status')).data,
    staleTime: 5 * 60_000,
  });
}

export function useAiPropose() {
  return useMutation({
    mutationFn: async (body: { messages: AiChatMessage[]; currentProposal?: Record<string, unknown> }) =>
      (await api.post<AiProposeResult>('/ai-builder/propose', body, { timeout: 240_000 })).data,
  });
}

export function useAiApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposal: Record<string, unknown>) =>
      (await api.post<AiApplyResult>('/ai-builder/apply', { proposal })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entityKeys.all }),
  });
}
