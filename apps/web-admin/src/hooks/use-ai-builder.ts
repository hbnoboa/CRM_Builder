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

export function useAiApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposal: Record<string, unknown>) =>
      (await api.post<AiApplyResult>('/ai-builder/apply', { proposal })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entityKeys.all }),
  });
}

export interface AiDashboardResult {
  reply: string;
  warnings: string[];
  proposal: Record<string, unknown>;
  dashboard: {
    name: string;
    description: string;
    entitySlug: string;
    layout: Array<{ i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number }>;
    widgets: Record<string, { type: string; title: string; config: Record<string, unknown> }>;
    tabs: Array<{ id: string; label: string; widgetIds: string[] }>;
    roleIds: string[];
  };
  roleNames: string[];
}

export interface AiPdfResult {
  reply: string;
  warnings: string[];
  proposal: Record<string, unknown>;
  name: string;
  tableName: string;
}

/** Cria o painel ou o PDF da proposta; devolve o id para abrir o editor. */
export function useAiApplyTo(endpoint: '/ai-builder/dashboards/apply' | '/ai-builder/pdfs/apply', invalidate: readonly unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposal: Record<string, unknown>) =>
      (await api.post<{ id: string; name: string; warnings: string[] }>(endpoint, { proposal })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidate }),
  });
}

/** Proposta de tabelas no formato da IA (o que a pessoa edita na previa). */
export interface AiFieldDraft {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  width?: 'full' | 'half' | 'third' | 'quarter';
  options?: Array<{ label: string; color?: string }>;
  relatedTable?: string;
  helpText?: string;
  placeholder?: string;
}

export interface AiTableDraft {
  key: string;
  name: string;
  namePlural: string;
  description: string;
  icon?: string;
  color?: string;
  parentKey?: string;
  fields: AiFieldDraft[];
  titleField?: string;
  statusField?: string;
  doneOptions?: string[];
  deadlineField?: string;
  assigneeField?: string;
}

export interface AiProposalDraft {
  reply: string;
  group?: string;
  tables: AiTableDraft[];
}

/** Confere e desenha de novo uma proposta mexida a mao (sem IA, sem custo). */
export async function previewAiTables(proposal: AiProposalDraft) {
  return (await api.post<AiProposeResult>('/ai-builder/preview', { proposal })).data;
}
