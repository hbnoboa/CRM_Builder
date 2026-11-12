import api from '@/lib/api';

export interface TeamMemberRow { id: string; name: string; email: string; avatar: string | null; isLeader: boolean }
export interface Team { id: string; name: string; description: string | null; color: string | null; createdAt: string; members: TeamMemberRow[] }

export const teamsService = {
  list: async () => (await api.get<Team[]>('/teams')).data,
  create: async (body: { name: string; description?: string; color?: string }) => (await api.post<Team>('/teams', body)).data,
  update: async (id: string, body: { name?: string; description?: string | null; color?: string | null }) =>
    (await api.patch<Team>(`/teams/${id}`, body)).data,
  remove: async (id: string) => (await api.delete(`/teams/${id}`)).data,
  setMembers: async (id: string, members: Array<{ userId: string; isLeader: boolean }>) =>
    (await api.put<Team>(`/teams/${id}/members`, { members })).data,
};
