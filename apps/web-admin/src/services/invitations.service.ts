import api from '@/lib/api';

export interface Invitation {
  id: string;
  email: string;
  name: string | null;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
  customRole: { id: string; name: string };
  invitedBy: { id: string; name: string } | null;
}

/** Resposta de criar/reenviar: o link sempre volta, para copiar se o e-mail nao sair. */
export interface InvitationDelivery {
  id: string;
  email: string;
  link: string;
  emailSent: boolean;
}

export interface PublicInvitation {
  status: 'pending' | 'expired' | 'accepted' | 'revoked';
  email: string;
  name: string | null;
  company: string;
  role: string;
  invitedBy: string | null;
  accountExists: boolean;
}

export const invitationsService = {
  async list(): Promise<Invitation[]> {
    return (await api.get<Invitation[]>('/invitations')).data;
  },
  async create(body: { email: string; name?: string; customRoleId: string }): Promise<InvitationDelivery> {
    return (await api.post<InvitationDelivery>('/invitations', body)).data;
  },
  async resend(id: string): Promise<InvitationDelivery> {
    return (await api.post<InvitationDelivery>(`/invitations/${id}/resend`)).data;
  },
  async revoke(id: string): Promise<void> {
    await api.delete(`/invitations/${id}`);
  },
  async publicInfo(token: string): Promise<PublicInvitation> {
    return (await api.get<PublicInvitation>(`/invitations/public/${token}`)).data;
  },
};
