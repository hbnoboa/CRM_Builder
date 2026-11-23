/**
 * Quem usa o modo sem internet neste aparelho, por empresa: guardado quando a pessoa liga
 * o modo (com internet), para a tela de campo abrir sem precisar da API.
 */
export interface OfflineProfile {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  brandColor: string | null;
  userId: string;
  userName: string;
  roleId: string | null;
  /** Copia do cargo no momento em que ligou (o cargo sincronizado tem prioridade). */
  role: { permissions: unknown; modulePermissions: unknown } | null;
}

const KEY = (slug: string) => `offline:profile:${slug}`;

export function readOfflineProfile(slug: string): OfflineProfile | null {
  try {
    const raw = localStorage.getItem(KEY(slug));
    return raw ? (JSON.parse(raw) as OfflineProfile) : null;
  } catch {
    return null;
  }
}

export function saveOfflineProfile(profile: OfflineProfile) {
  try {
    localStorage.setItem(KEY(profile.tenantSlug), JSON.stringify(profile));
  } catch {
    /* sem armazenamento */
  }
}

export function clearOfflineProfile(slug: string) {
  try {
    localStorage.removeItem(KEY(slug));
  } catch {
    /* sem armazenamento */
  }
}
