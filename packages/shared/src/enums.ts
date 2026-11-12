// ROLE TYPES removidos (Fase 3): autorizacao e 100% permission-driven
// (modulePermissions/permissions[]). Nao existe mais tier por roleType.

// ============================================================================
// STATUS
// ============================================================================

export type Status = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TRIAL';

// ============================================================================
// PERMISSION SCOPE
// ============================================================================

/** all = todos; own = so os que criei; team = os criados por alguem das minhas equipes. */
/**
 * Quais registros o cargo ve numa tabela: todos, so os que a pessoa criou, os da
 * equipe dela, ou so os do cliente vinculado a ela (portal do cliente: o registro do
 * cliente e o que esta dentro dele ou ligado a ele).
 */
export type PermissionScope = 'all' | 'own' | 'team' | 'client';

// ============================================================================
// FIELD TYPES (Entity Builder)
// ============================================================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'email'
  | 'phone'
  | 'url'
  | 'cpf'
  | 'cnpj'
  | 'cep'
  | 'date'
  | 'datetime'
  | 'time'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'api-select'
  | 'relation'
  | 'file'
  | 'image'
  | 'color'
  | 'rating'
  | 'slider'
  | 'password'
  | 'hidden'
  | 'json'
  | 'map'
  | 'array'
  | 'sub-entity'
  | 'zone-diagram'
  // Novos tipos de campo
  | 'user-select'
  | 'workflow-status'
  | 'timer'
  | 'sla-status'
  | 'checkbox-group'
  | 'radio-group'
  | 'tags'
  | 'signature'
  | 'lookup'
  | 'formula'
  | 'rollup'
  | 'action-button'
  | 'section-title';

// ============================================================================
// HTTP / API
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

// ============================================================================
// SORT / PAGINATION
// ============================================================================

export type SortOrder = 'asc' | 'desc';

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
