/**
 * Modelos de solucao (fase 1 da pagina inicial): cada modelo vira uma empresa-modelo
 * montada pela API (build.ts) e e copiada para quem se cadastra escolhendo o modelo.
 */

export type FieldOption = { value: string; label: string; color?: string };

export interface FieldSpec {
  slug: string;
  name: string;
  label: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  prefix?: string;
  suffix?: string;
  mask?: string;
  min?: number;
  max?: number;
  default?: unknown;
  /** Sub-tabela: slug da tabela filha (o id e resolvido no build). */
  subEntitySlug?: string;
  subEntityDisplayFields?: string[];
  parentDisplayField?: string;
  /** Relacao: slug da tabela relacionada (o id e resolvido no build). */
  relatedEntitySlug?: string;
  relatedDisplayField?: string;
  gridRow?: number;
  gridColSpan?: number;
  gridColStart?: number;
  [key: string]: unknown;
}

export interface EntitySpec {
  slug: string;
  name: string;
  namePlural: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  /** Sub-tabela de outra (some da lista de tabelas, entra pelo pai). */
  subOf?: string;
  fields: FieldSpec[];
  settings?: Record<string, unknown>;
}

export interface RoleSpec {
  name: string;
  description: string;
  color: string;
  permissions: Array<Record<string, unknown>>;
  modulePermissions: Record<string, unknown>;
}

export interface WidgetSpec {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  w: number;
  h: number;
}

export interface DashboardSpec {
  name: string;
  description: string;
  entitySlug: string;
  /** Nomes dos cargos (padrao ou do modelo) que veem este painel. */
  roles: string[];
  priority?: number;
  /** Cada aba e uma lista de linhas; cada linha, widgets lado a lado (w soma 12). */
  tabs: Array<{ id: string; label: string; rows: WidgetSpec[][] }>;
}

export interface PdfSpec {
  name: string;
  slug: string;
  description: string;
  entitySlug: string;
  templateType: 'single' | 'batch';
  content: Record<string, unknown>;
}

export interface CommandSpec {
  slug: string;
  description: string;
  icon?: string;
  targetEntitySlug: string;
  actionType: 'create_record' | 'update_record' | 'query';
  actionConfig: Record<string, unknown>;
}

/** Registro de exemplo: `children` vira sub-registros (por slug da tabela filha). */
export interface SampleRecord {
  data: Record<string, unknown>;
  children?: Record<string, SampleRecord[]>;
}

export interface SolutionSpec {
  slug: string;
  tenantName: string;
  brandColor: string;
  entities: EntitySpec[];
  roles: RoleSpec[];
  dashboards: DashboardSpec[];
  pdfs: PdfSpec[];
  commands: CommandSpec[];
  /** Registros de exemplo por tabela raiz. */
  samples: Record<string, SampleRecord[]>;
}
