import api from '@/lib/api';

export interface MfaStatus { enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number; requiredByCompany: boolean }
export interface MfaSetup { secret: string; otpauthUrl: string; qrDataUrl: string }
export interface SessionRow { id: string; ip: string | null; userAgent: string | null; label: string | null; createdAt: string; lastUsedAt: string; current: boolean }
export interface SecurityPolicy { requireMfa: boolean; passwordMinLength: number; passwordRequireSymbol: boolean }
export interface SecurityMember { id: string; name: string; email: string; role: string; active: boolean; lastLoginAt: string | null; mfaEnabled: boolean; activeSessions: number }

export const securityApi = {
  mfaStatus: async () => (await api.get<MfaStatus>('/auth/mfa')).data,
  mfaSetup: async () => (await api.post<MfaSetup>('/auth/mfa/setup')).data,
  mfaEnable: async (code: string) => (await api.post<{ recoveryCodes: string[] }>('/auth/mfa/enable', { code })).data,
  mfaDisable: async (body: { password: string; code: string }) => (await api.post('/auth/mfa/disable', body)).data,
  recoveryCodes: async (code: string) => (await api.post<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes', { code })).data,
  sessions: async () => (await api.get<SessionRow[]>('/auth/sessions')).data,
  revokeSession: async (id: string) => (await api.delete(`/auth/sessions/${id}`)).data,
  revokeOthers: async () => (await api.post<{ revoked: number }>('/auth/sessions/revoke-others')).data,
  policy: async () => (await api.get<SecurityPolicy>('/security/policy')).data,
  updatePolicy: async (body: Partial<SecurityPolicy>) => (await api.patch<SecurityPolicy>('/security/policy', body)).data,
  members: async () => (await api.get<SecurityMember[]>('/security/members')).data,
  logoutMember: async (userId: string) => (await api.post<{ revoked: number }>(`/security/members/${userId}/logout`)).data,
};

/** "Chrome no Windows", "App CRM (celular)"... a partir do User-Agent. */
export function describeDevice(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: '—', os: '' };
  if (/Dart\//.test(ua)) return { browser: 'App', os: '' };
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl\//i.test(ua) ? 'curl' : 'Navegador';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return { browser, os };
}
