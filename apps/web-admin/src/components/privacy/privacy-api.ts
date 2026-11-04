import api from '@/lib/api';

export interface TenantClosure { requestedAt: string; requestedByEmail: string; reason: string | null; deleteAfter: string }
export interface CompanyPrivacy { tenantName: string; isOwner: boolean; canExport: boolean; graceDays: number; closure: TenantClosure | null }

export const privacyApi = {
  company: async () => (await api.get<CompanyPrivacy>('/privacy/company')).data,
  close: async (body: { password: string; code?: string; confirmName: string; reason?: string }) =>
    (await api.post<{ closure: TenantClosure }>('/privacy/company/close', body)).data,
  deleteMe: async (body: { password: string; code?: string; confirm: string }) =>
    (await api.post<{ success: boolean }>('/privacy/me/delete', body)).data,
};
