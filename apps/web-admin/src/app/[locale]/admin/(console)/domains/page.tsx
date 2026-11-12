'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Globe, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/platform/platform-ui';
import { platformApi } from '@/lib/platform-api';
import { usePlatformCan } from '@/hooks/use-platform';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';

type OrderStatus = 'awaiting_payment' | 'registering' | 'registered' | 'failed' | 'cancelled';

interface DomainOrder {
  id: string;
  hostname: string;
  years: number;
  priceCents: number;
  currency: string;
  status: OrderStatus;
  registrant: { name: string; document: string; email: string; phone: string };
  provider: string;
  expiresAt: string | null;
  paidAt: string | null;
  paidByStaff: string | null;
  lastError: string | null;
  notes: string | null;
  createdAt: string;
  tenant: { id: string; name: string; slug: string } | null;
}

const ORDER_STATUS: Record<OrderStatus, { label: string; className: string }> = {
  awaiting_payment: { label: 'Aguardando pagamento', className: 'bg-amber-100 text-amber-800' },
  registering: { label: 'Registrando', className: 'bg-blue-100 text-blue-800' },
  registered: { label: 'Registrado', className: 'bg-emerald-100 text-emerald-800' },
  failed: { label: 'Falhou', className: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600' },
};
const ALL = '__all__';

const money = (cents: number, currency: string) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });
const doc = (d: string) => (d.length === 11
  ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  : d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'));

/**
 * Console: pedidos de domínio das empresas. A cobrança é feita fora do sistema
 * (Pix/boleto); ao marcar como pago, o domínio é registrado e ligado ao site.
 */
export default function ConsoleDomainsPage() {
  const qc = useQueryClient();
  const can = usePlatformCan();
  const [status, setStatus] = useState<string>('awaiting_payment');
  const [acting, setActing] = useState<{ order: DomainOrder; action: 'pay' | 'cancel' } | null>(null);
  const [notes, setNotes] = useState('');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['platform', 'domain-orders', status],
    queryFn: async () => (await platformApi.get<DomainOrder[]>('/domain-orders', { params: { status: status === ALL ? undefined : status } })).data,
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'pay' | 'cancel' }) =>
      (await platformApi.post<DomainOrder>(`/domain-orders/${id}/${action === 'pay' ? 'mark-paid' : 'cancel'}`, { notes: notes || undefined })).data,
    onSuccess: (order, vars) => {
      qc.invalidateQueries({ queryKey: ['platform', 'domain-orders'] });
      setActing(null);
      setNotes('');
      if (vars.action === 'cancel') toast.success('Pedido cancelado.');
      else if (order.status === 'registered') toast.success(`${order.hostname} registrado e ligado ao site da empresa.`);
      else toast.error(`O registro falhou: ${order.lastError || 'tente de novo'}`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Não foi possível concluir.')),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Domínios"
        subtitle="Pedidos de domínio feitos pelas empresas no Site da empresa. Cobre por fora (Pix/boleto) e marque como pago: o domínio é registrado e ligado ao site sozinho."
        actions={(
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-56" data-testid="domain-orders-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      />

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : !orders?.length ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
          <Globe className="h-8 w-8" />
          Nenhum pedido {status === ALL ? '' : `com a situação “${ORDER_STATUS[status as OrderStatus]?.label}”`}.
        </Card>
      ) : (
        <div className="space-y-3" data-testid="domain-orders">
          {orders.map((o) => (
            <Card key={o.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">{o.hostname}</p>
                  <p className="text-sm text-muted-foreground">
                    {o.tenant ? `${o.tenant.name} (${o.tenant.slug})` : 'Empresa removida'} · pedido em {new Date(o.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', ORDER_STATUS[o.status].className)}>{ORDER_STATUS[o.status].label}</span>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div><span className="text-muted-foreground">Valor: </span>{money(o.priceCents, o.currency)} · {o.years} ano(s)</div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">Titular: </span>{o.registrant.name} · {doc(o.registrant.document)} · {o.registrant.email} · {o.registrant.phone}</div>
                {o.paidAt && <div><span className="text-muted-foreground">Pago: </span>{new Date(o.paidAt).toLocaleDateString('pt-BR')}{o.paidByStaff ? ` (marcado por ${o.paidByStaff})` : ''}</div>}
                {o.expiresAt && <div><span className="text-muted-foreground">Vence: </span>{new Date(o.expiresAt).toLocaleDateString('pt-BR')}</div>}
                <div><span className="text-muted-foreground">Registrador: </span>{o.provider === 'mock' ? 'Teste (nada é registrado de verdade)' : o.provider}</div>
                {o.notes && <div className="sm:col-span-3"><span className="text-muted-foreground">Observações: </span>{o.notes}</div>}
                {o.lastError && <div className="text-red-700 sm:col-span-3">Erro: {o.lastError}</div>}
              </div>
              {can('domains.manage') && ['awaiting_payment', 'failed'].includes(o.status) && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setActing({ order: o, action: 'pay' })} data-testid="domain-mark-paid">
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> {o.status === 'failed' ? 'Tentar registrar de novo' : 'Marcar como pago e registrar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActing({ order: o, action: 'cancel' })}>
                    <XCircle className="mr-1.5 h-4 w-4" /> Cancelar pedido
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!acting} onOpenChange={(v) => { if (!v) setActing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{acting?.action === 'pay' ? `Registrar ${acting?.order.hostname}?` : `Cancelar o pedido de ${acting?.order.hostname}?`}</DialogTitle>
            <DialogDescription>
              {acting?.action === 'pay'
                ? `Confirme que o pagamento de ${acting ? money(acting.order.priceCents, acting.order.currency) : ''} foi recebido. O domínio será registrado no nome do titular e ligado ao site da empresa.`
                : 'A empresa verá o pedido como cancelado e poderá pedir de novo.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={acting?.action === 'pay' ? 'Observação (ex.: Pix recebido em 10/11, comprovante no e-mail)' : 'Motivo (opcional)'} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActing(null)}>Voltar</Button>
            <Button onClick={() => acting && act.mutate({ id: acting.order.id, action: acting.action })} disabled={act.isPending} data-testid="domain-confirm">
              {act.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {acting?.action === 'pay' ? 'Pagamento recebido, registrar' : 'Cancelar pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
