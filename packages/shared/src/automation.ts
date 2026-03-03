// Automation triggers (matches Prisma enum)
export type AutomationTrigger =
  | 'ON_CREATE'
  | 'ON_UPDATE'
  | 'ON_DELETE'
  | 'ON_FIELD_CHANGE'
  | 'ON_STATUS_CHANGE'
  | 'SCHEDULE'
  | 'MANUAL';

// Action types for automation actions array
export type AutomationActionType =
  | 'send_email'
  | 'call_webhook'
  | 'update_field'
  | 'create_record'
  | 'notify_user'
  | 'change_status'
  | 'wait';

// Condition operators
export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty';

// A single condition
export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

// Trigger configs per trigger type
export interface FieldChangeTriggerConfig {
  fieldSlug: string;
  fromValue?: unknown;
  toValue?: unknown;
}

export interface StatusChangeTriggerConfig {
  fromStatus?: string;
  toStatus?: string;
}

export interface ScheduleTriggerConfig {
  cronExpression: string;
  timezone: string;
}

export type TriggerConfig =
  | FieldChangeTriggerConfig
  | StatusChangeTriggerConfig
  | ScheduleTriggerConfig
  | Record<string, unknown>;

// Action configs
export interface SendEmailActionConfig {
  emailTemplateId?: string;
  subject?: string;
  bodyHtml?: string;
  to: string; // field slug or email address or template like {{record.data.email}}
  cc?: string;
}

export interface CallWebhookActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  bodyTemplate?: Record<string, unknown>;
  timeout?: number;
  retryCount?: number;
}

export interface UpdateFieldActionConfig {
  fieldSlug: string;
  value: unknown; // can be template like {{now}} or {{record.data.otherField}}
}

export interface CreateRecordActionConfig {
  entityId: string;
  data: Record<string, unknown>;
}

export interface NotifyUserActionConfig {
  userId?: string; // specific user or template like {{record.data.assigned_to}}
  title: string;
  message: string;
  type?: string;
}

export interface ChangeStatusActionConfig {
  fieldSlug: string;
  toStatus: string;
}

export interface WaitActionConfig {
  durationMs: number;
}

// A single action in the actions array
export interface AutomationAction {
  order: number;
  type: AutomationActionType;
  config:
    | SendEmailActionConfig
    | CallWebhookActionConfig
    | UpdateFieldActionConfig
    | CreateRecordActionConfig
    | NotifyUserActionConfig
    | ChangeStatusActionConfig
    | WaitActionConfig
    | Record<string, unknown>;
  condition?: AutomationCondition;
}

// Main EntityAutomation type
export interface EntityAutomation {
  id: string;
  tenantId: string;
  entityId: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  triggerConfig?: TriggerConfig;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  errorHandling: 'stop' | 'continue';
  maxExecutionsPerHour: number;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Execution log entry
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
  stepResults: AutomationStepResult[];
  errorMessage?: string;
  duration?: number;
  startedAt: string;
  completedAt?: string;
}

export interface AutomationStepResult {
  step: number;
  type: AutomationActionType;
  status: 'success' | 'error' | 'skipped';
  output?: unknown;
  error?: string;
  duration?: number;
}

// Field rule types
export type FieldRuleType = 'required' | 'visible' | 'default' | 'computed' | 'validation';

export interface EntityFieldRule {
  id: string;
  tenantId: string;
  entityId: string;
  fieldSlug: string;
  ruleType: FieldRuleType;
  condition?: AutomationCondition;
  config: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
