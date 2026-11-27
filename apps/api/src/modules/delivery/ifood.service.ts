import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, type Entity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { DataService, type RecordCreateListener, type RecordDeleteListener, type RecordUpdateListener } from '../data/data.service';
import { NotificationService } from '../notification/notification.service';
import { invalidateEntityQueryCache } from '../../common/services/entity-query-cache';
import { DELIVERY_CODE_HELP, ORDER_STATUS } from './delivery-starter';
import { DeliveryService, type DeliveryConfig, type DeliveryEntities, type IfoodLinks } from './delivery.service';
import { open, seal } from '../../common/utils/secret-box';
import { IfoodMenuService, MENU_PUSH_FIELDS, changed, storeOf } from './ifood-menu.service';
import { IfoodClient, IfoodError, type IfoodAuth, type IfoodEvent, type IfoodOrder, type IfoodTokens, type IfoodUserCode } from './ifood.client';

type Status = (typeof ORDER_STATUS)[number];

const POLL_MS = 30_000;
/** Cardapio: de hora em hora (o botao do cartao importa na hora). */
const MENU_MS = 60 * 60_000;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rank = (s: string) => ORDER_STATUS.indexOf(s as Status);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : undefined);
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');

/**
 * Conector do iFood (fase 2), aplicativo distribuido: cada empresa autoriza com o
 * codigo do dono (prova que as lojas sao dela) e so liga lojas que o dono liberou.
 * Le a fila de eventos das lojas ligadas a cada 30 s, com a autorizacao de cada
 * empresa (o que tambem mantem a loja aberta no app), lanca o pedido na central e
 * acompanha a situacao. No sentido contrario, quando alguem muda a situacao de um pedido do iFood
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
    private readonly menu: IfoodMenuService,
  ) {}

  onModuleInit() {
    if (!this.client.configured) return;
    this.dataService.onRecordUpdated(this.onOrderChanged);
    this.dataService.onRecordCreated(this.onMenuCreated);
    this.dataService.onRecordUpdated(this.onMenuChanged);
    this.dataService.onRecordDeleted(this.onMenuDeleted);
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    this.logger.log('Conector do iFood ligado');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---- Autorizacao do dono ------------------------------------------------

  /** Token de acesso de cada empresa em memoria (o cifrado fica nas configuracoes). */
  private readonly tokens = new Map<string, { value: string; until: number }>();
  private readonly forceRefresh = new Set<string>();

  /** Autorizacao da empresa: usa o token guardado e renova quando vence. */
  private auth(tenantId: string): IfoodAuth {
    return {
      token: async () => {
        const forced = this.forceRefresh.has(tenantId);
        const cached = this.tokens.get(tenantId);
        if (!forced && cached && cached.until > Date.now()) return cached.value;
        const a = (await this.delivery.config(tenantId))?.ifood?.auth;
        if (!a || a.broken) throw new IfoodError('A empresa ainda não autorizou o iFood (ou a autorização venceu).', 401);
        if (!forced && a.accessUntil > Date.now() + 60_000) {
          const value = open(a.access);
          this.tokens.set(tenantId, { value, until: a.accessUntil - 60_000 });
          return value;
        }
        let t: IfoodTokens;
        try {
          t = await this.client.refresh(open(a.refresh));
        } catch (err) {
          if (err instanceof IfoodError && err.status >= 400 && err.status < 500) {
            await this.patchIfood(tenantId, { auth: { ...a, broken: 'A autorização do iFood venceu. Gere um código novo e autorize de novo.' } });
            this.tokens.delete(tenantId);
          }
          throw err;
        }
        await this.saveTokens(tenantId, t);
        return t.accessToken;
      },
      reset: () => {
        this.tokens.delete(tenantId);
        this.forceRefresh.add(tenantId);
      },
    };
  }

  /** Guarda os tokens cifrados (so a parte da autorizacao, sem reescrever o resto). */
  private async saveTokens(tenantId: string, t: IfoodTokens) {
    const accessUntil = Date.now() + Math.max((t.expiresIn ?? 3600) - 120, 60) * 1000;
    const patch = { access: seal(t.accessToken), refresh: seal(t.refreshToken), accessUntil, broken: null };
    await this.prisma.$executeRaw`
      UPDATE "Tenant" SET settings = jsonb_set(settings::jsonb, '{delivery,ifood,auth}',
        COALESCE(settings::jsonb #> '{delivery,ifood,auth}', '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb)
      WHERE id = ${tenantId}`;
    this.tokens.set(tenantId, { value: t.accessToken, until: accessUntil - 60_000 });
    this.forceRefresh.delete(tenantId);
  }

  /** Muda partes do iFood nas configuracoes da empresa sem sobrescrever o resto (null apaga). */
  private async patchIfood(tenantId: string, patch: Partial<Record<keyof IfoodLinks, unknown>>) {
    const remove = Object.entries(patch).filter(([, v]) => v === null || v === undefined).map(([k]) => k);
    const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== null && v !== undefined));
    await this.prisma.$executeRaw`
      UPDATE "Tenant" SET settings = jsonb_set(settings::jsonb, '{delivery,ifood}',
        (COALESCE(settings::jsonb #> '{delivery,ifood}', '{"on": false, "merchants": {}}'::jsonb) || ${JSON.stringify(set)}::jsonb) - ${remove}::text[])
      WHERE id = ${tenantId} AND settings::jsonb ? 'delivery'`;
  }

  async status(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    const e = cfg ? await this.delivery.entities(tenantId, cfg).catch(() => null) : null;
    const base = { available: this.client.configured };
    if (!cfg || !e) return { ...base, configured: false, authorized: false, broken: null, pending: null, merchants: [], menu: null, stores: [] };
    const ifood = cfg.ifood;
    let merchants = ifood?.auth?.merchants ?? [];
    // Lista atualizada: o dono pode ter liberado mais lojas no portal
    if (ifood?.auth && !ifood.auth.broken) {
      const live = await this.client.merchants(this.auth(tenantId)).catch(() => null);
      if (live && JSON.stringify(live.map((m) => m.id).sort()) !== JSON.stringify(merchants.map((m) => m.id).sort())) {
        merchants = live.map((m) => ({ id: m.id, name: m.name }));
        await this.patchIfood(tenantId, { auth: { ...ifood.auth, merchants } });
      }
    }
    const rows = await this.prisma.entityData.findMany({
      where: { tenantId, entityId: e.stores.id, deletedAt: null }, select: { id: true, data: true }, orderBy: { createdAt: 'asc' }, take: 50,
    });
    const links = ifood?.merchants ?? {};
    const byStore = new Map(Object.entries(links).map(([merchantId, l]) => [l.storeId, { merchantId, ...l }]));
    const pending = ifood?.pending && ifood.pending.until > Date.now() ? ifood.pending : null;
    return {
      ...base,
      configured: true,
      authorized: !!ifood?.auth && !ifood.auth.broken,
      broken: ifood?.auth?.broken ?? null,
      authorizedAt: ifood?.auth?.at ?? null,
      authorizedBy: ifood?.auth?.by ?? null,
      pending: pending ? { userCode: pending.userCode, url: pending.url, until: new Date(pending.until).toISOString() } : null,
      merchants,
      menu: ifood?.menu ?? null,
      stores: rows.map((r) => {
        const link = byStore.get(r.id);
        return { id: r.id, name: String((r.data as Record<string, unknown>).nome ?? ''), merchantId: link?.merchantId ?? null, merchantName: link?.name ?? null };
      }),
    };
  }

  /** Passo 1: gera o codigo que o dono confirma no Portal do Parceiro do iFood. */
  async authorize(user: CurrentUser) {
    if (!this.client.configured) throw new BadRequestException('O conector do iFood ainda não está ligado neste servidor.');
    const tenantId = getEffectiveTenantId(user);
    if (!(await this.delivery.config(tenantId))) throw new BadRequestException('Monte a central de pedidos antes.');
    let code: IfoodUserCode;
    try {
      code = await this.client.userCode();
    } catch (err) {
      throw new BadRequestException(`Não deu para gerar o código no iFood agora: ${(err as Error).message}`);
    }
    await this.patchIfood(tenantId, {
      pending: { verifier: seal(code.authorizationCodeVerifier), userCode: code.userCode, url: code.verificationUrlComplete, until: Date.now() + (code.expiresIn ?? 600) * 1000 },
    });
    return this.status(user);
  }

  /** Passo 2: o dono colou o codigo de autorizacao que o portal mostrou. */
  async finishAuthorization(user: CurrentUser, authorizationCode: string) {
    const tenantId = getEffectiveTenantId(user);
    const pending = (await this.delivery.config(tenantId))?.ifood?.pending;
    if (!pending || pending.until < Date.now()) throw new BadRequestException('O código do iFood venceu. Gere outro e tente de novo.');
    let tokens: IfoodTokens;
    try {
      tokens = await this.client.exchange(authorizationCode.trim(), open(pending.verifier));
    } catch (err) {
      if (err instanceof IfoodError && err.status >= 400 && err.status < 500) {
        throw new BadRequestException('O iFood recusou o código de autorização. Confira se copiou o código inteiro, ou gere outro.');
      }
      throw new BadRequestException(`Não deu para falar com o iFood agora: ${(err as Error).message}`);
    }
    const merchants = await this.client.merchants({ token: async () => tokens.accessToken, reset: () => undefined });
    await this.patchIfood(tenantId, {
      pending: null,
      auth: {
        access: seal(tokens.accessToken), refresh: seal(tokens.refreshToken),
        accessUntil: Date.now() + Math.max((tokens.expiresIn ?? 3600) - 120, 60) * 1000,
        merchants: merchants.map((m) => ({ id: m.id, name: m.name })), at: new Date().toISOString(), by: user.name ?? null,
      },
    });
    this.tokens.delete(tenantId);
    this.forceRefresh.delete(tenantId);
    return this.status(user);
  }

  // ---- Ligar lojas -------------------------------------------------------

  /** Liga uma loja da central a uma loja do iFood que o dono autorizou. */
  async link(user: CurrentUser, storeId: string, merchantId: string) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    if (!cfg) throw new BadRequestException('Monte a central de pedidos antes.');
    const auth = cfg.ifood?.auth;
    if (!auth || auth.broken) throw new BadRequestException('Autorize o iFood antes de ligar as lojas.');
    const e = await this.delivery.entities(tenantId, cfg);
    const store = await this.prisma.entityData.findFirst({ where: { id: storeId, tenantId, entityId: e.stores.id, deletedAt: null } });
    if (!store) throw new NotFoundException('Loja não encontrada.');
    const storeName = String((store.data as Record<string, unknown>).nome ?? '');

    // So lojas que o dono liberou para esta empresa (lista do proprio iFood)
    let merchant = auth.merchants.find((m) => m.id === merchantId);
    if (!merchant) {
      const live = await this.client.merchants(this.auth(tenantId)).catch(() => []);
      merchant = live.find((m) => m.id === merchantId);
    }
    if (!merchant) throw new BadRequestException('Essa loja não está entre as que o dono autorizou no iFood.');

    // Uma loja do iFood fica em uma empresa so
    const others = await this.prisma.tenant.findMany({
      where: { id: { not: tenantId }, settings: { path: ['delivery', 'ifood', 'on'], equals: true } }, select: { settings: true },
    });
    if (others.some((t) => ((t.settings || {}) as { delivery?: DeliveryConfig }).delivery?.ifood?.merchants?.[merchant!.id])) {
      throw new ConflictException('Essa loja do iFood já está ligada a outra empresa.');
    }

    const merchants = { ...(cfg.ifood?.merchants ?? {}) };
    for (const [k, l] of Object.entries(merchants)) if (l.storeId === storeId || k === merchant.id) delete merchants[k];
    merchants[merchant.id] = { storeId, store: storeName, name: merchant.name };
    await this.patchIfood(tenantId, { on: true, merchants });
    await this.prisma.entityData.update({
      where: { id: store.id }, data: { data: { ...(store.data as Record<string, unknown>), ifood_id: merchant.id } as Prisma.InputJsonValue },
    });
    await this.ensureStoreOption(e, storeName);
    await this.ensureDeliveryCodeField(e);
    // Cardapio da loja ja entra ao ligar (se o iFood falhar, o botao e a hora cheia tentam de novo)
    await this.syncMenuFor(tenantId).catch((err) => this.logger.warn(`iFood cardapio tenant=${tenantId}: ${(err as Error).message}`));
    return this.status(user);
  }

  // ---- Cardapio ----------------------------------------------------------

  /** Botao "Atualizar cardapio do iFood". */
  async syncMenu(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    if (!cfg?.ifood?.auth || cfg.ifood.auth.broken) throw new BadRequestException('Autorize o iFood antes de importar o cardápio.');
    if (Object.keys(cfg.ifood.merchants ?? {}).length === 0) throw new BadRequestException('Ligue uma loja ao iFood antes de importar o cardápio.');
    const result = await this.syncMenuFor(tenantId);
    if (result && result.errors.length && result.errors.length === Object.keys(cfg.ifood.merchants).length) {
      throw new BadRequestException(`O iFood não entregou o cardápio: ${result.errors.join('; ')}`);
    }
    return this.status(user);
  }

  /** Item do cardapio de uma loja ligada ao iFood: a empresa, a tabela e o codigo da loja no iFood. */
  private async menuTarget(tenantId: string, entity: { slug: string }, data: Record<string, unknown>) {
    const cfg = await this.delivery.config(tenantId);
    if (!cfg?.ifood?.on || !cfg.ifood.auth || cfg.ifood.auth.broken || entity.slug !== cfg.tables.menu) return null;
    const storeId = storeOf(data);
    const merchantId = Object.entries(cfg.ifood.merchants ?? {}).find(([, l]) => l.storeId === storeId)?.[0];
    if (!merchantId) return null;
    return { cfg, merchantId, e: await this.delivery.entities(tenantId, cfg) };
  }

  /** Aviso no sino para quem mexeu no cardapio (o iFood respondeu depois de salvar). */
  private async menuNotice(user: { id?: string | null }, tenantId: string, type: 'error' | 'info', title: string, message: string) {
    if (!user.id) return;
    await this.notifications.notifyUser(user.id, { type, title, message }, tenantId).catch(() => {});
  }

  /** Item criado no sistema numa loja ligada: entra no cardapio do iFood. */
  private readonly onMenuCreated: RecordCreateListener = async ({ tenantId, entity, recordId, current, user }) => {
    const target = await this.menuTarget(tenantId, entity, current);
    if (!target || current.codigo_app) return;
    try {
      const back = await this.menu.pushCreate(this.auth(tenantId), target.merchantId, target.e, current);
      await this.dataService.updateFromSite(target.e.menu, recordId, back, ACTOR, { notify: false });
    } catch (err) {
      this.logger.warn(`iFood cardapio criar tenant=${tenantId}: ${(err as Error).message}`);
      await this.menuNotice(user, tenantId, 'error', 'O item não entrou no iFood',
        `${String(current.nome ?? '')}: ${(err as Error).message}. O item ficou só aqui; salve de novo para tentar outra vez.`);
    }
  };

  /** Item alterado no sistema: repassa ao iFood; se o iFood recusar, volta o que mudou. */
  private readonly onMenuChanged: RecordUpdateListener = async ({ tenantId, entity, recordId, previous, current, user }) => {
    const target = await this.menuTarget(tenantId, entity, current);
    if (!target) return;
    const keys = changed(previous, current, [...MENU_PUSH_FIELDS, 'loja']);
    if (keys.length === 0) return;
    const auth = this.auth(tenantId);
    try {
      // Item que ainda nao estava no iFood (criado sem loja, ou a criacao falhou): cria agora
      if (!current.codigo_app) {
        const back = await this.menu.pushCreate(auth, target.merchantId, target.e, current);
        await this.dataService.updateFromSite(target.e.menu, recordId, back, ACTOR, { notify: false });
        return;
      }
      if (keys.includes('loja')) throw new Error('para vender em outra loja, crie o item nela (cada loja tem o próprio cardápio no iFood)');
      const back = await this.menu.pushUpdate(auth, target.merchantId, target.e, previous, current);
      // Grava como o iFood deixou (ele ajusta maiusculas): a importacao nao ve diferenca depois
      const differs = changed(current, back, Object.keys(back));
      if (differs.length) await this.dataService.updateFromSite(target.e.menu, recordId, back, ACTOR, { notify: false });
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(`iFood cardapio alterar tenant=${tenantId} item=${String(current.codigo_app ?? '')}: ${message}`);
      const revert = Object.fromEntries(keys.map((k) => [k, previous[k] ?? null]));
      await this.dataService.updateFromSite(target.e.menu, recordId, revert, ACTOR, { notify: false }).catch(() => {});
      await this.menuNotice(user, tenantId, 'error', 'O iFood não aceitou a mudança no cardápio', `${String(current.nome ?? '')}: ${message}. A mudança foi desfeita.`);
    }
  };

  /** Item excluido no sistema: fica indisponivel no iFood (restaurar e marcar "a venda" volta). */
  private readonly onMenuDeleted: RecordDeleteListener = async ({ tenantId, entity, previous, user }) => {
    const target = await this.menuTarget(tenantId, entity, previous);
    if (!target || !previous.codigo_app) return;
    try {
      await this.menu.pushDelete(this.auth(tenantId), target.merchantId, previous);
    } catch (err) {
      this.logger.warn(`iFood cardapio excluir tenant=${tenantId}: ${(err as Error).message}`);
      await this.menuNotice(user, tenantId, 'error', 'O item continua à venda no iFood',
        `${String(previous.nome ?? '')}: ${(err as Error).message}. Tire de venda no Portal do Parceiro ou tente de novo.`);
    }
  };

  /** Importa o cardapio de todas as lojas ligadas da empresa e guarda o resumo. */
  private async syncMenuFor(tenantId: string) {
    const cfg = await this.delivery.config(tenantId);
    if (!cfg?.ifood?.auth || cfg.ifood.auth.broken) return null;
    const stores = Object.entries(cfg.ifood.merchants ?? {}).map(([merchantId, l]) => ({ merchantId, storeId: l.storeId, store: l.store }));
    if (stores.length === 0) return null;
    // Marca antes: um iFood fora do ar nao faz a hora cheia tentar a cada 30 s
    await this.patchIfood(tenantId, { menu: { ...(cfg.ifood.menu ?? { items: 0, created: 0, updated: 0, unavailable: 0, trashed: 0, errors: [] }), at: new Date().toISOString() } });
    const e = await this.delivery.entities(tenantId, cfg);
    const result = await this.menu.sync(tenantId, this.auth(tenantId), e, stores);
    await this.patchIfood(tenantId, { menu: result });
    return result;
  }

  /** Desconecta o iFood da empresa: desliga as lojas e apaga a autorizacao. */
  async disconnect(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    for (const l of Object.values(cfg?.ifood?.merchants ?? {})) await this.unlink(user, l.storeId);
    if (cfg?.ifood) await this.delivery.saveConfig(tenantId, { ifood: undefined });
    this.tokens.delete(tenantId);
    return this.status(user);
  }

  async unlink(user: CurrentUser, storeId: string) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.delivery.config(tenantId);
    if (!cfg?.ifood) return this.status(user);
    const merchants = Object.fromEntries(Object.entries(cfg.ifood.merchants ?? {}).filter(([, l]) => l.storeId !== storeId));
    await this.patchIfood(tenantId, { on: Object.keys(merchants).length > 0, merchants });
    // Tira o codigo da tabela Lojas tambem (senao a loja continua parecendo ligada)
    const e = await this.delivery.entities(tenantId, cfg).catch(() => null);
    if (!e) return this.status(user);
    const store = await this.prisma.entityData.findFirst({ where: { id: storeId, tenantId, entityId: e.stores.id, deletedAt: null } });
    if (store && (store.data as Record<string, unknown>).ifood_id) {
      const { ifood_id: _removed, ...rest } = store.data as Record<string, unknown>;
      await this.prisma.entityData.update({ where: { id: store.id }, data: { data: rest as Prisma.InputJsonValue } });
    }
    return this.status(user);
  }

  // ---- iFood -> central ---------------------------------------------------

  /** Empresas com lojas ligadas e autorizacao valida. */
  private async connectedTenants() {
    const tenants = await this.prisma.tenant.findMany({
      where: { settings: { path: ['delivery', 'ifood', 'on'], equals: true } }, select: { id: true, settings: true },
    });
    return tenants
      .map((t) => ({ tenantId: t.id, ifood: ((t.settings || {}) as { delivery?: DeliveryConfig }).delivery?.ifood }))
      .filter((t): t is { tenantId: string; ifood: IfoodLinks } => !!t.ifood?.auth && !t.ifood.auth.broken && Object.keys(t.ifood.merchants ?? {}).length > 0);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (const t of await this.connectedTenants()) {
        // Cada empresa com a autorizacao dela: um problema numa nao para as outras
        await this.pollTenant(t.tenantId, t.ifood).catch((err) => this.logger.warn(`iFood polling tenant=${t.tenantId}: ${(err as Error).message}`));
        const last = Date.parse(t.ifood.menu?.at ?? '') || 0;
        if (Date.now() - last >= MENU_MS) {
          await this.syncMenuFor(t.tenantId).catch((err) => this.logger.warn(`iFood cardapio tenant=${t.tenantId}: ${(err as Error).message}`));
        }
      }
    } catch (err) {
      this.logger.error(`iFood polling: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async pollTenant(tenantId: string, ifood: IfoodLinks) {
    const auth = this.auth(tenantId);
    const ids = Object.keys(ifood.merchants);
    for (let i = 0; i < ids.length; i += 50) {
      const events = await this.client.poll(auth, ids.slice(i, i + 50));
      const done: string[] = [];
      for (const ev of events) {
        const link = ev.merchantId ? ifood.merchants[ev.merchantId] : undefined;
        try {
          this.logger.log(`iFood evento ${ev.code} pedido=${ev.orderId} loja=${ev.merchantId ?? '-'}`);
          if (link) await this.handle(tenantId, auth, link.storeId, link.store, ev);
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
      await this.client.ack(auth, done);
    }
  }

  private findOrder(tenantId: string, e: DeliveryEntities, orderId: string) {
    return this.prisma.entityData.findFirst({
      where: { tenantId, entityId: e.orders.id, deletedAt: null, data: { path: ['codigo_app'], equals: orderId } },
      select: { id: true, data: true },
    });
  }

  private async handle(tenantId: string, auth: IfoodAuth, storeId: string, savedStore: string, ev: IfoodEvent) {
    const cfg = await this.delivery.config(tenantId);
    if (!cfg) return;
    const e = await this.delivery.entities(tenantId, cfg);
    const status = FROM_IFOOD[ev.code];
    const existing = await this.findOrder(tenantId, e, ev.orderId);

    if (!existing) {
      // Pedido que a central ainda nao tem (normalmente o PLC, mas pode chegar fora de ordem)
      if (!status || status === 'Cancelado') return;
      const order = await this.client.order(auth, ev.orderId);
      if (!order) throw new Error('pedido sem detalhes');
      // Nome de agora (a loja pode ter sido renomeada depois de ligar)
      const row = await this.prisma.entityData.findFirst({ where: { id: storeId, tenantId, entityId: e.stores.id, deletedAt: null }, select: { data: true } });
      const store = String((row?.data as Record<string, unknown> | undefined)?.nome ?? savedStore);
      await this.ensureStoreOption(e, store);
      await this.ensureDeliveryCodeField(e);
      await this.menu.ensureFields(e);
      await this.createOrder(tenantId, e, order, storeId, store, status);
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

  private async createOrder(tenantId: string, e: DeliveryEntities, order: IfoodOrder, storeId: string, store: string, status: Status) {
    const addr = order.delivery?.deliveryAddress;
    const takeout = (order.orderType ?? '').toUpperCase() === 'TAKEOUT';
    const address = takeout
      ? 'Retirada no balcão'
      : addr?.formattedAddress || [addr?.streetName, addr?.streetNumber, addr?.neighborhood].filter(Boolean).join(', ');
    const created = order.createdAt ?? new Date().toISOString();
    const due = order.delivery?.deliveryDateTime ?? order.takeout?.takeoutDateTime ?? new Date(new Date(created).getTime() + 45 * 60_000).toISOString();
    // Troco primeiro: o entregador precisa levar
    const change = (order.payments?.methods ?? []).find((m) => !m.prepaid && (m.cash?.changeFor ?? 0) > 0)?.cash?.changeFor;
    const notes = [
      change && `Troco para ${brl(change)}`,
      order.extraInfo,
      order.delivery?.observations,
      // Codigo do pedido para a coleta; o de entrega o cliente informa ao receber
      order.delivery?.pickupCode && `Código de coleta: ${order.delivery.pickupCode}`,
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
    // Item do pedido -> item do cardapio importado (o id do item no iFood e o mesmo)
    const menu = await this.menu.byCode(tenantId, e.menu, storeId, (order.items ?? []).map((it) => it.id ?? ''));
    for (const it of order.items ?? []) {
      const linked = it.id ? menu.get(it.id) : undefined;
      const options = (it.options ?? []).map((o) => `${o.quantity && o.quantity > 1 ? `${o.quantity}x ` : ''}${o.name}`).filter(Boolean).join(', ');
      const qty = it.quantity ?? 1;
      await this.dataService.createFromSite(e.items, {
        produto: it.name ?? 'Item',
        quantidade: qty,
        // Com os complementos (totalPrice ja soma as opcoes)
        preco: num(it.totalPrice !== undefined ? it.totalPrice / qty : it.unitPrice),
        observacao: [options, it.observations].filter(Boolean).join(' · '),
        ...(linked ? { item_cardapio: { value: linked.id, label: linked.nome } } : {}),
      }, ACTOR, record.id, { notify: false });
    }
  }

  /**
   * Loja cadastrada depois de montar a central nao esta na lista "Loja" dos pedidos:
   * entra na lista para o pedido nao chegar sem loja (e o filtro do atendente funcionar).
   */
  private async ensureStoreOption(e: DeliveryEntities, store: string) {
    e.orders = await this.delivery.ensureOption(e.orders, 'loja', store);
  }

  /**
   * Centrais montadas antes do codigo de entrega nao tem o campo: entra no fim do
   * formulario, so quando a situacao e Entregue.
   */
  private async ensureDeliveryCodeField(e: DeliveryEntities) {
    const fields = (e.orders.fields as unknown as Array<{ slug: string; gridRow?: number }>) || [];
    if (fields.some((f) => f.slug === 'codigo_entrega')) return;
    const row = Math.max(0, ...fields.map((f) => f.gridRow ?? 0)) + 1;
    const field = {
      name: 'codigo_entrega', slug: 'codigo_entrega', type: 'text', label: 'Código de entrega', helpText: DELIVERY_CODE_HELP,
      visibleIf: { field: 'situacao', operator: 'equals', value: this.delivery.optionValue(e.orders, 'situacao', 'Entregue') },
      gridRow: row, gridColStart: 1, gridColSpan: 6,
    };
    const updated = await this.prisma.entity.update({
      where: { id: e.orders.id }, data: { fields: [...fields, field] as unknown as Prisma.InputJsonValue },
    });
    invalidateEntityQueryCache(e.orders.slug);
    e.orders = updated;
  }

  private storeLabels(entity: Entity): string[] {
    const f = ((entity.fields as unknown as Array<{ slug: string; options?: Array<string | { label: string }> }>) || []).find((x) => x.slug === 'loja');
    return (f?.options || []).map((x) => (typeof x === 'string' ? x : x.label));
  }

  // ---- Central -> iFood ---------------------------------------------------

  /** Retirada e entrega feita pelo iFood: "pronto"; entrega propria: "saiu para entrega". */
  private leaveAction(order: IfoodOrder | null): 'readyToPickup' | 'dispatch' {
    if ((order?.orderType ?? '').toUpperCase() === 'TAKEOUT') return 'readyToPickup';
    return this.ownDelivery(order) ? 'dispatch' : 'readyToPickup';
  }

  private ownDelivery(order: IfoodOrder | null) {
    if ((order?.orderType ?? '').toUpperCase() === 'TAKEOUT') return false;
    return (order?.delivery?.deliveredBy ?? 'MERCHANT').toUpperCase() === 'MERCHANT';
  }

  /** Alguem mudou a situacao de um pedido do iFood no sistema: repassa ao iFood. */
  private readonly onOrderChanged: RecordUpdateListener = async ({ tenantId, entity, recordId, previous, current, user }) => {
    const cfg = await this.delivery.config(tenantId);
    if (!cfg?.ifood?.on || !cfg.ifood.auth || entity.slug !== cfg.tables.orders) return;
    const orderId = typeof current.codigo_app === 'string' ? current.codigo_app : '';
    // So pedido que veio do iFood (o codigo e um UUID); os de demonstracao tem codigo inventado
    if (!UUID.test(orderId) || this.label(entity as Entity, 'app', current.app) !== 'iFood') return;
    const from = this.label(entity as Entity, 'situacao', previous.situacao);
    const to = this.label(entity as Entity, 'situacao', current.situacao);
    const code = String(current.codigo_entrega ?? '').trim();
    const statusChanged = previous.situacao !== current.situacao;
    // Codigo preenchido depois de marcar Entregue tambem conclui no iFood
    const codeAdded = to === 'Entregue' && !!code && code !== String(previous.codigo_entrega ?? '').trim();
    if (!statusChanged && !codeAdded) return;
    const auth = this.auth(tenantId);
    const numero = String(current.numero ?? '');
    // Ate onde o iFood ja foi: se um passo falha, a situacao volta para ca (nao para o comeco)
    let reached = from;
    let checkingCode = false;

    try {
      if (to === 'Cancelado') {
        const reasons = await this.client.cancellationReasons(auth, orderId);
        const cancelCode = reasons[0]?.cancelCodeId ?? reasons[0]?.code;
        if (!cancelCode) throw new Error('o iFood não deixou cancelar este pedido agora');
        const reason = typeof current.motivo_cancelamento === 'string' && current.motivo_cancelamento ? current.motivo_cancelamento : reasons[0]?.description ?? 'Cancelado pela loja';
        await this.client.requestCancellation(auth, orderId, reason.slice(0, 250), cancelCode);
        return;
      }
      if (statusChanged && rank(to) <= rank(from)) return; // o iFood nao volta situacao
      if (rank(from) < rank('Aceito')) {
        await this.client.action(auth, orderId, 'confirm');
        reached = 'Aceito';
      }
      if (to === 'Em preparo') {
        await this.client.action(auth, orderId, 'startPreparation');
        reached = 'Em preparo';
      }
      let order: IfoodOrder | null = null;
      if (rank(to) >= rank('Saiu para entrega') && rank(from) < rank('Saiu para entrega')) {
        order = await this.client.order(auth, orderId);
        await this.client.action(auth, orderId, this.leaveAction(order));
        reached = 'Saiu para entrega';
      }
      if (to !== 'Entregue') return;
      order ??= await this.client.order(auth, orderId);
      // Retirada e entrega do iFood: o proprio iFood conclui
      if (!this.ownDelivery(order)) return;
      if (!code) {
        if (user.id) {
          await this.notifications.notifyUser(user.id, {
            type: 'info',
            title: 'Entregue aqui; no iFood falta o cliente confirmar',
            message: `Pedido ${numero}: o iFood conclui quando o cliente confirmar no app (ou sozinho, depois de algumas horas). Para concluir agora, abra o pedido e preencha o código de entrega que o cliente informa.`,
          }, tenantId).catch(() => {});
        }
        return;
      }
      checkingCode = true;
      await this.client.verifyDeliveryCode(auth, orderId, code);
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(`iFood ${from} -> ${to} pedido=${orderId}: ${message}`);
      const wrongCode = checkingCode && err instanceof IfoodError && err.status === 400;
      // Volta a situacao e avisa quem mudou: o pedido no iFood nao chegou la
      const e = await this.delivery.entities(tenantId, cfg);
      const patch: Record<string, unknown> = { situacao: reached === from ? previous.situacao : this.delivery.optionValue(e.orders, 'situacao', reached) };
      if (checkingCode) patch.codigo_entrega = '';
      await this.dataService.updateFromSite(e.orders, recordId, patch, ACTOR, { notify: false }).catch(() => {});
      if (user.id) {
        // Com a empresa: fica no sino tambem (quem arrastou o cartao pode nao estar olhando)
        await this.notifications.notifyUser(user.id, {
          type: 'error',
          title: wrongCode ? 'Código de entrega não confere' : 'O iFood não aceitou a mudança',
          message: wrongCode
            ? `Pedido ${numero}: o iFood recusou o código ${code}. Confira com o cliente e preencha de novo.`
            : `Pedido ${numero}: ${to}. ${message}`,
        }, tenantId).catch(() => {});
      }
    }
  };
}
