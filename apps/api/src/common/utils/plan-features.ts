// Funcoes (features) e limites por plano/tenant — console da plataforma.
//
// Efetivo = plano (features) sobrescrito por tenant.featureOverrides.
// Funcao ausente em ambos = LIGADA: tenants antigos (sem plano) seguem com tudo.
// Limite ausente/null = ilimitado.

export const FEATURE_KEYS = [
  'chat',
  'pdf',
  'automations',
  'webhooks',
  'publicLinks',
  'mobile',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type TenantFeatures = Record<FeatureKey, boolean>;

export const LIMIT_KEYS = ['maxUsers', 'maxRecords'] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];

export type PlanLimits = Partial<Record<LimitKey, number | null>>;

export function isFeatureKey(key: string): key is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(key);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getEffectiveFeatures(planFeatures: unknown, overrides: unknown): TenantFeatures {
  const plan = asRecord(planFeatures);
  const over = asRecord(overrides);
  const result = {} as TenantFeatures;
  for (const key of FEATURE_KEYS) {
    if (typeof over[key] === 'boolean') result[key] = over[key] as boolean;
    else if (typeof plan[key] === 'boolean') result[key] = plan[key] as boolean;
    else result[key] = true;
  }
  return result;
}

export function getPlanLimits(limits: unknown): PlanLimits {
  const raw = asRecord(limits);
  const result: PlanLimits = {};
  for (const key of LIMIT_KEYS) {
    const v = raw[key];
    result[key] = typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  }
  return result;
}

/** Sanitiza o JSON de features vindo do console (so chaves conhecidas, so boolean). */
export function sanitizeFeatures(input: unknown): Partial<TenantFeatures> {
  const raw = asRecord(input);
  const result: Partial<TenantFeatures> = {};
  for (const key of FEATURE_KEYS) {
    if (typeof raw[key] === 'boolean') result[key] = raw[key] as boolean;
  }
  return result;
}

/** Sanitiza o JSON de limites vindo do console (inteiros >= 0 ou null = ilimitado). */
export function sanitizeLimits(input: unknown): PlanLimits {
  const raw = asRecord(input);
  const result: PlanLimits = {};
  for (const key of LIMIT_KEYS) {
    const v = raw[key];
    if (v === null) result[key] = null;
    else if (typeof v === 'number' && Number.isInteger(v) && v >= 0) result[key] = v;
  }
  return result;
}
