'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, Clock, Copy, Globe, Loader2, Plus, RefreshCw, Search, ShoppingCart, Star, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  searchDomains, useCancelDomainOrder, useConnectDomain, useCreateDomainOrder, usePrimaryDomain, useRemoveDomain, useSiteDomains, useVerifyDomain,
  type DomainOrderStatus, type DomainQuote, type SiteDomain, type SiteDomainsInfo,
} from '@/hooks/use-site-domains';
import { getErrorMessage } from '@/lib/get-error-message';
import { cn } from '@/lib/utils';

const money = (cents: number, currency = 'BRL') => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });

const ORDER_LABEL: Record<DomainOrderStatus, { label: string; className: string }> = {
  awaiting_payment: { label: 'Aguardando pagamento', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  registering: { label: 'Registrando', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  registered: { label: 'Registrado', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  failed: { label: 'Com problema — a equipe vai verificar', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  cancelled: { label: 'Cancelado', className: 'bg-muted text-muted-foreground' },
};

function copy(text: string) {
  void navigator.clipboard?.writeText(text);
  toast.success('Copiado!');
}

/** O que o cliente precisa criar no DNS de onde comprou o domínio. */
function DnsInstructions({ domain, dns }: { domain: SiteDomain; dns: SiteDomainsInfo['dns'] }) {
  const name = domain.apex ? '@ (o próprio domínio)' : domain.hostname.split('.')[0];
  const rows = domain.apex
    ? dns.ips.map((ip) => ({ type: 'A', name, value: ip }))
    : [{ type: 'CNAME', name, value: dns.cname }];
  return (
    <div className="space-y-2 rounded-md border border-dashed p-3 text-sm" data-testid="domain-dns-help">
      <p className="font-medium">Para conectar, crie este registro no DNS de onde você comprou o domínio (Registro.br, GoDaddy, Hostinger…):</p>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground"><tr><th className="py-1 pr-3">Tipo</th><th className="py-1 pr-3">Nome</th><th className="py-1">Valor / destino</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.value} className="border-t">
                  <td className="py-1.5 pr-3 font-mono">{r.type}</td>
                  <td className="py-1.5 pr-3 font-mono">{r.name}</td>
                  <td className="py-1.5 font-mono">
                    {r.value}
                    <button type="button" onClick={() => copy(r.value)} className="ml-1.5 align-middle text-muted-foreground hover:text-foreground" aria-label="Copiar"><Copy className="inline h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground">
          Domínios sem “www” precisam de um registro do tipo A, e os endereços ainda não foram configurados pela equipe.
          Por enquanto, ligue a versão com www (ex.: <span className="font-mono">www.{domain.hostname}</span>), que usa CNAME.
        </p>
      )}
      <p className="text-xs text-muted-foreground">Depois de criar, pode levar de alguns minutos a algumas horas para valer. Clique em “Conferir agora” para testar.</p>
      {!!domain.found?.length && <p className="text-xs text-muted-foreground">Encontramos hoje: <span className="font-mono">{domain.found.join(' · ')}</span></p>}
    </div>
  );
}

function DomainRow({ domain, dns, onlyOne }: { domain: SiteDomain; dns: SiteDomainsInfo['dns']; onlyOne: boolean }) {
  const verify = useVerifyDomain();
  const primary = usePrimaryDomain();
  const remove = useRemoveDomain();
  const [last, setLast] = useState<SiteDomain | null>(null);
  const current = last && last.id === domain.id ? { ...domain, found: last.found } : domain;
  const status = current.status === 'active'
    ? { icon: CheckCircle2, label: 'Conectado', className: 'text-emerald-600' }
    : current.status === 'error'
      ? { icon: TriangleAlert, label: 'O DNS parou de apontar para o site', className: 'text-red-600' }
      : { icon: Clock, label: 'Aguardando o DNS', className: 'text-amber-600' };
  const Icon = status.icon;
  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="site-domain">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`https://${current.hostname}`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm font-semibold hover:underline">{current.hostname}</a>
        {current.isPrimary && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"><Star className="h-3 w-3" />Principal</span>}
        {current.kind === 'purchased' && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Comprado pela plataforma</span>}
        <span className={cn('ml-auto inline-flex items-center gap-1 text-xs font-medium', status.className)}><Icon className="h-3.5 w-3.5" />{status.label}</span>
      </div>
      {current.lastError && current.status !== 'active' && <p className="text-xs text-muted-foreground">{current.lastError}</p>}
      {current.status !== 'active' && <DnsInstructions domain={current} dns={dns} />}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={verify.isPending}
          onClick={() => verify.mutate(domain.id, { onSuccess: (d) => { setLast(d as SiteDomain); toast[(d as SiteDomain).status === 'active' ? 'success' : 'info']((d as SiteDomain).status === 'active' ? 'Domínio conectado!' : 'Ainda não aponta para o site.'); } })}>
          {verify.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}Conferir agora
        </Button>
        {current.status === 'active' && !current.isPrimary && !onlyOne && (
          <Button size="sm" variant="outline" onClick={() => primary.mutate(domain.id)} disabled={primary.isPending}><Star className="mr-1 h-3.5 w-3.5" />Tornar principal</Button>
        )}
        <Button size="sm" variant="ghost" className="text-destructive" disabled={remove.isPending}
          onClick={() => { if (window.confirm(`Desligar ${current.hostname} do site? O domínio continua sendo seu; só deixa de abrir as páginas.`)) remove.mutate(domain.id); }}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />Desligar
        </Button>
      </div>
    </div>
  );
}

/** Pedido de compra: dados do titular (dono do domínio). */
function OrderDialog({ quote, onClose }: { quote: DomainQuote | null; onClose: () => void }) {
  const create = useCreateDomainOrder();
  const [years, setYears] = useState(1);
  const [form, setForm] = useState({ name: '', document: '', email: '', phone: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));
  if (!quote) return null;
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pedir {quote.hostname}</DialogTitle>
          <DialogDescription>
            O domínio fica no nome do titular abaixo. A equipe IOS System entra em contato para o pagamento (Pix ou boleto);
            depois do pagamento ele é registrado e já liga no seu site, sem você configurar nada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Por quanto tempo</Label>
            <div className="flex gap-2">
              {[1, 2, 3].map((y) => (
                <Button key={y} type="button" size="sm" variant={years === y ? 'default' : 'outline'} onClick={() => setYears(y)}>
                  {y} {y === 1 ? 'ano' : 'anos'} · {money(quote.priceCents * y, quote.currency)}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Titular (pessoa ou empresa dona do domínio)</Label><Input value={form.name} onChange={set('name')} placeholder="Nome completo ou razão social" /></div>
            <div className="space-y-1"><Label className="text-xs">CPF ou CNPJ do titular</Label><Input value={form.document} onChange={set('document')} inputMode="numeric" placeholder="000.000.000-00" /></div>
            <div className="space-y-1"><Label className="text-xs">Telefone com DDD</Label><Input value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="(11) 99999-0000" /></div>
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs">E-mail do titular</Label><Input value={form.email} onChange={set('email')} type="email" placeholder="voce@suaempresa.com.br" /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Os dados do titular são exigidos pelo registro do domínio e ficam visíveis só para a administração da sua empresa e para a equipe IOS System.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button disabled={create.isPending} data-testid="domain-order-submit"
            onClick={() => create.mutate({ hostname: quote.hostname, years, registrant: form }, { onSuccess: onClose })}>
            {create.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Fazer o pedido · {money(quote.priceCents * years, quote.currency)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BuyDomain({ info }: { info: SiteDomainsInfo }) {
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DomainQuote[] | null>(null);
  const [picked, setPicked] = useState<DomainQuote | null>(null);
  const run = async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      setResults((await searchDomains(q)).results);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Não foi possível buscar agora.'));
    } finally {
      setSearching(false);
    }
  };
  return (
    <div className="space-y-2">
      {info.purchase.testMode && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Modo de teste: a busca e os preços são simulados e nada é registrado nem cobrado de verdade.
        </p>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void run(); }} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome que você quer. Ex.: meucafe" data-testid="domain-search" />
        <Button type="submit" variant="outline" disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="ml-1.5">Buscar</span></Button>
      </form>
      {results && (
        <div className="space-y-1.5" data-testid="domain-results">
          {results.map((r) => (
            <div key={r.hostname} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
              <span className="flex-1 font-mono">{r.hostname}</span>
              {r.available ? (
                <>
                  <span className="text-xs text-muted-foreground">{money(r.priceCents, r.currency)}/ano</span>
                  <Button size="sm" onClick={() => setPicked(r)}><ShoppingCart className="mr-1 h-3.5 w-3.5" />Quero este</Button>
                </>
              ) : <span className="text-xs text-muted-foreground">Indisponível</span>}
            </div>
          ))}
        </div>
      )}
      <OrderDialog quote={picked} onClose={() => setPicked(null)} />
    </div>
  );
}

/**
 * Domínio próprio do site: ligar um domínio que a empresa já tem (ela aponta o DNS
 * e o sistema confere) ou pedir um domínio novo (a equipe cobra e registra).
 */
export function SiteDomainsCard() {
  const { data: info, isLoading } = useSiteDomains();
  const connect = useConnectDomain();
  const cancel = useCancelDomainOrder();
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState('');
  const [tab, setTab] = useState<'connect' | 'buy'>('connect');
  if (isLoading || !info) return null;
  const primary = info.domains.find((d) => d.isPrimary && d.status === 'active');
  const openOrders = info.orders.filter((o) => o.status !== 'cancelled');

  return (
    <Card data-testid="site-domains">
      <CardContent className="p-0">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-4 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Globe className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Domínio próprio</span>
            <span className="block truncate text-sm text-muted-foreground">
              {primary ? `Seu site abre em ${primary.hostname}` : 'Use um endereço só seu (ex.: www.suaempresa.com.br): ligue um que você já tem ou peça um novo.'}
            </span>
          </span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="space-y-4 border-t p-4">
            {info.domains.length > 0 && (
              <div className="space-y-2">
                {info.domains.map((d) => <DomainRow key={d.id} domain={d} dns={info.dns} onlyOne={info.domains.filter((x) => x.status === 'active').length < 2} />)}
              </div>
            )}

            {openOrders.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Pedidos de domínio</p>
                {openOrders.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm" data-testid="domain-order">
                    <span className="font-mono">{o.hostname}</span>
                    <span className="text-xs text-muted-foreground">{o.years} {o.years === 1 ? 'ano' : 'anos'} · {money(o.priceCents, o.currency)}</span>
                    <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium', ORDER_LABEL[o.status].className)}>{ORDER_LABEL[o.status].label}</span>
                    {o.status === 'registered' && o.expiresAt && <span className="text-[11px] text-muted-foreground">vence em {new Date(o.expiresAt).toLocaleDateString('pt-BR')}</span>}
                    {o.status === 'awaiting_payment' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={cancel.isPending} onClick={() => cancel.mutate(o.id)}>Cancelar</Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 border-b pb-2">
              <Button size="sm" variant={tab === 'connect' ? 'default' : 'ghost'} onClick={() => setTab('connect')}><Plus className="mr-1 h-3.5 w-3.5" />Ligar um domínio que já tenho</Button>
              <Button size="sm" variant={tab === 'buy' ? 'default' : 'ghost'} onClick={() => setTab('buy')}><ShoppingCart className="mr-1 h-3.5 w-3.5" />Comprar um domínio</Button>
            </div>

            {tab === 'connect' ? (
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (host.trim()) connect.mutate(host, { onSuccess: () => setHost('') }); }}>
                <p className="text-xs text-muted-foreground">Digite o endereço exatamente como as pessoas vão acessar. Recomendamos a versão com www (ex.: www.suaempresa.com.br).</p>
                <div className="flex gap-2">
                  <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="www.suaempresa.com.br" data-testid="domain-connect-input" />
                  <Button type="submit" disabled={connect.isPending || !host.trim()} data-testid="domain-connect">
                    {connect.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Ligar
                  </Button>
                </div>
              </form>
            ) : info.purchase.enabled ? (
              <BuyDomain info={info} />
            ) : (
              <p className="text-sm text-muted-foreground">A compra de domínios pela plataforma ainda não está disponível. Compre no Registro.br (ou onde preferir) e ligue aqui.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
