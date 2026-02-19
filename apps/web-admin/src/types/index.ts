// Re-export all shared types from @crm-builder/shared
export type {
  RoleType,
  TenantStatus,
  PermissionScope,
  FieldType,
  HttpMethod,
  AuthType,
  ApiMode,
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
  EntityPermission,
  FieldPermission,
  ModulePermission,
  ModulePermissions,
  CustomApi,
  FixedFilter,
  QueryParam,
  OrderByConfig,
  Notification,
  Page,
} from '@crm-builder/shared';

export { ROLE_TYPES, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '@crm-builder/shared';

// Re-import for use in local aliases
import type { RoleType, EntityData, Status as SharedStatus } from '@crm-builder/shared';

// ============================================================================
// Frontend-specific types (not shared)
// ============================================================================

// Status com PENDING adicional (usado em forms do frontend)
export type Status = SharedStatus | 'PENDING';

// Alias para compatibilidade
export type UserRole = RoleType;

// Alias for backwards compatibility
export type EntityDate = EntityData;

export interface RegisterDate {
  email: string;
  password: string;
  name: string;
  tenantName: string;
}

// Legacy Role interface (antes do CustomRole)
export interface Role {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  permissions: string[] | Record<string, unknown>;
  tenantId: string;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// PDF Templates Types
// ============================================================================

export interface PdfElementPosition {
  x: number;
  y: number;
}

export interface PdfElementFormat {
  type: 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'datetime' | 'time';
  locale?: string;
  decimals?: number;
  dateFormat?: string;
  currencySymbol?: string;
  prefix?: string;
  suffix?: string;
}

export interface PdfElementCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'isEmpty' | 'isNotEmpty' | 'greaterThan' | 'lessThan';
  value?: string;
}

export interface PdfElement {
  name: string;
  type: 'text' | 'image' | 'qrcode' | 'barcode' | 'table' | 'line' | 'rectangle';
  position: PdfElementPosition;
  width: number;
  height: number;
  fieldSlug?: string;
  staticValue?: string;
  expression?: string;
  format?: PdfElementFormat;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: 'normal' | 'bold';
  alignment?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  condition?: PdfElementCondition;
  // Table specific
  dataSource?: 'record' | 'subEntity' | 'dataSource';
  subEntitySlug?: string;
  dataSourceId?: string;
  columns?: PdfTableColumn[];
  footer?: PdfTableFooterItem[];
  headerStyle?: {
    backgroundColor?: string;
    fontColor?: string;
    fontWeight?: 'normal' | 'bold';
  };
  alternateRowColor?: string;
}

export interface PdfTableColumn {
  header: string;
  fieldSlug?: string;
  expression?: string;
  width?: number | 'auto';
  alignment?: 'left' | 'center' | 'right';
  format?: PdfElementFormat;
}

export interface PdfTableFooterItem {
  colSpan?: number;
  text?: string;
  aggregation?: {
    function: 'sum' | 'avg' | 'count' | 'min' | 'max';
    fieldSlug: string;
  };
  format?: PdfElementFormat;
}

export interface PdfTemplateSettings {
  pageSize?: 'A4' | 'LETTER' | 'LEGAL';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: number; right: number; bottom: number; left: number };
}

export interface PdfTemplate {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  category?: string;
  isSystem: boolean;
  isGlobal: boolean;
  entityId?: string;
  entitySlug?: string;
  basePdf: Record<string, unknown>;
  schemas: PdfElement[][];
  settings: PdfTemplateSettings;
  isPublished: boolean;
  publishedAt?: string;
  version: number;
  clonedFromId?: string;
  createdAt: string;
  updatedAt: string;
  createdById?: string;
  entity?: {
    id: string;
    name: string;
    slug: string;
    fields?: unknown[];
  };
  createdBy?: {
    id: string;
    name: string;
  };
  clonedFrom?: {
    id: string;
    name: string;
    slug: string;
  };
  _count?: {
    generations: number;
    clones: number;
  };
}

export interface PdfGeneration {
  id: string;
  tenantId: string;
  templateId: string;
  recordId?: string;
  inputData: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUrl?: string;
  fileSize?: number;
  pageCount?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
  createdById?: string;
  template?: {
    id: string;
    name: string;
    slug: string;
  };
  createdBy?: {
    id: string;
    name: string;
  };
}
