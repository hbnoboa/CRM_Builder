export type TicketStatus = 'OPEN' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export const TICKET_CATEGORIES = ['question', 'problem', 'billing', 'suggestion'] as const;
export const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
export const TICKET_STATUSES: TicketStatus[] = ['OPEN', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];

export interface TicketRow {
  id: string;
  number: number;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdByName: string;
  createdByEmail: string;
  createdById: string | null;
  lastMessageAt: string;
  lastMessageBy: 'customer' | 'staff';
  createdAt: string;
  closedAt: string | null;
  assignedStaffId: string | null;
}

export interface TicketMessage {
  id: string;
  authorType: 'customer' | 'staff' | 'system';
  authorName: string;
  authorStaffId?: string | null;
  body: string;
  internal?: boolean;
  createdAt: string;
}

export interface TicketDetail extends TicketRow {
  messages: TicketMessage[];
  tenant?: { id: string; name: string; slug: string; lifecycle?: string; plan?: { name: string } | null };
}
