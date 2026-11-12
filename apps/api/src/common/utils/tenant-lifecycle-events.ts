import { Prisma, TenantLifecycle } from '@prisma/client';

export type LifecycleEventSource = 'signup' | 'console' | 'trial_expired' | 'owner_closure';

type Db = Pick<Prisma.TransactionClient, 'tenantLifecycleEvent'>;

/** Grava uma mudanca comercial da empresa (historico das metricas do console). */
export async function recordLifecycleEvent(
  db: Db,
  event: { tenantId: string; from: TenantLifecycle | null; to: TenantLifecycle; source: LifecycleEventSource; staffId?: string },
): Promise<void> {
  if (event.from === event.to) return;
  await db.tenantLifecycleEvent.create({ data: event });
}
