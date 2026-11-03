// Tipos do console da plataforma (/admin) e da assinatura do tenant.

export type TenantLifecycle = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
export type PlatformStaffRole = 'OWNER' | 'SUPPORT' | 'FINANCE' | 'READONLY';

export const FEATURE_KEYS = ['chat', 'pdf', 'automations', 'webhooks', 'publicLinks', 'mobile'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type TenantFeatures = Record<FeatureKey, boolean>;

export const LIMIT_KEYS = ['maxUsers', 'maxRecords', 'maxStorageMb'] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];
export type PlanLimits = Partial<Record<LimitKey, number | null>>;

export const TENANT_LIFECYCLES: TenantLifecycle[] = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'];
export const STAFF_ROLES: PlatformStaffRole[] = ['OWNER', 'SUPPORT', 'FINANCE', 'READONLY'];

export interface PlatformStaff {
  id: string;
  email: string;
  name: string;
  role: PlatformStaffRole;
  permissions: string[];
}

export interface PlatformStaffRow {
  id: string;
  email: string;
  name: string;
  role: PlatformStaffRole;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  limits: PlanLimits;
  features: Partial<TenantFeatures>;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  _count?: { tenants: number };
}

export interface TenantUsage {
  users: number;
  records: number;
  lastLoginAt: string | null;
  entities?: number;
  storageMb?: number;
}

export interface PlatformTenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  lifecycle: TenantLifecycle;
  trialEndsAt: string | null;
  createdAt: string;
  plan: { id: string; name: string } | null;
  limits: PlanLimits;
  usage: TenantUsage;
}

export interface PlatformTenantDetail {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: string;
  lifecycle: TenantLifecycle;
  trialEndsAt: string | null;
  featureOverrides: Partial<TenantFeatures>;
  createdAt: string;
  plan: { id: string; name: string; slug: string; features: Partial<TenantFeatures>; limits: PlanLimits } | null;
  features: TenantFeatures;
  limits: PlanLimits;
  usage: TenantUsage;
  owner: { id: string; name: string; email: string } | null;
}

export interface PlatformTenantMember {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt: string | null;
  membershipStatus: string;
  isPrimary: boolean;
  isOwner: boolean;
  role: { id: string; name: string; rank: number; fullAccess: boolean };
}

export interface PlatformTenantRole {
  id: string;
  name: string;
  rank: number;
  isDefault: boolean;
  fullAccess: boolean;
  members: number;
  publicLinks: number;
}

export interface PlatformOverview {
  tenants: { total: number; byLifecycle: Record<TenantLifecycle, number> };
  activeMemberships: number;
  trialsEnding: Array<{ id: string; name: string; slug: string; trialEndsAt: string }>;
  recentSignups: Array<{ id: string; name: string; slug: string; lifecycle: TenantLifecycle; createdAt: string }>;
}

export interface PlatformAuditRow {
  id: string;
  staffId: string;
  staffName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  tenantId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** GET /subscription — visao do proprio tenant. */
export interface TenantSubscription {
  lifecycle: TenantLifecycle;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  plan: { id: string; name: string; slug: string } | null;
  features: TenantFeatures;
  limits: PlanLimits;
  usage: { users: number; records: number; entities: number; storageMb: number };
}

// ── Copia de dados entre empresas (POST /platform/tenants/copy-data) ─────────

export interface CopyableRole {
  id: string;
  name: string;
  color: string | null;
  isSystem: boolean;
  _count: { users: number };
}

export interface CopyableEntity {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  _count: { data: number };
}

export interface CopyablePdfTemplate {
  id: string;
  name: string;
  slug: string;
  templateType: string;
  isPublished: boolean;
}

export interface CopyableAutomation {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
  entity: { name: string; slug: string };
}

export interface CopyableWebhook {
  id: string;
  name: string;
  url: string;
  method: string;
  status: string;
}

export interface CopyableFieldRule {
  id: string;
  fieldSlug: string;
  ruleType: string;
  isActive: boolean;
  entity: { name: string; slug: string };
}

export interface CopyableDashboard {
  id: string;
  name: string;
  entitySlug: string | null;
  isActive: boolean;
}

export interface CopyableData {
  roles: CopyableRole[];
  entities: CopyableEntity[];
  pdfTemplates: CopyablePdfTemplate[];
  automations: CopyableAutomation[];
  webhooks: CopyableWebhook[];
  fieldRules: CopyableFieldRule[];
  dashboardTemplates: CopyableDashboard[];
}

export interface CopyEntitySelection {
  id: string;
  includeData?: boolean;
}

export interface CopyTenantDataPayload {
  sourceTenantId: string;
  targetTenantId: string;
  conflictStrategy?: 'skip' | 'suffix';
  modules: {
    roles?: string[];
    entities?: CopyEntitySelection[];
    pdfTemplates?: string[];
    automations?: string[];
    webhooks?: string[];
    fieldRules?: string[];
    dashboardTemplates?: string[];
  };
}

export interface CopyResult {
  copied: {
    roles: number;
    entities: number;
    entityData: number;
    pdfTemplates: number;
    automations: number;
    webhooks: number;
    fieldRules: number;
    dashboardTemplates: number;
  };
  skipped: string[];
  warnings: string[];
}
