import { FieldType } from './enums';
import { Tenant } from './tenant';

// ============================================================================
// NOVAS INTERFACES DE CONFIGURACAO DE CAMPOS
// ============================================================================

/** Configuracao para campo user-select */
export interface UserSelectConfig {
  filterByRole?: string[];
  filterByTeam?: boolean;
  allowMultiple?: boolean;
  showAvatar?: boolean;
}

/** Configuracao para campo workflow-status */
export interface WorkflowStatusConfig {
  statuses: Array<{
    value: string;
    label: string;
    color: string;
    isFinal?: boolean;
    isInitial?: boolean;
  }>;
  transitions: Array<{
    from: string | string[];
    to: string;
    requiredFields?: string[];
    requiredPermission?: string;
    triggerWebhook?: string;
    triggerEmail?: string;
  }>;
}

/** Configuracao para campo timer */
export interface TimerConfig {
  autoStartOnStatus?: string[];
  autoPauseOnStatus?: string[];
  autoStopOnStatus?: string[];
  displayFormat?: 'hours' | 'days' | 'business-hours';
  businessHoursOnly?: boolean;
}

/** Valor armazenado de um timer */
export interface TimerValue {
  totalSeconds: number;
  isRunning: boolean;
  lastStartedAt?: string;
  segments: Array<{
    startedAt: string;
    endedAt?: string;
    seconds: number;
  }>;
}

/** Configuracao para campo sla-status */
export interface SlaStatusConfig {
  referenceField: string;
  targetField?: string;
  slaRules: Array<{
    condition?: Record<string, unknown>;
    targetMinutes: number;
    warningPercent?: number;
  }>;
  businessHoursOnly?: boolean;
  pauseOnStatus?: string[];
}

/** Configuracao para campo checkbox-group */
export interface CheckboxGroupConfig {
  options: Array<{ value: string; label: string }>;
  layout?: 'horizontal' | 'vertical' | 'grid';
  columns?: number;
}

/** Configuracao para campo radio-group */
export interface RadioGroupConfig {
  options: Array<{ value: string; label: string; description?: string }>;
  layout?: 'horizontal' | 'vertical';
}

/** Configuracao para campo tags */
export interface TagsConfig {
  predefinedTags?: string[];
  allowCustom?: boolean;
  maxTags?: number;
  colorByValue?: Record<string, string>;
}

/** Configuracao para campo signature */
export interface SignatureConfig {
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
}

/** Configuracao para campo lookup */
export interface LookupConfig {
  sourceEntity: string;
  searchFields: string[];
  displayFields: string[];
  previewFields?: string[];
  filterConditions?: Array<{ field: string; operator: string; value: unknown }>;
  allowCreate?: boolean;
}

/** Configuracao para campo formula */
export interface FormulaConfig {
  expression: string;
  dependsOn: string[];
  outputType: 'number' | 'text' | 'date';
  decimalPlaces?: number;
}

/** Configuracao para campo rollup */
export interface RollupConfig {
  sourceField: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  targetField?: string;
  filterConditions?: Array<{ field: string; operator: string; value: unknown }>;
}

/** Configuracao para campo action-button */
export interface ActionButtonConfig {
  label: string;
  style?: 'primary' | 'secondary' | 'danger';
  confirmMessage?: string;
  action: {
    type: 'webhook' | 'status-change' | 'custom-api' | 'email';
    config: Record<string, unknown>;
  };
  visibleIf?: { field: string; operator: string; value: unknown };
}

// ============================================================================
// VALIDACOES CONDICIONAIS
// ============================================================================

/** Condicao para validacao/visibilidade condicional */
export interface FieldCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is_empty' | 'is_not_empty';
  value: unknown;
}

/** Validador customizado */
export interface FieldValidator {
  type: 'regex' | 'min' | 'max' | 'minLength' | 'maxLength' | 'custom' | 'async';
  config: Record<string, unknown>;
  message: string;
}

/** Validacao entre campos */
export interface CrossFieldValidation {
  rule: 'greaterThan' | 'lessThan' | 'equalTo' | 'different';
  targetField: string;
  message: string;
}

// ============================================================================
// ENTITY SETTINGS EXPANDIDOS
// ============================================================================

/** Configuracao de SLA */
export interface EntitySlaConfig {
  enabled: boolean;
  defaultTargetMinutes: number;
  priorityRules?: Array<{
    condition: Record<string, unknown>;
    targetMinutes: number;
  }>;
  businessHours?: {
    timezone: string;
    schedule: Record<string, { start: string; end: string } | null>;
  };
}

/** Configuracao de auto-assignment */
export interface EntityAutoAssignConfig {
  enabled: boolean;
  targetField: string;
  strategy: 'round-robin' | 'least-loaded' | 'by-skill' | 'manual';
  skillField?: string;
  teamField?: string;
  onlyOnCreate?: boolean;
  reassignOnEscalation?: boolean;
}

/** Configuracao de escalation */
export interface EntityEscalationConfig {
  enabled: boolean;
  rules: Array<{
    condition: {
      slaBreached?: boolean;
      minutesWithoutUpdate?: number;
      statusIn?: string[];
    };
    actions: Array<{
      type: 'notify' | 'reassign' | 'change-priority' | 'webhook';
      config: Record<string, unknown>;
    }>;
  }>;
}

/** Configuracao de notificacoes */
export interface EntityNotificationConfig {
  enabled: boolean;
  events: Array<{
    trigger: 'created' | 'updated' | 'status-changed' | 'assigned' | 'commented';
    channels: ('email' | 'push' | 'socket')[];
    recipients: ('owner' | 'assignee' | 'watchers' | 'creator')[];
    template?: string;
  }>;
}

/** Dependencia entre campos */
export interface FieldDependency {
  sourceField: string;
  targetField: string;
  rule: 'copy' | 'compute' | 'apiCall' | 'conditional';
  computeTemplate?: string;
  apiEndpoint?: string;
}

/** Configuracao de auditoria */
export interface EntityAuditConfig {
  trackChanges: boolean;
  trackFields?: string[];
  retentionDays?: number;
}

export interface EntityField {
  slug: string;
  name: string;
  label?: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  default?: unknown;
  options?: Array<string | { value: string; label: string; color?: string }>;
  validation?: Record<string, unknown>;
  placeholder?: string;
  helpText?: string;

  // Grid positioning for form layout
  gridRow?: number;
  gridColSpan?: number;
  gridColStart?: number;

  // api-select specific
  apiEndpoint?: string;
  valueField?: string;
  labelField?: string;
  apiFields?: string[];
  autoFillFields?: Array<{
    sourceField: string;
    targetField: string;
  }>;

  // relation specific
  relatedEntityId?: string;
  relatedEntitySlug?: string;
  relatedDisplayField?: string;

  // number/currency specific
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;

  // text specific
  mask?: string;

  // map specific
  mapMode?: 'latlng' | 'address' | 'both';
  mapDefaultCenter?: [number, number];
  mapDefaultZoom?: number;
  mapHeight?: number;

  // sub-entity specific
  subEntityId?: string;
  subEntitySlug?: string;
  subEntityDisplayFields?: string[];
  parentDisplayField?: string; // Campo do pai para identificar o registro (fallback: id)

  // image/file specific
  imageSource?: 'camera' | 'gallery' | 'both';
  multiple?: boolean;
  maxFiles?: number;

  // Auto-fill on field change
  onChangeAutoFill?: Array<{
    targetField: string;      // Campo a ser preenchido
    sourceField?: string;     // Campo do registro relacionado a copiar (modo copiar campo - relation/api-select)
    apiEndpoint?: string;     // Endpoint do custom-api (modo API)
    valueTemplate?: string;   // Template de valor como {{now}} (modo template)
  }>;

  // zone-diagram specific
  diagramSaveMode?: 'object' | 'text'; // 'text' salva só o valor selecionado como string
  diagramImage?: string;
  diagramZones?: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    optionsSource: 'manual' | 'entity';
    options?: string[];
    sourceEntitySlug?: string;
    sourceFieldSlug?: string;
  }>;

  // user-select specific
  userSelectConfig?: UserSelectConfig;

  // workflow-status specific
  workflowConfig?: WorkflowStatusConfig;

  // timer specific
  timerConfig?: TimerConfig;

  // sla-status specific
  slaConfig?: SlaStatusConfig;

  // checkbox-group specific
  checkboxGroupConfig?: CheckboxGroupConfig;

  // radio-group specific
  radioGroupConfig?: RadioGroupConfig;

  // tags specific
  tagsConfig?: TagsConfig;

  // signature specific
  signatureConfig?: SignatureConfig;

  // lookup specific
  lookupConfig?: LookupConfig;

  // formula specific
  formulaConfig?: FormulaConfig;

  // rollup specific
  rollupConfig?: RollupConfig;

  // action-button specific
  actionButtonConfig?: ActionButtonConfig;

  // Validacoes condicionais
  requiredIf?: FieldCondition;
  visibleIf?: FieldCondition;
  readOnlyIf?: FieldCondition;
  validators?: FieldValidator[];
  crossFieldValidation?: CrossFieldValidation;
}

export interface EntitySettings {
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  enableAudit?: boolean;
  softDelete?: boolean;
  /** Auto-capture GPS geolocation on every form submit */
  captureLocation?: boolean;

  // Novas configuracoes de entidade
  /** Configuracao de SLA */
  slaConfig?: EntitySlaConfig;
  /** Configuracao de auto-assignment */
  autoAssignment?: EntityAutoAssignConfig;
  /** Configuracao de escalation */
  escalation?: EntityEscalationConfig;
  /** Configuracao de notificacoes */
  notifications?: EntityNotificationConfig;
  /** Dependencias entre campos */
  fieldDependencies?: FieldDependency[];
  /** Configuracao de auditoria detalhada */
  auditConfig?: EntityAuditConfig;
}

export interface Entity {
  id: string;
  tenantId: string;
  tenant?: Tenant;
  name: string;
  namePlural?: string;
  slug: string;
  icon?: string;
  color?: string;
  description?: string;
  category?: string;
  fields: EntityField[];
  settings?: EntitySettings;
  isSystem?: boolean;
  _count?: {
    data: number;
    archivedData?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

/** Alias para compatibilidade */
export type Field = EntityField;
