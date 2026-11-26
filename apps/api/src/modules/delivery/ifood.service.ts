import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, type Entity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { DataService, type RecordUpdateListener } from '../data/data.service';
import { NotificationService } from '../notification/notification.service';
import { ORDER_STATUS } from './delivery-starter';
import { DeliveryService, type DeliveryConfig, type DeliveryEntities, type IfoodLinks } from './delivery.service';
import { IfoodClient, IfoodError, type IfoodEvent, type IfoodOrder } from './ifood.client';

type Status = (typeof ORDER_STATUS)[number];

const POLL_MS = 30_000;
const ACTOR = 'iFood';
/** Um evento que falha sempre e confirmado depois disso, para nao travar a fila. */
const MAX_TRIES = 5;

/** Situacao do iFood -> situacao da central. Codigos que nao mudam a situacao ficam de fora. */
const FROM_IFOOD: Record<string, Status> = {
  PLC: 'Novo',
  CFM: 'Aceito',
  SPS: 'Em preparo',
  PRS: 'Em preparo',
  DSP: 'Saiu para entrega',
  CON: 'Entregue',
  CAN: 'Cancelado',
};

const rank = (s: string) => ORDER_STATUS.indexOf(s as Status);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : undefined);

/**
 * Conector do iFood (fase 2). Le a fila de eventos das lojas ligadas a cada 30 s (o
 * que tambem mantem a loja aberta no app), lanca o pedido na central e acompanha a
 * situacao. No sentido contrario, quando alguem muda a situacao de um pedido do iFood
 * no sistema, avisa o iFood (aceitar, preparo, despacho, cancelamento).
 */
@Injectable()
export class IfoodService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IfoodService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly tries = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: IfoodClient,
    private readonly delivery: DeliveryService,
    private readonly dataService: DataService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit() {
    if (!this.client.configured) return;
    this.dataService.onRecordUpdated(this.onOrderChanged);
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    this.logger.log('Conector do iFood ligado');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---- Ligar lojas -------------------------------------------------------

  async status(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    if (!cfg) return { available: this.client.configured, configured: false, stores: [] };
    const e = await this.delivery.entities(tenantId, cfg);
    const rows = await this.prisma.entityData.findMany({
      where: { tenantId, entityId: e.stores.id, deletedAt: null }, select: { id: true, data: true }, orderBy: { createdAt: 'asc' }, take: 50,
    });
    const links = cfg.ifood?.merchants ?? {};
    const byStore = new Map(Object.entries(links).map(([merchantId, l]) => [l.storeId, { merchantId, ...l }]));
    return {
      available: this.client.configured,
      configured: true,
      stores: rows.map((r) => {
        const link = byStore.get(r.id);
        return { id: r.id, name: String((r.data as Record<string, unknown>).nome ?? ''), merchantId: link?.merchantId ?? null, merchantName: link?.name ?? null };
      }),
    };
  }

  /** Liga uma loja da central a uma loja do iFood que ja autorizou o aplicativo. */
  async link(user: CurrentUser, storeId: string, merchantId: string) {
    if (!this.client.configured) throw new BadRequestException('O conector do iFood ainda não está ligado neste servidor.');
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    if (!cfg) throw new BadRequestException('Monte a central de pedidos antes.');
    const e = await this.delivery.entities(tenantId, cfg);
    const store = await this.prisma.entityData.findFirst({ where: { id: storeId, tenantId, entityId: e.stores.id, deletedAt: null } });
    if (!store) throw new NotFoundException('Loja não encontrada.');
    const storeName = String((store.data as Record<string, unknown>).nome ?? '');
    const id = merchantId.trim();

    // Uma loja do iFood fica em uma empresa so
    const others = await this.prisma.tenant.findMany({
      where: { id: { not: tenantId }, settings: { path: ['delivery', 'ifood', 'on'], equals: true } }, select: { settings: true },
    });
    if (others.some((t) => ((t.settings || {}) as { delivery?: DeliveryConfig }).delivery?.ifood?.merchants?.[id])) {
      throw new ConflictException('Essa loja do iFood já está ligada a outra empresa.');
    }

    let merchant: { id: string; name: string } | null;
    try {
      merchant = await this.client.merchant(id);
    } catch (err) {
      if (err instanceof IfoodError && [400, 401, 403, 404].includes(err.status)) {
        throw new BadRequestException('O iFood não liberou essa loja para o CRM Builder. Confira o código e, no Portal do Parceiro do iFood, autorize o aplicativo.');
      }
      throw new BadRequestException(`Não deu para falar com o iFood agora: ${(err as Error).message}`);
    }
    if (!merchant) throw new BadRequestException('O iFood não encontrou essa loja.');

    const merchants = { ...(cfg.ifood?.merchants ?? {}) };
    for (const [k, l] of Object.entries(merchants)) if (l.storeId === storeId) delete merchants[k];
    merchants[merchant.id] = { storeId, store: storeName, name: merchant.name };
    await this.delivery.saveConfig(tenantId, { ifood: { on: true, merchants } });
    await this.prisma.entityData.update({
      where: { id: store.id }, data: { data: { ...(store.data as Record<string, unknown>), ifood_id: merchant.id } as Prisma.InputJsonValue },
    });
    return this.status(user);
  }

  async unlink(user: CurrentUser, storeId: string) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    if (!cfg?.ifood) return this.status(user);
    const merchants = Object.fromEntries(Object.entries(cfg.ifood.merchants).filter(([, l]) => l.storeId !== storeId));
    await this.delivery.saveConfig(tenantId, { ifood: { on: Object.keys(merchants).length > 0, merchants } });
    return this.status(user);
  }

  // ---- iFood -> central ---------------------------------------------------

  /** Lojas ligadas de todas as empresas: codigo no iFood -> empresa e loja. */
  private async links() {
    const tenants = await this.prisma.tenant.findMany({
      where: { settings: { path: ['delivery', 'ifood', 'on'], equals: true } }, select: { id: true, settings: true },
    });
    const map = new Map<string, { tenantId: string; store: string }>();
    for (const t of tenants) {
      const ifood = ((t.settings || {}) as { delivery?: DeliveryConfig }).delivery?.ifood as IfoodLinks | undefined;
      for (const [merchantId, l] of Object.entries(ifood?.merchants ?? {})) map.set(merchantId, { tenantId: t.id, store: l.store });
    }
    return map;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const links = await this.links();
      const ids = [...links.keys()];
      for (let i = 0; i < ids.length; i += 50) {
        const events = await this.client.poll(ids.slice(i, i + 50));
        const done: string[] = [];
        for (const ev of events) {
          const link = ev.merchantId ? links.get(ev.merchantId) : undefined;
          try {
            if (link) await this.handle(link.tenantId, link.store, ev);
            done.push(ev.id);
            this.tries.delete(ev.id);
          } catch (err) {
            const n = (this.tries.get(ev.id) ?? 0) + 1;
            this.tries.set(ev.id, n);
            this.logger.warn(`iFood evento ${ev.code} pedido=${ev.orderId} (tentativa ${n}): ${(err as Error).message}`);
            if (n >= MAX_TRIES) {
              done.push(ev.id);
              this.tries.delete(ev.id);
            }
          }
        }
        await this.client.ack(done);
      }
    } catch (err) {
      this.logger.error(`iFood polling: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private findOrder(tenantId: string, e: DeliveryEntities, orderId: string) {
    return this.prisma.entityData.findFirst({
      where: { tenantId, entityId: e.orders.id, deletedAt: null, data: { path: ['codigo_app'], equals: orderId } },
      select: { id: true, data: true },
    });
  }

  private async handle(tenantId: string, store: string, ev: IfoodEvent) {
    const cfg = await this.delivery.config(tenantId);
    if (!cfg) return;
    const e = await this.delivery.entities(tenantId, cfg);
    const status = FROM_IFOOD[ev.code];
    const existing = await this.findOrder(tenantId, e, ev.orderId);

    if (!existing) {
      // Pedido que a central ainda nao tem (normalmente o PLC, mas pode chegar fora de ordem)
      if (!status || status === 'Cancelado') return;
      const order = await this.client.order(ev.orderId);
      if (!order) throw new Error('pedido sem detalhes');
      await this.createOrder(e, order, store, status);
      return;
    }
    if (!status) return;

    const current = (existing.data as Record<string, unknown>).situacao;
    const currentLabel = this.label(e.orders, 'situacao', current);
    // So anda para frente (o eco das mudancas feitas aqui nao volta a situacao)
    if (status !== 'Cancelado' && rank(currentLabel) >= rank(status)) return;
    if (status === 'Cancelado' && currentLabel === 'Cancelado') return;
    const patch: Record<string, unknown> = { situacao: this.delivery.optionValue(e.orders, 'situacao', status) };
    if (status === 'Cancelado') patch.motivo_cancelamento = this.cancelReason(ev);
    if (status === 'Entregue') patch.entregue_em = ev.createdAt ?? new Date().toISOString();
    await this.dataService.updateFromSite(e.orders, existing.id, patch, ACTOR, { notify: false });
  }

  private cancelReason(ev: IfoodEvent): string {
    const m = ev.metadata ?? {};
    for (const k of ['CANCEL_REASON', 'cancelReason', 'reason', 'REASON', 'description']) {
      if (typeof m[k] === 'string' && m[k]) return `iFood: ${m[k] as string}`;
    }
    return 'Cancelado no iFood';
  }

  private label(entity: Entity, field: string, value: unknown): string {
    const f = ((entity.fields as unknown as Array<{ slug: string; options?: Array<string | { value: string; label: string }> }>) || []).find((x) => x.slug === field);
    const o = (f?.options || []).map((x) => (typeof x === 'string' ? { value: x, label: x } : x)).find((x) => x.value === value || x.label === value);
    return o?.label ?? String(value ?? '');
  }

  private payment(order: IfoodOrder): string {
    const p = order.payments;
    if (p && (p.pending ?? 0) <= 0 && (p.prepaid ?? 0) > 0) return 'Pago no app';
    const method = (p?.methods ?? []).find((m) => !m.prepaid)?.method?.toUpperCase() ?? '';
    if (method === 'CASH') return 'Dinheiro na entrega';
    if (method) return 'Cartão na entrega';
    return 'Pago no app';
  }

  private async createOrder(e: DeliveryEntities, order: IfoodOrder, store: string, status: Status) {
    const addr = order.delivery?.deliveryAddress;
    const takeout = (order.orderType ?? '').toUpperCase() === 'TAKEOUT';
    const address = takeout
      ? 'Retirada no balcão'
      : addr?.formattedAddress || [addr?.streetName, addr?.streetNumber, addr?.neighborhood].filter(Boolean).join(', ');
    const created = order.createdAt ?? new Date().toISOString();
    const due = order.delivery?.deliveryDateTime ?? order.takeout?.takeoutDateTime ?? new Date(new Date(created).getTime() + 45 * 60_000).toISOString();
    const notes = [
      order.extraInfo,
      addr?.complement && `Complemento: ${addr.complement}`,
      addr?.reference && `Referência: ${addr.reference}`,
      order.customer?.phone?.localizer && `Código do telefone iFood: ${order.customer.phone.localizer}`,
    ].filter(Boolean).join('\n');
    const knownStores = this.storeLabels(e.orders);
    const data: Record<string, unknown> = {
      numero: `IF-${order.displayId ?? order.id.slice(0, 8)}`,
      app: this.delivery.optionValue(e.orders, 'app', 'iFood'),
      ...(knownStores.includes(store) ? { loja: this.delivery.optionValue(e.orders, 'loja', store) } : {}),
      situacao: this.delivery.optionValue(e.orders, 'situacao', status),
      cliente: order.customer?.name ?? '',
      telefone: order.customer?.phone?.number ?? '',
      pagamento: this.delivery.optionValue(e.orders, 'pagamento', this.payment(order)),
      endereco: address,
      recebido_em: created,
      entregar_ate: due,
      total: num(order.total?.orderAmount),
      taxa_entrega: num(order.total?.deliveryFee),
      codigo_app: order.id,
      observacoes: notes,
    };
    const record = await this.dataService.createFromSite(e.orders, data, ACTOR, undefined, { notify: false });
    for (const it of order.items ?? []) {
      const options = (it.options ?? []).map((o) => `${o.quantity && o.quantity > 1 ? `${o.quantity}x ` : ''}${o.name}`).filter(Boolean).join(', ');
      const qty = it.quantity ?? 1;
      await this.dataService.createFromSite(e.items, {
        produto: it.name ?? 'Item',
        quantidade: qty,
        preco: num(it.unitPrice ?? (it.totalPrice !== undefined ? it.totalPrice / qty : undefined)),
        observacao: [options, it.observations].filter(Boolean).join(' · '),
      }, ACTOR, record.id, { notify: false });
    }
  }

  private storeLabels(entity: Entity): string[] {
    const f = ((entity.fields as unknown as Array<{ slug: string; options?: Array<string | { label: string }> }>) || []).find((x) => x.slug === 'loja');
    return (f?.options || []).map((x) => (typeof x === 'string' ? x : x.label));
  }

  // ---- Central -> iFood ---------------------------------------------------

  /** Alguem mudou a situacao de um pedido do iFood no sistema: repassa ao iFood. */
  private readonly onOrderChanged: RecordUpdateListener = async ({ tenantId, entity, recordId, previous, current, user }) => {
    const cfg = await this.delivery.config(tenantId);
    if (!cfg?.ifood?.on || entity.slug !== cfg.tables.orders) return;
    if (previous.situacao === current.situacao) return;
    const orderId = typeof current.codigo_app === 'string' ? current.codigo_app : '';
    if (!orderId || this.label(entity as Entity, 'app', current.app) !== 'iFood') return;
    const from = this.label(entity as Entity, 'situacao', previous.situacao);
    const to = this.label(entity as Entity, 'situacao', current.situacao);

    try {
      if (to === 'Cancelado') {
        const reasons = await this.client.cancellationReasons(orderId);
        const code = reasons[0]?.cancelCodeId ?? reasons[0]?.code;
        if (!code) throw new Error('o iFood não deixou cancelar este pedido agora');
        const reason = typeof current.motivo_cancelamento === 'string' && current.motivo_cancelamento ? current.motivo_cancelamento : reasons[0]?.description ?? 'Cancelado pela loja';
        await this.client.requestCancellation(orderId, reason.slice(0, 250), code);
        return;
      }
      if (rank(to) <= rank(from) || to === 'Entregue') return; // o iFood conclui a entrega sozinho
      if (rank(from) < rank('Aceito')) await this.client.action(orderId, 'confirm');
      if (to === 'Em preparo') await this.client.action(orderId, 'startPreparation');
      if (to === 'Saiu para entrega') {
        const order = await this.client.order(orderId);
        await this.client.action(orderId, (order?.orderType ?? '').toUpperCase() === 'TAKEOUT' ? 'readyToPickup' : 'dispatch');
      }
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(`iFood ${from} -> ${to} pedido=${orderId}: ${message}`);
      // Volta a situacao e avisa quem mudou: o pedido no iFood nao mudou
      const e = await this.delivery.entities(tenantId, cfg);
      await this.dataService.updateFromSite(e.orders, recordId, { situacao: previous.situacao }, ACTOR, { notify: false }).catch(() => {});
      if (user.id) {
        await this.notifications.notifyError(user.id, 'O iFood não aceitou a mudança', `Pedido ${String(current.numero ?? '')}: ${to}. ${message}`).catch(() => {});
      }
    }
  };
}
