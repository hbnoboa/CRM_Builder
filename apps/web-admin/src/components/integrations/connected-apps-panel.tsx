'use client';

import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bike, CheckCircle2, Copy, Clock, ExternalLink, HelpCircle, Link2, Loader2, Play, Plug, Plus, Puzzle, RefreshCw, Square, Store, Unlink, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/tenant-navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';

interface DeliveryStatus {
  configured: boolean;
  broken?: boolean;
  defaultStores?: string[];
  tables?: { stores: string; menu: string; orders: string; items: string };
  dashboardId?: string | null;
  stores?: Array<{ id: string; name: string }>;
  connectors?: { ifood: string; food99: string };
  demo?: { until: string; every: number } | null;
}

interface IfoodStatus {
  available: boolean;
  configured: boolean;
  authorized: boolean;
  broken: string | null;
  authorizedAt?: string | null;
  authorizedBy?: string | null;
  pending: { userCode: string; url: string; until: string } | null;
  merchants: Array<{ id: string; name: string }>;
  /** Ultima importacao do cardapio do iFood. */
  menu: { at: string; items: number; created: number; updated: number; unavailable: number; trashed: number; errors: string[] } | null;
  stores: Array<{ id: string; name: string; merchantId: string | null; merchantName: string | null }>;
}

interface Food99Status {
  available: boolean;
  configured: boolean;
  pending: { url: string; until: string } | null;
  /** Lojas autorizadas pelo link desta empresa, ainda sem loja da central. */
  candidates: Array<{ appShopId: string; name: string }>;
  stores: Array<{ id: string; name: string; appShopId: string | null; shopName: string | null }>;
}

const KEY = ['delivery-status'];
const IFOOD_KEY = ['delivery-ifood'];
const FOOD99_KEY = ['delivery-99food'];

/** Apps prontos que a empresa liga ao sistema (um cartao por app). */
const APPS = [
  {
    key: 'ifood', name: 'iFood', mark: 'iF', color: '#ea1d2c',
    summary: 'Pedidos das suas lojas no iFood entram na central de pedidos.',
    hover: 'Ao conectar, o dono da loja confirma um código no Portal do Parceiro do iFood e escolhe as lojas. Daí em diante os pedidos entram sozinhos na central de pedidos, e aceitar ou mudar a situação aqui avisa o iFood (o cliente acompanha pelo app).',
  },
  {
    key: 'food99', name: '99Food', mark: '99', color: '#f5b800',
    summary: 'Pedidos das suas lojas na 99Food entram na central de pedidos.',
    hover: 'Ao conectar, o dono da loja abre um link da 99Food e autoriza as lojas dele. Daí em diante os pedidos entram sozinhos na central de pedidos, e aceitar, marcar como pronto, entregue ou cancelar aqui avisa a 99Food.',
  },
];

function Hint({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Apps conectados: um cartao por app pronto (iFood, 99Food...) com o botao de conectar
 * e, para os apps de delivery, a central de pedidos (montar, lojas e demonstracao).
 */
const STATE: Record<string, { label: string; icon: typeof Clock; variant: 'outline' | 'secondary' }> = {
  'waiting-access': { label: 'aguardando acesso', icon: Clock, variant: 'outline' },
  ready: { label: 'pronto para conectar', icon: Plug, variant: 'outline' },
  connected: { label: 'conectado', icon: CheckCircle2, variant: 'secondary' },
  reconnect: { label: 'autorize de novo', icon: AlertTriangle, variant: 'outline' },
};

export function ConnectedAppsPanel() {
  const { data } = useQuery({ queryKey: KEY, queryFn: async () => (await api.get<DeliveryStatus>('/delivery')).data });
  const [ifoodOpen, setIfoodOpen] = useState(false);
  const [food99Open, setFood99Open] = useState(false);
  return (
    <TooltipProvider>
      <div className="space-y-6" data-testid="connected-apps">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {APPS.map((app) => {
            const key = data?.connectors?.[app.key as 'ifood' | 'food99'] ?? 'waiting-access';
            const state = STATE[key] ?? STATE['waiting-access'];
            const action = key !== 'waiting-access' ? (key === 'connected' ? 'Gerenciar' : key === 'reconnect' ? 'Autorizar de novo' : 'Conectar') : null;
            const Icon = state.icon;
            return (
            <Hint key={app.key} text={app.hover}>
              <Card className="cursor-help transition-colors hover:border-primary/40" data-testid={`app-card-${app.key}`} tabIndex={0}>
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: app.color }}>{app.mark}</span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{app.name}</span>
                      <Badge variant={state.variant} className="gap-1 font-normal" data-testid={`app-state-${app.key}`}><Icon className="h-3 w-3" /> {state.label}</Badge>
                    </span>
                    <span className="block text-xs text-muted-foreground">{app.summary}</span>
                    {action && (
                      <Button
                        size="sm" variant={key === 'connected' ? 'outline' : 'default'} className="mt-1 h-8"
                        onClick={() => (app.key === 'ifood' ? setIfoodOpen(true) : setFood99Open(true))} data-testid={`app-action-${app.key}`}
                      >
                        <Plug className="mr-1.5 h-4 w-4" /> {action}
                      </Button>
                    )}
                  </span>
                </CardContent>
              </Card>
            </Hint>
            );
          })}
          <Hint text="Mercado Pago, WhatsApp, Google Agenda, um ERP... Os apps entram aqui conforme os clientes pedem. Para algo pontual, use Avisar outros sistemas ou Chaves de API.">
            <Card className="cursor-help border-dashed" tabIndex={0} data-testid="app-card-more">
              <CardContent className="flex items-start gap-3 p-4 text-muted-foreground">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed"><Puzzle className="h-5 w-5" /></span>
                <span className="space-y-1">
                  <span className="block font-medium text-foreground">Outro app?</span>
                  <span className="block text-xs">Peça ao suporte o app que você usa.</span>
                </span>
              </CardContent>
            </Card>
          </Hint>
        </div>
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            Central de pedidos (iFood e 99Food)
            <Hint text="Os pedidos dos apps de delivery e do balcão, de todas as lojas, numa tela só, com som quando chega pedido novo. Monte agora e use com pedidos de demonstração; quando o iFood e a 99Food estiverem conectados, os pedidos de verdade entram no mesmo lugar.">
              <button type="button" aria-label="O que é a central de pedidos"><HelpCircle className="h-4 w-4 text-muted-foreground" /></button>
            </Hint>
          </h3>
          <DeliveryCenter />
        </section>
      </div>
      <IfoodDialog open={ifoodOpen} onOpenChange={setIfoodOpen} menuTable={data?.tables?.menu} />
      <Food99Dialog open={food99Open} onOpenChange={setFood99Open} />
    </TooltipProvider>
  );
}

/** Central de pedidos: montar, abrir e pedidos de demonstracao. */
function DeliveryCenter() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: async () => (await api.get<DeliveryStatus>('/delivery')).data });
  const [stores, setStores] = useState<string | null>(null);
  const [history, setHistory] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [every, setEvery] = useState(2);
  const [minutes, setMinutes] = useState(60);

  const run = async (key: string, call: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      const res = await call();
      if (res && typeof res === 'object' && 'configured' in res) queryClient.setQueryData(KEY, res);
      else void queryClient.invalidateQueries({ queryKey: KEY });
      toast.success(ok);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não deu certo. Tente de novo.'));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !data) return <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (!data.configured) {
    const list = stores ?? (data.defaultStores || []).join('\n');
    return (
      <Card data-testid="delivery-setup">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bike className="h-5 w-5 text-primary" /> Central de pedidos de delivery</CardTitle>
          <CardDescription>
            Os pedidos do iFood, da 99Food e do balcão de todas as lojas numa tela só, com som quando chega pedido novo.
            Cria as tabelas (lojas, cardápio, pedidos e itens), o painel ao vivo, um cargo de atendente para cada loja e
            a automação da hora de entrega. Dá para mudar tudo depois, no Construir do Início.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.broken && <p className="text-sm text-amber-700">A central foi montada antes, mas as tabelas não existem mais. Monte de novo.</p>}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Lojas (uma por linha)</p>
            <Textarea rows={7} value={list} onChange={(e) => setStores(e.target.value)} data-testid="delivery-stores" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={history} onCheckedChange={(v) => setHistory(v === true)} />
            Criar pedidos de exemplo das últimas 3 semanas (para os gráficos e a demonstração)
          </label>
          <Button
            onClick={() => void run('setup', async () => (await api.post('/delivery/setup', { stores: list.split('\n').map((s) => s.trim()).filter(Boolean), history }, { timeout: 180_000 })).data, 'Central de pedidos montada!')}
            disabled={busy !== null}
            data-testid="delivery-setup-button"
          >
            {busy === 'setup' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Montar a central de pedidos
          </Button>
        </CardContent>
      </Card>
    );
  }

  const panelHref = `/data?entity=${data.tables!.orders}${data.dashboardId ? `&painel=${data.dashboardId}` : ''}`;
  const until = data.demo ? new Date(data.demo.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="space-y-4" data-testid="delivery-panel">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium">Central de pedidos</p>
            <p className="text-sm text-muted-foreground">Pedidos ao vivo de {data.stores?.length ?? 0} lojas, com som quando chega pedido novo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={`/data?entity=${data.tables!.stores}`}><Store className="mr-1.5 h-4 w-4" />Editar as lojas</Link></Button>
            <Button asChild><Link href={panelHref}><ExternalLink className="mr-1.5 h-4 w-4" />Abrir a central</Link></Button>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="delivery-demo">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Demonstração</CardTitle>
          <CardDescription>
            Pedidos de mentira, como se viessem do iFood, da 99Food ou do balcão, para mostrar o sistema funcionando.
            Eles não vão para os apps: mudar a situação de um pedido de demonstração não avisa o iFood.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void run('one', async () => (await api.post('/delivery/simulate', { count: 1 })).data, 'Pedido de teste enviado')} disabled={busy !== null} data-testid="delivery-simulate">
            {busy === 'one' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Bike className="mr-1.5 h-4 w-4" />}
            Chegar um pedido agora
          </Button>
          {data.demo ? (
            <>
              <span className="text-sm" data-testid="delivery-demo-on">Chegando um pedido a cada {data.demo.every} min até {until}.</span>
              <Button variant="ghost" onClick={() => void run('stop', async () => (await api.delete('/delivery/demo')).data, 'Demonstração desligada')} disabled={busy !== null}>
                <Square className="mr-1.5 h-4 w-4" /> Parar
              </Button>
            </>
          ) : (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              Um pedido a cada
              <select className="h-9 rounded-md border bg-background px-2" value={every} onChange={(e) => setEvery(Number(e.target.value))}>
                {[1, 2, 5, 10].map((n) => <option key={n} value={n}>{n} min</option>)}
              </select>
              por
              <select className="h-9 rounded-md border bg-background px-2" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[30, 60, 120, 240].map((n) => <option key={n} value={n}>{n >= 60 ? `${n / 60} h` : `${n} min`}</option>)}
              </select>
              <Button onClick={() => void run('demo', async () => (await api.post('/delivery/demo', { every, minutes })).data, 'Demonstração ligada')} disabled={busy !== null} data-testid="delivery-demo-start">
                {busy === 'demo' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
                Ligar
              </Button>
            </span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * iFood: o dono autoriza com um codigo (prova que as lojas sao dele), depois cada loja
 * da central e ligada a uma das lojas que ele liberou. Tambem desconecta tudo.
 */
function IfoodDialog({ open, onOpenChange, menuTable }: { open: boolean; onOpenChange: (open: boolean) => void; menuTable?: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: IFOOD_KEY, queryFn: async () => (await api.get<IfoodStatus>('/delivery/ifood')).data, enabled: open });
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [authCode, setAuthCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const linked = (data?.stores ?? []).filter((s) => s.merchantId).length;

  const save = async (key: string, call: () => Promise<IfoodStatus>, ok: string | null) => {
    setBusy(key);
    try {
      queryClient.setQueryData(IFOOD_KEY, await call());
      void queryClient.invalidateQueries({ queryKey: KEY });
      setPicks((c) => ({ ...c, [key]: '' }));
      if (ok) toast.success(ok);
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não deu certo. Tente de novo.'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const syncMenu = () => save('menu', async () => (await api.post<IfoodStatus>('/delivery/ifood/menu')).data, 'Cardápio atualizado');
  const newCode = () => save('code', async () => (await api.post<IfoodStatus>('/delivery/ifood/authorize')).data, null);
  const finish = async () => {
    if (await save('finish', async () => (await api.post<IfoodStatus>('/delivery/ifood/authorize/finish', { authorizationCode: authCode.trim() })).data, 'iFood autorizado')) setAuthCode('');
  };

  const authorizeStep = data && (
    <div className="space-y-3 rounded-lg border p-4 text-sm" data-testid="ifood-authorize">
      {data.broken && <p className="flex items-center gap-1.5 text-amber-700"><AlertTriangle className="h-4 w-4" /> {data.broken}</p>}
      {!data.pending ? (
        <>
          <p>Para provar que as lojas são suas, o dono da conta da loja no iFood confirma um código no Portal do Parceiro. Leva um minuto.</p>
          <Button onClick={() => void newCode()} disabled={busy !== null} data-testid="ifood-new-code">
            {busy === 'code' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plug className="mr-1.5 h-4 w-4" />}
            Gerar código de autorização
          </Button>
        </>
      ) : (
        <>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Abra o <a href={data.pending.url} target="_blank" rel="noreferrer" className="font-medium text-primary underline">Portal do Parceiro do iFood <ExternalLink className="inline h-3 w-3" /></a> e
              entre com o login de dono da loja.
            </li>
            <li className="space-y-1">
              <span>Confira se o código é este e autorize o CRM Builder:</span>
              <span className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 text-base font-semibold tracking-widest" data-testid="ifood-user-code">{data.pending.userCode}</code>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Copiar código" onClick={() => void navigator.clipboard?.writeText(data.pending!.userCode)}><Copy className="h-3.5 w-3.5" /></Button>
              </span>
            </li>
            <li className="space-y-1.5">
              <span>O iFood mostra um código de autorização. Copie e cole aqui:</span>
              <span className="flex flex-wrap gap-2">
                <Input className="h-9 w-80 max-w-full font-mono text-xs" value={authCode} onChange={(e) => setAuthCode(e.target.value)} placeholder="Código de autorização do iFood" data-testid="ifood-auth-code" />
                <Button onClick={() => void finish()} disabled={busy !== null || authCode.trim().length < 4} data-testid="ifood-finish">
                  {busy === 'finish' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                  Concluir
                </Button>
              </span>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            O código vale até {new Date(data.pending.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.{' '}
            <button type="button" className="underline" onClick={() => void newCode()} disabled={busy !== null}>Gerar outro</button>
          </p>
        </>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="ifood-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-white" style={{ backgroundColor: '#ea1d2c' }}>iF</span>
            iFood
          </DialogTitle>
          <DialogDescription>
            Os pedidos das lojas ligadas entram sozinhos na central, e aceitar, preparar, despachar ou cancelar aqui avisa o iFood.
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !data.configured ? (
          <p className="text-sm text-muted-foreground">Monte a central de pedidos primeiro (logo abaixo, nesta página). Depois as lojas aparecem aqui para conectar.</p>
        ) : !data.authorized ? (
          authorizeStep
        ) : (
          <div className="space-y-2">
            {data.merchants.length === 0 && (
              <p className="text-sm text-amber-700">O dono não liberou nenhuma loja do iFood para o CRM Builder. Libere no Portal do Parceiro ou autorize de novo.</p>
            )}
            <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border text-sm" data-testid="ifood-stores">
              {data.stores.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2" data-testid={`ifood-store-${s.id}`}>
                  <span className="min-w-32 flex-1 font-medium">{s.name}</span>
                  {s.merchantId ? (
                    <>
                      <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" /> {s.merchantName || 'conectada'}</Badge>
                      <Button
                        size="sm" variant="ghost" disabled={busy !== null}
                        onClick={() => void save(s.id, async () => (await api.delete<IfoodStatus>(`/delivery/ifood/link/${s.id}`)).data, 'Loja desligada do iFood')}
                      >
                        <Unlink className="mr-1.5 h-4 w-4" /> Desligar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Select value={picks[s.id] ?? ''} onValueChange={(v) => setPicks((c) => ({ ...c, [s.id]: v }))} disabled={data.merchants.length === 0}>
                        <SelectTrigger className="h-8 w-64 max-w-full text-xs" data-testid={`ifood-pick-${s.id}`}><SelectValue placeholder="Escolha a loja no iFood" /></SelectTrigger>
                        <SelectContent>
                          {data.merchants.map((m) => {
                            const usedBy = data.stores.find((x) => x.merchantId === m.id);
                            return <SelectItem key={m.id} value={m.id} disabled={!!usedBy}>{m.name}{usedBy ? ` (em ${usedBy.name})` : ''}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm" disabled={busy !== null || !picks[s.id]}
                        onClick={() => void save(s.id, async () => (await api.post<IfoodStatus>('/delivery/ifood/link', { storeId: s.id, merchantId: picks[s.id] })).data, 'Loja conectada ao iFood')}
                        data-testid={`ifood-link-${s.id}`}
                      >
                        {busy === s.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plug className="mr-1.5 h-4 w-4" />}
                        Conectar
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {data.authorizedAt && (
              <p className="text-xs text-muted-foreground">
                Autorizado{data.authorizedBy ? ` por ${data.authorizedBy}` : ''} em {new Date(data.authorizedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}.
                Liberou mais lojas no iFood? Elas aparecem na lista sozinhas.
              </p>
            )}
            {linked > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm" data-testid="ifood-menu">
                <Utensils className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-48 flex-1 space-y-0.5">
                  <span className="block">
                    {data.menu?.items
                      ? <>Cardápio do iFood: {data.menu.items} {data.menu.items === 1 ? 'item' : 'itens'}{data.menu.unavailable ? ` (${data.menu.unavailable} fora de venda)` : ''}.</>
                      : 'O cardápio das lojas ligadas vem do iFood.'}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {data.menu?.at ? `Atualizado em ${new Date(data.menu.at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}. ` : ''}
                    Atualiza sozinho de hora em hora. Item que sai do iFood vai para a Lixeira.
                  </span>
                  {(data.menu?.errors ?? []).map((err) => <span key={err} className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="h-3 w-3" /> {err}</span>)}
                </span>
                {menuTable && (
                  <Button asChild size="sm" variant="ghost"><Link href={`/data?entity=${menuTable}`}>Ver cardápio</Link></Button>
                )}
                <Button size="sm" variant="outline" onClick={() => void syncMenu()} disabled={busy !== null} data-testid="ifood-menu-sync">
                  {busy === 'menu' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                  Atualizar cardápio do iFood
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {data?.authorized || linked > 0 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={busy !== null} data-testid="ifood-disconnect">
                  <Unlink className="mr-1.5 h-4 w-4" /> Desconectar o iFood
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desconectar o iFood?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {linked > 0 ? `${linked === 1 ? 'A loja conectada para' : `As ${linked} lojas conectadas param`} de receber pedidos do iFood aqui. ` : ''}
                    A autorização é apagada; para voltar, é preciso autorizar de novo. Os pedidos que já entraram continuam na central.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void save('all', async () => (await api.delete<IfoodStatus>('/delivery/ifood')).data, 'iFood desconectado')}
                  >
                    Desconectar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <span />}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 99Food: a empresa gera um link, o dono abre no portal da 99 e autoriza as lojas; as
 * lojas autorizadas aparecem aqui para ligar a uma loja da central.
 */
function Food99Dialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: FOOD99_KEY,
    queryFn: async () => (await api.get<Food99Status>('/delivery/99food')).data,
    enabled: open,
    // Com o link aberto, as lojas autorizadas pelo dono aparecem sozinhas
    refetchInterval: (q) => (q.state.data?.pending ? 5000 : false),
  });
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const linked = (data?.stores ?? []).filter((s) => s.appShopId).length;

  const save = async (key: string, call: () => Promise<Food99Status>, ok: string | null) => {
    setBusy(key);
    try {
      queryClient.setQueryData(FOOD99_KEY, await call());
      void queryClient.invalidateQueries({ queryKey: KEY });
      setPicks((c) => ({ ...c, [key]: '' }));
      if (ok) toast.success(ok);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não deu certo. Tente de novo.'));
    } finally {
      setBusy(null);
    }
  };
  const newLink = () => save('link', async () => (await api.post<Food99Status>('/delivery/99food/authorize')).data, null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="food99-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-white" style={{ backgroundColor: '#f5b800' }}>99</span>
            99Food
          </DialogTitle>
          <DialogDescription>
            Os pedidos das lojas ligadas entram sozinhos na central. Aceitar, marcar como saiu para entrega, entregue ou cancelar aqui avisa a 99Food.
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !data.configured ? (
          <p className="text-sm text-muted-foreground">Monte a central de pedidos primeiro (logo abaixo, nesta página). Depois as lojas aparecem aqui para conectar.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2 rounded-lg border p-4 text-sm" data-testid="food99-authorize">
              {!data.pending ? (
                <>
                  <p>Para ligar uma loja, o dono da conta da loja na 99Food autoriza o CRM Builder por um link. Leva um minuto.</p>
                  <Button onClick={() => void newLink()} disabled={busy !== null} data-testid="food99-new-link">
                    {busy === 'link' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plug className="mr-1.5 h-4 w-4" />}
                    Gerar link de autorização
                  </Button>
                </>
              ) : (
                <>
                  <ol className="list-decimal space-y-1.5 pl-5">
                    <li>
                      Abra (ou mande ao dono) o{' '}
                      <a href={data.pending.url} target="_blank" rel="noreferrer" className="font-medium text-primary underline" data-testid="food99-link">link de autorização da 99Food <ExternalLink className="inline h-3 w-3" /></a>
                      <Button size="icon" variant="ghost" className="ml-1 h-7 w-7" aria-label="Copiar link" onClick={() => void navigator.clipboard?.writeText(data.pending!.url)}><Copy className="h-3.5 w-3.5" /></Button>
                    </li>
                    <li>Entre com o login de dono da loja na 99, escolha a loja e clique em Autorizar.</li>
                    <li>A loja aparece aqui embaixo para ligar a uma loja da central.</li>
                  </ol>
                  <p className="text-xs text-muted-foreground">
                    O link vale até {new Date(data.pending.until).toLocaleDateString()}. Só aparecem aqui as lojas autorizadas enquanto ele vale.
                  </p>
                </>
              )}
            </div>

            {(linked > 0 || data.candidates.length > 0) && (
              <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border text-sm" data-testid="food99-stores">
                {data.stores.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2" data-testid={`food99-store-${s.id}`}>
                    <span className="min-w-32 flex-1 font-medium">{s.name}</span>
                    {s.appShopId ? (
                      <>
                        <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" /> {s.shopName || 'conectada'}</Badge>
                        <Button size="sm" variant="ghost" disabled={busy !== null}
                          onClick={() => void save(s.id, async () => (await api.delete<Food99Status>(`/delivery/99food/link/${s.id}`)).data, 'Loja desligada da 99Food')}>
                          <Unlink className="mr-1.5 h-4 w-4" /> Desligar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Select value={picks[s.id] ?? ''} onValueChange={(v) => setPicks((c) => ({ ...c, [s.id]: v }))} disabled={data.candidates.length === 0}>
                          <SelectTrigger className="h-8 w-64 max-w-full text-xs" data-testid={`food99-pick-${s.id}`}><SelectValue placeholder="Escolha a loja na 99Food" /></SelectTrigger>
                          <SelectContent>
                            {data.candidates.map((c) => <SelectItem key={c.appShopId} value={c.appShopId}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" disabled={busy !== null || !picks[s.id]} data-testid={`food99-link-${s.id}`}
                          onClick={() => void save(s.id, async () => (await api.post<Food99Status>('/delivery/99food/link', { storeId: s.id, appShopId: picks[s.id] })).data, 'Loja conectada à 99Food')}>
                          {busy === s.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plug className="mr-1.5 h-4 w-4" />}
                          Conectar
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {data.pending && data.candidates.length === 0 && linked === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Esperando o dono autorizar no portal da 99Food…</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {linked > 0 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={busy !== null} data-testid="food99-disconnect">
                  <Unlink className="mr-1.5 h-4 w-4" /> Desconectar a 99Food
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desconectar a 99Food?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {linked === 1 ? 'A loja conectada para' : `As ${linked} lojas conectadas param`} de receber pedidos da 99Food aqui. Os pedidos que já entraram continuam na central.
                    Para tirar a autorização no portal da 99Food, o dono desfaz por lá.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void save('all', async () => (await api.delete<Food99Status>('/delivery/99food')).data, '99Food desconectada')}>
                    Desconectar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <span />}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
