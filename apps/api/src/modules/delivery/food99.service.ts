import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma, type Entity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { DataService, type RecordUpdateListener } from '../data/data.service';
import { NotificationService } from '../notification/notification.service';
import { open, seal } from '../../common/utils/secret-box';
import { ORDER_STATUS } from './delivery-starter';
import { DeliveryService, type DeliveryConfig, type DeliveryEntities, type Food99Links } from './delivery.service';
import { Food99Client, Food99Error, TOKEN_ERRORS, type Food99Event, type Food99Order } from './food99.client';

type Status = (typeof ORDER_STATUS)[number];

const ACTOR = '99Food';
const LINK_DAYS = 7;
/** Motivo "outro" da 99 (pede o texto do motivo). */
const OTHER_REASON = 1080;

/** Situacao da 99 (status do pedido) -> situacao da central. */
function statusOf(code?: number): Status | null {
  if (code === undefined || code === null) return null;
  if (code >= 900) return 'Cancelado';
  if (code >= 600) return 'Entregue';
  if (code >= 400) return 'Saiu para entrega';
  if (code >= 200) return 'Aceito';
  if (code >= 100) return 'Novo';
  return null;
}

/** Aviso da 99 -> situacao da central (o pedido novo vem com a situacao dentro). */
const FROM_EVENT: Record<string, Status> = {
  orderConfirm: 'Aceito',
  orderConfirmed: 'Aceito',
  orderReady: 'Saiu para entrega',
  orderFinish: 'Entregue',
  orderCancel: 'Cancelado',
};

const rank = (s: string) => ORDER_STATUS.indexOf(s as Status);
const cents = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) / 100 : undefined);
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
const when = (unix?: number) => (unix ? new Date(unix * 1000).toISOString() : undefined);
/** Pedido da 99: o codigo e o numero longo do pedido (os de demonstracao tem codigo inventado). */
const ORDER_ID = /^\d{6,}$/;

/**
 * Conector da 99Food: aplicativo da IOS System na Open Platform da 99. A loja autoriza
 * pelo link de autorizacao (o dono escolhe as lojas no portal da 99) e a empresa liga
 * cada uma a uma loja da central. Os pedidos chegam por aviso (webhook) e, no sentido
 * contrario, mudar a situacao no sistema avisa a 99 (confirmar, pronto, entregue,
 * cancelar).
 */
@Injectable()
export class Food99Service implements OnModuleInit {
  private readonly logger = new Logger(Food99Service.name);
  private readonly tokens = new Map<string, { value: string; until: number }>();
  /** Avisos do mesmo pedido um de cada vez (a 99 repete o aviso se a resposta demora). */
  private readonly busy = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: Food99Client,
    private readonly delivery: DeliveryService,
    private readonly dataService: DataService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit() {
    if (!this.client.configured) return;
    this.dataService.onRecordUpdated(this.onOrderChanged);
    this.logger.log('Conector da 99Food ligado');
  }

  /** Muda partes da 99Food nas configuracoes da empresa sem sobrescrever o resto (null apaga). */
  private async patch(tenantId: string, patch: Partial<Record<keyof Food99Links, unknown>>) {
    const remove = Object.entries(patch).filter(([, v]) => v === null || v === undefined).map(([k]) => k);
    const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== null && v !== undefined));
    await this.prisma.$executeRaw`
      UPDATE "Tenant" SET settings = jsonb_set(settings::jsonb, '{delivery,food99}',
        (COALESCE(settings::jsonb #> '{delivery,food99}', '{"on": false, "stores": {}}'::jsonb) || ${JSON.stringify(set)}::jsonb) - ${remove}::text[])
      WHERE id = ${tenantId} AND settings::jsonb ? 'delivery'`;
  }

  // ---- Token de cada loja -------------------------------------------------

  private async token(tenantId: string, appShopId: string, force = false): Promise<string> {
    const key = `${tenantId}:${appShopId}`;
    const cached = this.tokens.get(key);
    if (!force && cached && cached.until > Date.now()) return cached.value;
    const saved = (await this.delivery.config(tenantId))?.food99?.tokens?.[appShopId];
    if (!force && saved && saved.until > Date.now() + 60_000) {
      const value = open(saved.token);
      this.tokens.set(key, { value, until: saved.until - 60_000 });
      return value;
    }
    if (force) await this.client.refreshToken(appShopId).catch(() => undefined);
    const t = await this.client.getToken(appShopId);
    // A 99 sorteia a validade: guarda ate um pouco antes (ou 6 h, se nao vier)
    const until = t.token_expiration_time ? t.token_expiration_time * 1000 - 120_000 : Date.now() + 6 * 3600_000;
    // Os pedidos de token sao um por vez (limite da 99): ler e regravar a lista nao atropela outro
    const tokens = { ...((await this.delivery.config(tenantId))?.food99?.tokens ?? {}), [appShopId]: { token: seal(t.auth_token), until } };
    await this.patch(tenantId, { tokens });
    this.tokens.set(key, { value: t.auth_token, until: until - 60_000 });
    return t.auth_token;
  }

  /** Chamada com o token da loja; token vencido: renova e tenta mais uma vez. */
  private async withToken<T>(tenantId: string, appShopId: string, fn: (token: string) => Promise<T>): Promise<T> {
    try {
      return await fn(await this.token(tenantId, appShopId));
    } catch (err) {
      if (!(err instanceof Food99Error) || !TOKEN_ERRORS.has(err.errno)) throw err;
      return fn(await this.token(tenantId, appShopId, true));
    }
  }

  // ---- Autorizacao e lojas -------------------------------------------------

  async status(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    const e = cfg ? await this.delivery.entities(tenantId, cfg).catch(() => null) : null;
    const base = { available: this.client.configured };
    if (!cfg || !e) return { ...base, configured: false, pending: null, candidates: [], stores: [] };
    const f = cfg.food99;
    const rows = await this.prisma.entityData.findMany({
      where: { tenantId, entityId: e.stores.id, deletedAt: null }, select: { id: true, data: true }, orderBy: { createdAt: 'asc' }, take: 50,
    });
    const byStore = new Map(Object.entries(f?.stores ?? {}).map(([appShopId, l]) => [l.storeId, { appShopId, ...l }]));
    const pending = f?.pending && f.pending.until > Date.now() ? f.pending : null;
    return {
      ...base,
      configured: true,
      pending: pending ? { url: pending.url, until: new Date(pending.until).toISOString() } : null,
      // Lojas autorizadas na 99 enquanto o link desta empresa estava aberto, ainda sem loja da central
      candidates: (pending?.candidates ?? []).filter((c) => !f?.stores?.[c.appShopId]),
      stores: rows.map((r) => {
        const link = byStore.get(r.id);
        return { id: r.id, name: String((r.data as Record<string, unknown>).nome ?? ''), appShopId: link?.appShopId ?? null, shopName: link?.name ?? null };
      }),
    };
  }

  /** Gera o link que o dono abre no portal da 99 para autorizar as lojas dele. */
  async authorize(user: CurrentUser) {
    if (!this.client.configured) throw new BadRequestException('O conector da 99Food ainda não está ligado neste servidor.');
    const tenantId = getEffectiveTenantId(user);
    if (!(await this.delivery.config(tenantId))) throw new BadRequestException('Monte a central de pedidos antes.');
    let url: string;
    try {
      url = await this.client.authorizationUrl();
    } catch (err) {
      throw new BadRequestException(`Não deu para gerar o link na 99Food agora: ${(err as Error).message}`);
    }
    const now = Date.now();
    const old = (await this.delivery.config(tenantId))?.food99?.pending;
    await this.patch(tenantId, { pending: { url, at: now, until: now + LINK_DAYS * 86_400_000, candidates: old && old.until > now ? old.candidates ?? [] : [] } });
    return this.status(user);
  }

  /** Liga uma loja da central a uma loja que o dono autorizou com o link desta empresa. */
  async link(user: CurrentUser, storeId: string, appShopId: string) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    if (!cfg) throw new BadRequestException('Monte a central de pedidos antes.');
    const candidate = cfg.food99?.pending?.candidates?.find((c) => c.appShopId === appShopId);
    if (!candidate) throw new BadRequestException('Essa loja não foi autorizada pelo link desta empresa. Gere o link e peça ao dono para autorizar de novo.');
    const e = await this.delivery.entities(tenantId, cfg);
    const store = await this.prisma.entityData.findFirst({ where: { id: storeId, tenantId, entityId: e.stores.id, deletedAt: null } });
    if (!store) throw new NotFoundException('Loja não encontrada.');
    const storeName = String((store.data as Record<string, unknown>).nome ?? '');
    if (await this.tenantOf(appShopId, tenantId)) throw new ConflictException('Essa loja da 99Food já está ligada a outra empresa.');

    const stores = Object.fromEntries(Object.entries(cfg.food99?.stores ?? {}).filter(([k, l]) => l.storeId !== storeId && k !== appShopId));
    stores[appShopId] = { storeId, store: storeName, name: candidate.name };
    await this.patch(tenantId, { on: true, stores });
    await this.prisma.entityData.update({ where: { id: store.id }, data: { data: { ...(store.data as Record<string, unknown>), food99_id: appShopId } as Prisma.InputJsonValue } });
    e.orders = await this.delivery.ensureOption(e.orders, 'loja', storeName);
    // Ligada aqui: sai da lista das outras empresas com link aberto
    await this.forget(appShopId, tenantId);
    return this.status(user);
  }

  async unlink(user: CurrentUser, storeId: string) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    if (!cfg?.food99) return this.status(user);
    const stores = Object.fromEntries(Object.entries(cfg.food99.stores ?? {}).filter(([, l]) => l.storeId !== storeId));
    await this.patch(tenantId, { on: Object.keys(stores).length > 0, stores });
    const e = await this.delivery.entities(tenantId, cfg).catch(() => null);
    const store = e ? await this.prisma.entityData.findFirst({ where: { id: storeId, tenantId, entityId: e.stores.id, deletedAt: null } }) : null;
    if (store && (store.data as Record<string, unknown>).food99_id) {
      const { food99_id: _removed, ...rest } = store.data as Record<string, unknown>;
      await this.prisma.entityData.update({ where: { id: store.id }, data: { data: rest as Prisma.InputJsonValue } });
    }
    return this.status(user);
  }

  async disconnect(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    for (const l of Object.values(cfg?.food99?.stores ?? {})) await this.unlink(user, l.storeId);
    if (cfg?.food99) await this.delivery.saveConfig(tenantId, { food99: undefined });
    for (const k of [...this.tokens.keys()]) if (k.startsWith(`${tenantId}:`)) this.tokens.delete(k);
    return this.status(user);
  }

  /** Empresas com a 99Food (ligadas ou com link aberto). */
  private async tenants() {
    const rows = await this.prisma.tenant.findMany({
      where: { settings: { path: ['delivery', 'food99'], not: Prisma.AnyNull } }, select: { id: true, settings: true },
    });
    return rows.map((t) => ({ tenantId: t.id, f: ((t.settings || {}) as { delivery?: DeliveryConfig }).delivery?.food99 })).filter((t): t is { tenantId: string; f: Food99Links } => !!t.f);
  }

  /** Empresa que ligou a loja (sem contar `except`). */
  private async tenantOf(appShopId: string, except?: string) {
    return (await this.tenants()).find((t) => t.tenantId !== except && t.f.stores?.[appShopId]) ?? null;
  }

  /** Tira a loja da lista de lojas para ligar das outras empresas. */
  private async forget(appShopId: string, except?: string) {
    for (const t of await this.tenants()) {
      if (t.tenantId === except || !t.f.pending?.candidates?.some((c) => c.appShopId === appShopId)) continue;
      await this.patch(t.tenantId, { pending: { ...t.f.pending, candidates: t.f.pending.candidates.filter((c) => c.appShopId !== appShopId) } });
    }
  }

  // ---- Avisos da 99 ----------------------------------------------------------

  async handle(ev: Food99Event) {
    const data = (typeof ev.data === 'string' ? {} : ev.data ?? {}) as Record<string, unknown>;
    if (ev.type === 'shopBindStatus') return this.onBind(data);
    if (!ev.app_shop_id) return;
    const t = await this.tenantOf(ev.app_shop_id);
    if (!t) {
      this.logger.warn(`99Food aviso ${ev.type} de loja sem empresa: ${ev.app_shop_id}`);
      return;
    }
    const link = t.f.stores[ev.app_shop_id];
    const orderId = String(data.order_id ?? '');
    this.logger.log(`99Food aviso ${ev.type} pedido=${orderId || '-'} loja=${ev.app_shop_id}`);
    if (!orderId) return;
    if (ev.type === 'orderCancelApply') return this.onCancelApply(t.tenantId, orderId, data);
    const status = ev.type === 'orderNew' ? 'Novo' : FROM_EVENT[ev.type];
    if (!status) return;
    const appShopId = ev.app_shop_id;
    const run = (this.busy.get(orderId) ?? Promise.resolve()).catch(() => undefined)
      .then(() => this.apply(t.tenantId, appShopId, link.storeId, link.store, orderId, status, ev.type === 'orderNew' ? (data.order_info as Food99Order | undefined) : undefined));
    this.busy.set(orderId, run);
    try {
      await run;
    } finally {
      if (this.busy.get(orderId) === run) this.busy.delete(orderId);
    }
  }

  /** Dono autorizou (ou desfez) lojas no portal da 99. */
  private async onBind(data: Record<string, unknown>) {
    const ids = ((data.appShopIDList as unknown[]) ?? []).map(String).filter(Boolean);
    if (ids.length === 0) return;
    const all = await this.tenants();
    if (data.bindStatus === 'unbind') {
      for (const t of all) {
        const gone = ids.filter((id) => t.f.stores?.[id]);
        if (!gone.length) continue;
        const stores = Object.fromEntries(Object.entries(t.f.stores).filter(([k]) => !gone.includes(k)));
        await this.patch(t.tenantId, { on: Object.keys(stores).length > 0, stores });
        this.logger.warn(`99Food: o dono desfez a autorizacao de ${gone.join(', ')} (empresa ${t.tenantId})`);
      }
      return;
    }
    // Lojas novas: aparecem so para as empresas com link aberto agora
    const open99 = all.filter((t) => t.f.pending && t.f.pending.until > Date.now());
    if (open99.length === 0) {
      this.logger.warn(`99Food: lojas autorizadas sem link aberto em nenhuma empresa: ${ids.join(', ')}`);
      return;
    }
    const names = new Map((await this.client.authorizedShops().catch(() => [])).filter((s) => s.app_shop_id).map((s) => [String(s.app_shop_id), s.shop_name ?? '']));
    for (const t of open99) {
      const known = new Set((t.f.pending!.candidates ?? []).map((c) => c.appShopId));
      const add = ids.filter((id) => !known.has(id) && !all.some((o) => o.f.stores?.[id])).map((id) => ({ appShopId: id, name: names.get(id) || `Loja ${id.slice(0, 8)}` }));
      if (add.length) await this.patch(t.tenantId, { pending: { ...t.f.pending, candidates: [...(t.f.pending!.candidates ?? []), ...add] } });
    }
  }

  /** Cliente pediu para cancelar pelo atendimento da 99: avisa quem atende (responde no app da 99). */
  private async onCancelApply(tenantId: string, orderId: string, data: Record<string, unknown>) {
    const cfg = await this.delivery.config(tenantId);
    if (!cfg) return;
    const e = await this.delivery.entities(tenantId, cfg);
    const order = await this.findOrder(tenantId, e, orderId);
    const numero = order ? String((order.data as Record<string, unknown>).numero ?? '') : orderId;
    await this.notifications.notifyTenant(tenantId, {
      type: 'warning',
      title: 'Cliente da 99Food pediu cancelamento',
      message: `Pedido ${numero}: ${String(data.apply_reason ?? 'sem motivo')}. Responda no app da 99Food em até 5 minutos.`,
    }, e.orders.slug, 'updated').catch(() => {});
  }

  private findOrder(tenantId: string, e: DeliveryEntities, orderId: string) {
    return this.prisma.entityData.findFirst({
      where: { tenantId, entityId: e.orders.id, deletedAt: null, data: { path: ['codigo_app'], equals: orderId } },
      select: { id: true, data: true },
    });
  }

  /** Lanca o pedido na central ou anda a situacao (so para frente; cancelado sempre vale). */
  private async apply(tenantId: string, appShopId: string, storeId: string, savedStore: string, orderId: string, status: Status, info?: Food99Order) {
    const cfg = await this.delivery.config(tenantId);
    if (!cfg) return;
    const e = await this.delivery.entities(tenantId, cfg);
    const existing = await this.findOrder(tenantId, e, orderId);
    if (!existing) {
      if (status === 'Cancelado') return;
      const order = info?.order_id ? info : await this.withToken(tenantId, appShopId, (tk) => this.client.orderDetail(tk, orderId));
      const row = await this.prisma.entityData.findFirst({ where: { id: storeId, tenantId, entityId: e.stores.id, deletedAt: null }, select: { data: true } });
      const store = String((row?.data as Record<string, unknown> | undefined)?.nome ?? savedStore);
      e.orders = await this.delivery.ensureOption(e.orders, 'loja', store);
      await this.createOrder(e, order, store, statusOf(order.status) ?? status);
      return;
    }
    const current = this.label(e.orders, 'situacao', (existing.data as Record<string, unknown>).situacao);
    if (status !== 'Cancelado' && rank(current) >= rank(status)) return;
    if (status === 'Cancelado' && current === 'Cancelado') return;
    const patch: Record<string, unknown> = { situacao: this.delivery.optionValue(e.orders, 'situacao', status) };
    if (status === 'Cancelado') patch.motivo_cancelamento = 'Cancelado na 99Food';
    if (status === 'Entregue') patch.entregue_em = new Date().toISOString();
    await this.dataService.updateFromSite(e.orders, existing.id, patch, ACTOR, { notify: false });
  }

  private label(entity: Entity, field: string, value: unknown): string {
    const f = ((entity.fields as unknown as Array<{ slug: string; options?: Array<string | { value: string; label: string }> }>) || []).find((x) => x.slug === field);
    const o = (f?.options || []).map((x) => (typeof x === 'string' ? { value: x, label: x } : x)).find((x) => x.value === value || x.label === value);
    return o?.label ?? String(value ?? '');
  }

  private payment(o: Food99Order) {
    if (o.pay_method === 1) return 'Pago no app';
    if (o.pay_type === 2) return 'Dinheiro na entrega';
    if (o.pay_type === 3) return 'Cartão na entrega';
    return 'Pago no app';
  }

  private async createOrder(e: DeliveryEntities, o: Food99Order, store: string, status: Status) {
    const a = o.receive_address ?? {};
    const pickup = o.fulfillment_mode === 1 || o.delivery_type === 0;
    const created = when(o.create_time) ?? new Date().toISOString();
    const change = o.pay_type === 2 && (o.change_for ?? 0) > 0 ? cents(o.change_for) : undefined;
    const notes = [
      change && `Troco para ${brl(change)}`,
      o.remark,
      o.need_cutlery && 'Mandar talheres',
      // Codigos de conferencia: entregador da 99 (handover) e retirada pelo cliente (takeaway)
      o.delivery_type === 1 && o.handover_code && `Código para o entregador da 99: ${o.handover_code}`,
      o.takeaway_code && `Código de retirada: ${o.takeaway_code}`,
      !pickup && a.complement && `Complemento: ${a.complement}`,
      !pickup && a.reference && `Referência: ${a.reference}`,
      a.virtual_phone_number && a.locator && `Telefone 99 do cliente: ${a.virtual_phone_number} ramal ${a.locator}`,
      o.delivery_type === 1 && 'Entrega pelo entregador da 99',
    ].filter(Boolean).join('\n');
    const data: Record<string, unknown> = {
      numero: `99-${o.order_index ?? o.order_id.slice(-6)}`,
      app: this.delivery.optionValue(e.orders, 'app', '99Food'),
      loja: this.delivery.optionValue(e.orders, 'loja', store),
      situacao: this.delivery.optionValue(e.orders, 'situacao', status),
      cliente: a.name || [a.first_name, a.last_name].filter(Boolean).join(' '),
      telefone: a.phone ?? '',
      pagamento: this.delivery.optionValue(e.orders, 'pagamento', this.payment(o)),
      endereco: pickup ? 'Retirada no balcão' : a.poi_address || a.formatted_address || [a.street_name, a.street_number, a.district].filter(Boolean).join(', '),
      recebido_em: created,
      entregar_ate: when(o.expected_arrived_eta) ?? new Date(new Date(created).getTime() + 45 * 60_000).toISOString(),
      total: cents(o.price?.real_pay_price ?? o.price?.real_price ?? o.price?.customer_need_paying_money),
      taxa_entrega: cents(o.price?.delivery_price),
      codigo_app: o.order_id,
      observacoes: notes,
    };
    const record = await this.dataService.createFromSite(e.orders, data, ACTOR, undefined, { notify: false });
    for (const it of o.order_items ?? []) {
      const qty = it.amount ?? 1;
      const options = (it.sub_item_list ?? []).map((s) => `${s.amount && s.amount > 1 ? `${s.amount}x ` : ''}${s.name ?? ''}`).filter((s) => s.trim()).join(', ');
      const extra = (it.sub_item_list ?? []).reduce((sum, s) => sum + (s.sku_price ?? 0) * (s.amount ?? 1), 0);
      await this.dataService.createFromSite(e.items, {
        produto: it.name ?? 'Item',
        quantidade: qty,
        preco: cents((it.sku_price ?? 0) + extra),
        observacao: [options, it.remark].filter(Boolean).join(' · '),
      }, ACTOR, record.id, { notify: false });
    }
  }

  // ---- Central -> 99 ---------------------------------------------------------

  /** Alguem mudou a situacao de um pedido da 99 no sistema: repassa a 99. */
  private readonly onOrderChanged: RecordUpdateListener = async ({ tenantId, entity, recordId, previous, current, user }) => {
    const cfg = await this.delivery.config(tenantId);
    if (!cfg?.food99?.on || entity.slug !== cfg.tables.orders) return;
    const orderId = typeof current.codigo_app === 'string' ? current.codigo_app : '';
    if (!ORDER_ID.test(orderId) || this.label(entity as Entity, 'app', current.app) !== '99Food') return;
    if (previous.situacao === current.situacao) return;
    // A loja do pedido diz qual token usar
    const storeLabel = this.label(entity as Entity, 'loja', current.loja);
    const appShopId = Object.entries(cfg.food99.stores ?? {}).find(([, l]) => l.store === storeLabel)?.[0]
      ?? Object.keys(cfg.food99.stores ?? {})[0];
    if (!appShopId) return;
    const from = this.label(entity as Entity, 'situacao', previous.situacao);
    const to = this.label(entity as Entity, 'situacao', current.situacao);
    const numero = String(current.numero ?? '');
    let reached = from;
    try {
      await this.withToken(tenantId, appShopId, async (tk) => {
        if (to === 'Cancelado') {
          const reason = typeof current.motivo_cancelamento === 'string' && current.motivo_cancelamento ? current.motivo_cancelamento : 'Cancelado pela loja';
          await this.client.cancel(tk, orderId, OTHER_REASON, reason.slice(0, 250));
          return;
        }
        if (rank(to) <= rank(from)) return; // a 99 nao volta situacao
        if (rank(from) < rank('Aceito')) {
          await this.client.action(tk, orderId, 'confirm');
          reached = 'Aceito';
        }
        // "Em preparo" nao tem passo na 99; "Saiu para entrega" = pronto
        if (rank(to) >= rank('Saiu para entrega') && rank(from) < rank('Saiu para entrega')) {
          await this.client.action(tk, orderId, 'ready');
          reached = 'Saiu para entrega';
        }
        if (to !== 'Entregue') return;
        // Entregue: so na entrega da propria loja; nas outras a 99 conclui
        const detail = await this.client.orderDetail(tk, orderId);
        if (detail.delivery_type === 2 && (detail.status ?? 0) < 600) await this.client.action(tk, orderId, 'delivered');
      });
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(`99Food ${from} -> ${to} pedido=${orderId}: ${message}`);
      const e = await this.delivery.entities(tenantId, cfg);
      const patch = { situacao: reached === from ? previous.situacao : this.delivery.optionValue(e.orders, 'situacao', reached) };
      await this.dataService.updateFromSite(e.orders, recordId, patch, ACTOR, { notify: false }).catch(() => {});
      if (user.id) {
        await this.notifications.notifyUser(user.id, {
          type: 'error', title: 'A 99Food não aceitou a mudança', message: `Pedido ${numero}: ${to}. ${message}`,
        }, tenantId).catch(() => {});
      }
    }
  };
}
