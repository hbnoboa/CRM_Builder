'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, CheckCircle2, Clock, ExternalLink, Loader2, Play, Plus, Square, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/tenant-navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/get-error-message';

interface DeliveryStatus {
  configured: boolean;
  broken?: boolean;
  defaultStores?: string[];
  tables?: { stores: string; menu: string; orders: string; items: string };
  dashboardId?: string | null;
  stores?: Array<{ id: string; name: string; active: boolean; ifoodId: string; food99Id: string }>;
  connectors?: { ifood: string; food99: string };
  demo?: { until: string; every: number } | null;
}

const KEY = ['delivery-status'];

/**
 * Apps de delivery: monta a central de pedidos (varias lojas, iFood, 99Food e balcao)
 * e, ate os conectores ficarem prontos, gera pedidos de demonstracao.
 */
export function DeliveryPanel() {
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
          <Button asChild><Link href={panelHref}><ExternalLink className="mr-1.5 h-4 w-4" />Abrir a central</Link></Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { key: 'ifood', name: 'iFood', text: 'Falta o acesso de desenvolvedor no portal do iFood. Com ele, os pedidos das lojas entram aqui sozinhos e aceitar ou mudar a situação avisa o iFood.' },
          { key: 'food99', name: '99Food', text: 'Falta o acesso pela 99Food (padrão Open Delivery). Depois, funciona igual ao iFood.' },
        ].map((c) => (
          <Card key={c.key} data-testid={`delivery-connector-${c.key}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                {c.name}
                <Badge variant="outline" className="gap-1 font-normal"><Clock className="h-3 w-3" /> aguardando acesso</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{c.text}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Store className="h-4 w-4" /> Lojas</CardTitle>
          <CardDescription>Os códigos de cada loja nos apps entram na tabela Lojas e são usados pela integração.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-lg border text-sm" data-testid="delivery-store-list">
            {(data.stores || []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">iFood: {s.ifoodId || '—'} · 99Food: {s.food99Id || '—'}</span>
                {s.active ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> recebendo</Badge> : <Badge variant="outline">pausada</Badge>}
              </li>
            ))}
          </ul>
          <Button asChild variant="link" className="px-0"><Link href={`/data?entity=${data.tables!.stores}`}>Editar as lojas</Link></Button>
        </CardContent>
      </Card>

      <Card data-testid="delivery-demo">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Demonstração</CardTitle>
          <CardDescription>Pedidos de mentira, como se viessem do iFood, da 99Food ou do balcão, para mostrar o sistema funcionando.</CardDescription>
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
