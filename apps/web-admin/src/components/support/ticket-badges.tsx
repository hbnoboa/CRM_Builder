'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { TicketPriority, TicketStatus } from './support-types';

const STATUS_VARIANT: Record<TicketStatus, 'default' | 'secondary' | 'outline' | 'success' | 'warning'> = {
  OPEN: 'warning',
  WAITING_CUSTOMER: 'secondary',
  RESOLVED: 'success',
  CLOSED: 'outline',
};

/** `viewer` staff usa os rotulos do console ("Aguardando o cliente" em vez de "Aguardando voce"). */
export function TicketStatusBadge({ status, viewer = 'customer' }: { status: TicketStatus; viewer?: 'customer' | 'staff' }) {
  const t = useTranslations(viewer === 'staff' ? 'support.console.statuses' : 'support.status');
  return <Badge variant={STATUS_VARIANT[status]} data-testid={`ticket-status-${status}`}>{t(status)}</Badge>;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const t = useTranslations('support.priority');
  if (priority === 'NORMAL' || priority === 'LOW') return null;
  return <Badge variant={priority === 'URGENT' ? 'destructive' : 'warning'}>{t(priority)}</Badge>;
}
