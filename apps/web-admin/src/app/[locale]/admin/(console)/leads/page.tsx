'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Search } from 'lucide-react';
import { toast } from 'sonner';
import { SOLUTION_CATALOG } from '@crm-builder/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/platform/platform-ui';
import { platformApi } from '@/lib/platform-api';
import { useDebounce } from '@/hooks/use-debounce';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'WON' | 'DISCARDED';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string;
  teamSize: string | null;
  segment: string | null;
  interest: string | null;
  message: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
}

const STATUS: Record<LeadStatus, { label: string; className: string }> = {
  NEW: { label: 'Novo', className: 'bg-blue-100 text-blue-800' },
  CONTACTED: { label: 'Contatado', className: 'bg-amber-100 text-amber-800' },
  QUALIFIED: { label: 'Qualificado', className: 'bg-violet-100 text-violet-800' },
  WON: { label: 'Virou cliente', className: 'bg-emerald-100 text-emerald-800' },
  DISCARDED: { label: 'Descartado', className: 'bg-slate-100 text-slate-600' },
};
const ALL = '__all__';

/** Console: pedidos de "Falar com especialista" da pagina inicial. */
export default function ConsoleLeadsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const q = useDebounce(search, 300);
  useEffect(() => setPage(1), [status, q]);

  const { data } = useQuery({
    queryKey: ['platform', 'leads', { status, q, page }],
    queryFn: async () => (await platformApi.get<{ data: Lead[]; meta: { total: number; page: number; totalPages: number } }>('/leads', {
      params: { status: status === ALL ? undefined : status, search: q || undefined, page },
    })).data,
    placeholderData: (prev) => prev,
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { status?: LeadStatus; notes?: string } }) => (await platformApi.patch<Lead>(`/leads/${id}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'leads'] });
      toast.success('Contato atualizado');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const interestName = (slug: string | null) => (slug ? SOLUTION_CATALOG.find((s) => s.slug === slug)?.name ?? slug : '—');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contatos comerciais"
        subtitle={data ? `${data.meta.total} contato(s) · pedidos de "Falar com especialista" da página inicial` : undefined}
      />
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, empresa ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="lg:w-56" data-testid="leads-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Em aberto</SelectItem>
            {(Object.keys(STATUS) as LeadStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>)}
            <SelectItem value={ALL}>Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {data?.data.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum contato por aqui.</Card>
        )}
        {data?.data.map((lead) => {
          const open = openId === lead.id;
          return (
            <Card key={lead.id} className="p-4" data-testid="lead-row">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  onClick={() => { setOpenId(open ? null : lead.id); setNotes(lead.notes ?? ''); }}
                  aria-expanded={open}
                >
                  <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
                  <span className="min-w-0">
                    <span className="block font-medium">{lead.name} · {lead.company}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {lead.email}{lead.phone ? ` · ${lead.phone}` : ''} · {when(lead.createdAt)}
                    </span>
                  </span>
                </button>
                <span className="text-sm text-muted-foreground md:w-48 md:text-right">{interestName(lead.interest)}</span>
                <Select value={lead.status} onValueChange={(v) => update.mutate({ id: lead.id, body: { status: v as LeadStatus } })}>
                  <SelectTrigger className={cn('h-8 w-44 border-0 text-xs font-medium', STATUS[lead.status].className)}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS) as LeadStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {open && (
                <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2">
                  <dl className="space-y-2 text-sm">
                    <div><dt className="text-muted-foreground">Equipe</dt><dd>{lead.teamSize ?? '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Segmento</dt><dd>{lead.segment ?? '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Origem</dt><dd>{lead.source ?? '—'}</dd></div>
                    <div><dt className="text-muted-foreground">Mensagem</dt><dd className="whitespace-pre-wrap">{lead.message || '—'}</dd></div>
                  </dl>
                  <div className="space-y-2">
                    <label htmlFor={`notes-${lead.id}`} className="text-sm text-muted-foreground">Anotações internas</label>
                    <Textarea id={`notes-${lead.id}`} rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: demo marcada para quinta, interessado em 15 usuários" />
                    <Button size="sm" disabled={update.isPending || notes === (lead.notes ?? '')} onClick={() => update.mutate({ id: lead.id, body: { notes } })}>
                      Salvar anotação
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span>{data.meta.page} / {data.meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}
