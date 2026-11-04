import { api } from '@/lib/api';

export interface TrashItem {
  id: string;
  entity: { slug: string; name: string; icon: string | null; color: string | null };
  title: string;
  deletedAt: string;
  deletedBy: { id: string; name: string | null } | null;
  createdBy: { id: string; name: string | null } | null;
  subRecords: number;
  isSubRecord: boolean;
  purgeAt: string | null;
}

export interface TrashPage {
  data: TrashItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  retentionDays: number | null;
}

export interface TrashTable { slug: string; name: string; icon: string | null; color: string | null; count: number }

export const TRASH_RETENTION_OPTIONS = [30, 60, 90, 180, 365] as const;

export const trashService = {
  list: async (params: { entitySlug?: string; search?: string; page?: number; limit?: number }) =>
    (await api.get<TrashPage>('/trash', { params })).data,
  tables: async () => (await api.get<TrashTable[]>('/trash/tables')).data,
  settings: async () => (await api.get<{ retentionDays: number | null }>('/trash/settings')).data,
  updateSettings: async (retentionDays: number | null) =>
    (await api.patch<{ retentionDays: number | null }>('/trash/settings', { retentionDays })).data,
  restore: async (entitySlug: string, id: string) =>
    (await api.post<{ restored: number }>(`/trash/${entitySlug}/${id}/restore`)).data,
  purge: async (entitySlug: string, id: string) => (await api.delete(`/trash/${entitySlug}/${id}`)).data,
  empty: async (entitySlug?: string) => (await api.post<{ purged: number }>('/trash/empty', { entitySlug })).data,
};
