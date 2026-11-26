import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AiFieldDraft, AiPreviewTable, AiTableDraft, AiDashboardResult } from './use-ai-builder';
import { entityKeys } from './use-entities';
import { dashboardTemplateKeys } from './use-dashboard-templates';
import { pdfTemplateKeys } from './use-pdf-templates';

/**
 * Construtor da tela inicial (API /ai-builder/workspace): tabelas, paineis e PDFs
 * juntos. O rascunho guarda so o que muda; quem ja existe vem com existing=true.
 */

export type WsMark = 'new' | 'changed' | 'removed';
export type WsModule = 'table' | 'dashboard' | 'pdf' | 'role' | 'automation';
export type WsKind = 'create' | 'update' | 'delete';

export type WsField = AiFieldDraft;
export type WsTable = AiTableDraft;

export interface WsWidget {
  type: string;
  title: string;
  table: string;
  width?: number;
  ref?: string;
  [prop: string]: unknown;
}

export interface WsDashboard {
  key: string;
  existing?: boolean;
  removed?: boolean;
  name: string;
  description: string;
  mainTable: string;
  roles?: string[];
  tabs: Array<{ label: string; rows: WsWidget[][] }>;
}

export interface WsPdfSection {
  kind: 'heading' | 'fields' | 'text' | 'items' | 'photos' | 'signature' | 'divider';
  title?: string;
  fields?: string[];
  columns?: number;
  text?: string;
  field?: string;
}

export interface WsPdf {
  key: string;
  existing?: boolean;
  removed?: boolean;
  name: string;
  description: string;
  table: string;
  title?: string;
  fileName?: string;
  sections?: WsPdfSection[];
}

export type WsLevel = 'none' | 'read' | 'edit' | 'full';
export const ROLE_MODULES = [
  'dashboard', 'data', 'entities', 'users', 'roles', 'settings',
  'automations', 'templates', 'logs', 'publicLinks', 'apis', 'archive', 'chat',
] as const;
export type WsRoleModule = (typeof ROLE_MODULES)[number];

export interface WsRoleTable {
  /** Identificador da tabela ou '*' (todas). */
  table: string;
  read?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
  scope?: string;
  hiddenFields?: string[];
  readonlyFields?: string[];
  filters?: Array<{ field: string; operator: string; value?: string }>;
  removed?: boolean;
}

export interface WsRole {
  key: string;
  existing?: boolean;
  removed?: boolean;
  name: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  allAccess?: boolean;
  modules?: Partial<Record<WsRoleModule, WsLevel>>;
  tables?: WsRoleTable[];
  /** Do nivel de quem mexe ou acima: so leitura. */
  locked?: boolean;
  people?: number;
  /** Cargo padrao do sistema: nao se exclui nem muda de nome. */
  system?: boolean;
}

export interface WsAutoAction {
  type: 'notify' | 'email' | 'set_field' | 'webhook' | 'keep';
  /** notify: id (ou nome) de alguem da equipe; vazio = quem fez a alteracao. */
  person?: string;
  title?: string;
  message?: string;
  to?: string;
  subject?: string;
  body?: string;
  field?: string;
  value?: unknown;
  url?: string;
  /** Acao de uma automacao que ja existe (posicao dela). */
  ref?: number;
}

export interface WsAutomation {
  key: string;
  existing?: boolean;
  removed?: boolean;
  name: string;
  table: string;
  active?: boolean;
  when: { event: 'created' | 'updated' | 'deleted' | 'field_changed' | 'manual' | 'keep' | string; field?: string; to?: unknown };
  conditions?: Array<{ field: string; operator: string; value?: unknown }>;
  actions: WsAutoAction[];
}

export interface WorkspaceDraft {
  reply: string;
  group?: string;
  tables: WsTable[];
  dashboards: WsDashboard[];
  pdfs: WsPdf[];
  roles?: WsRole[];
  automations?: WsAutomation[];
}

export interface WsChange {
  module: WsModule;
  kind: WsKind;
  key: string;
  name: string;
  details: string[];
  /** Numa alteracao: o que sai (campos excluidos). Pede confirmacao. */
  removals?: string[];
}

export interface WsMarks {
  tables: Record<string, { status: WsMark; fields: Record<string, WsMark> }>;
  dashboards: Record<string, WsMark>;
  pdfs: Record<string, WsMark>;
  roles?: Record<string, WsMark>;
  automations?: Record<string, WsMark>;
}

export type WsDashboardPayload = AiDashboardResult['dashboard'];

/** Resposta da conversa e da conferencia (mesmo formato). */
export interface WorkspaceResult {
  reply: string;
  warnings: string[];
  proposal: Record<string, unknown>;
  changes: WsChange[];
  marks: WsMarks;
  preview: {
    tables: AiPreviewTable[];
    dashboards: Record<string, WsDashboardPayload>;
    pdfs: Record<string, { previewable: boolean }>;
  };
}

export interface WorkspaceState {
  enabled: boolean;
  tables: WsTable[];
  previews: AiPreviewTable[];
  dashboards: Array<{ draft: WsDashboard; payload: WsDashboardPayload }>;
  pdfs: WsPdf[];
  roles: WsRole[];
  automations: WsAutomation[];
  /** Equipe, para escolher quem recebe o aviso. */
  people: Array<{ id: string; name: string }>;
}

export interface WorkspaceApplyResult {
  applied: Array<{ module: WsModule; kind: WsKind; key: string; id: string; name: string }>;
  failed: { name: string; message: string } | null;
  warnings: string[];
}

export interface WorkspaceHistoryItem {
  id: string;
  at: string;
  by: string;
  impersonatedBy: string | null;
  request: string[];
  viaAi: boolean;
  changes: WsChange[];
  applied: WorkspaceApplyResult['applied'];
  failed: WorkspaceApplyResult['failed'];
}

export const EMPTY_DRAFT: WorkspaceDraft = { reply: '', tables: [], dashboards: [], pdfs: [], roles: [], automations: [] };
export const EMPTY_MARKS: WsMarks = { tables: {}, dashboards: {}, pdfs: {}, roles: {}, automations: {} };

export const workspaceKeys = {
  all: ['ai-workspace'] as const,
  state: () => [...workspaceKeys.all, 'state'] as const,
  history: () => [...workspaceKeys.all, 'history'] as const,
};

export function useWorkspaceState(enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.state(),
    queryFn: async () => (await api.get<WorkspaceState>('/ai-builder/workspace')).data,
    enabled,
    staleTime: 30_000,
  });
}

export function useWorkspaceHistory(enabled: boolean) {
  return useQuery({
    queryKey: workspaceKeys.history(),
    queryFn: async () => (await api.get<WorkspaceHistoryItem[]>('/ai-builder/workspace/history')).data,
    enabled,
  });
}

/** Confere o rascunho mexido a mao (sem IA, sem custo). */
export async function previewWorkspace(proposal: WorkspaceDraft) {
  return (await api.post<WorkspaceResult>('/ai-builder/workspace/preview', { proposal })).data;
}

export async function previewWorkspacePdf(proposal: WorkspaceDraft, key: string): Promise<Blob> {
  return (await api.post('/ai-builder/workspace/pdf-preview', { proposal, key }, { responseType: 'blob', timeout: 60_000 })).data as Blob;
}

/** Aplica e atualiza tudo o que o construtor mexe. */
export function useWorkspaceApply() {
  const queryClient = useQueryClient();
  return async (proposal: WorkspaceDraft, confirmRemovals: boolean, conversation: string[]) => {
    try {
      return (await api.post<WorkspaceApplyResult>('/ai-builder/workspace/apply', { proposal, confirmRemovals, conversation }, { timeout: 120_000 })).data;
    } finally {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      void queryClient.invalidateQueries({ queryKey: entityKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardTemplateKeys.all });
      void queryClient.invalidateQueries({ queryKey: pdfTemplateKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['my-home'] });
    }
  };
}
