// Re-export all shared types from @crm-builder/shared
export type {
  TenantStatus,
  PermissionScope,
  FieldType,
  HttpMethod,
  FilterOperator,
  SortOrder,
  NotificationType,
  PaginationQuery,
  PaginationMeta,
  PaginatedResponse,
  AuthResponse,
  LoginCredentials,
  User,
  Tenant,
  TenantPermissions,
  Entity,
  EntityField,
  EntitySettings,
  Field,
  EntityData,
  CustomRole,
  DataFilter,
  EntityPermission,
  FieldPermission,
  ModulePermission,
  ModulePermissions,
  NotificationRule,
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
} from '@crm-builder/shared';

export { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@crm-builder/shared';

// Re-import for use in local aliases
import type { EntityData, Status as SharedStatus } from '@crm-builder/shared';

// ============================================================================
// Frontend-specific types (not shared)
// ============================================================================

// Status com PENDING adicional (usado em forms do frontend)
export type Status = SharedStatus | 'PENDING';

// Alias para compatibilidade

export interface RegisterDate {
  email: string;
  password: string;
  name: string;
  tenantName: string;
}


