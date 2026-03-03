// Enums & type unions
export type {
  RoleType,
  Status,
  TenantStatus,
  PermissionScope,
  FieldType,
  HttpMethod,
  AuthType,
  ApiMode,
  FilterOperator,
  SortOrder,
  NotificationType,
} from './enums';
export { ROLE_TYPES } from './enums';

// Pagination
export type {
  PaginationQuery,
  PaginationMeta,
  PaginatedResponse,
} from './pagination';
export { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from './pagination';

// Auth
export type { AuthResponse, LoginCredentials } from './auth';

// User
export type { User } from './user';

// Tenant
export type { Tenant, TenantPermissions } from './tenant';

// Entity
export type {
  Entity,
  EntityField,
  EntitySettings,
  Field,
  // Novas interfaces de configuracao de campos
  UserSelectConfig,
  WorkflowStatusConfig,
  TimerConfig,
  TimerValue,
  SlaStatusConfig,
  CheckboxGroupConfig,
  RadioGroupConfig,
  TagsConfig,
  SignatureConfig,
  LookupConfig,
  FormulaConfig,
  RollupConfig,
  ActionButtonConfig,
  // Validacoes condicionais
  FieldCondition,
  FieldValidator,
  CrossFieldValidation,
  // Entity settings expandidos
  EntitySlaConfig,
  EntityAutoAssignConfig,
  EntityEscalationConfig,
  EntityNotificationConfig,
  FieldDependency,
  EntityAuditConfig,
} from './entity';

// Entity Data
export type { EntityData } from './data';

// Custom Role & Permissions
export type {
  CustomRole,
  DataFilter,
  EntityPermission,
  FieldPermission,
  ModulePermission,
  ModulePermissions,
  NotificationRule,
} from './custom-role';

// Custom API
export type {
  CustomApi,
  FixedFilter,
  QueryParam,
  OrderByConfig,
} from './custom-api';

// Notification
export type { Notification } from './notification';

// Page
export type { Page } from './page';

// Automation
export type {
  AutomationTrigger,
  AutomationActionType,
  ConditionOperator,
  AutomationCondition,
  FieldChangeTriggerConfig,
  StatusChangeTriggerConfig,
  ScheduleTriggerConfig,
  TriggerConfig,
  SendEmailActionConfig,
  CallWebhookActionConfig,
  UpdateFieldActionConfig,
  CreateRecordActionConfig,
  NotifyUserActionConfig,
  ChangeStatusActionConfig,
  WaitActionConfig,
  AutomationAction,
  EntityAutomation,
  AutomationExecution,
  AutomationStepResult,
  FieldRuleType,
  EntityFieldRule,
} from './automation';

