import { BadRequestException, ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, type Entity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { EntityDataQueryService } from '../../common/services/entity-data-query.service';
import { DataService } from '../data/data.service';
import { DashboardTemplateService } from '../dashboard-template/dashboard-template.service';
import { AiWorkspaceService } from '../ai-builder/ai-workspace.service';
import { DEFAULT_STORES, MENU, deliveryStarterDraft, fakeCustomer } from './delivery-starter';

/** Onde o modelo ficou (slugs das tabelas criadas) e o modo demonstracao. */
export interface DeliveryConfig {
  tables: { stores: string; menu: string; orders: string; items: string };
  dashboardId?: string;
  /** Pedidos de demonstracao chegando sozinhos ate `until` (epoch ms), um a cada `every` min. */
  demo?: { until: number; every: number; last: number };
}

type Option = { value: string; label: string };
type RawField = { slug: string; type: string; options?: Array<string | Option> };

const DEMO_TICK_MS = 30_000;
const KEYS = { stores: 'lojas', menu: 'cardapio', orders: 'pedidos', items: 'itens-do-pedido' } as const;

/** Sorteio simples (Math.random basta: so dados de demonstracao). */
const rand = () => Math.random();
const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Central de pedidos de delivery (fase 1): monta o modelo pelo construtor, guarda a
 * configuracao na empresa e gera pedidos de demonstracao (como se viessem do iFood e
 * da 99Food) ate os conectores de verdade existirem.
 */
@Injectable()
export class DeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: AiWorkspaceService,
    private readonly dataService: DataService,
    private readonly dashboardService: DashboardTemplateService,
    private readonly queryService: EntityDataQueryService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.demoTick(), DEMO_TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async config(tenantId: string): Promise<DeliveryConfig | null> {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { settings: true } });
    const d = ((t?.settings || {}) as { delivery?: DeliveryConfig }).delivery;
    return d?.tables ? d : null;
  }

  private async saveConfig(tenantId: string, patch: Partial<DeliveryConfig> | null) {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { settings: true } });
    const settings = { ...((t?.settings || {}) as Record<string, unknown>) };
    const current = (settings.delivery || {}) as DeliveryConfig;
    settings.delivery = patch === null ? undefined : { ...current, ...patch };
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings: settings as Prisma.InputJsonValue } });
  }

  private async entities(tenantId: string, cfg: DeliveryConfig) {
    const rows = await this.prisma.entity.findMany({ where: { tenantId, slug: { in: Object.values(cfg.tables) } } });
    const by = (slug: string) => {
      const e = rows.find((r) => r.slug === slug);
      if (!e) throw new BadRequestException('A estrutura de delivery foi apagada ou renomeada. Monte de novo.');
      return e;
    };
    return { stores: by(cfg.tables.stores), menu: by(cfg.tables.menu), orders: by(cfg.tables.orders), items: by(cfg.tables.items) };
  }

  /** Valor gravado de uma opcao pelo nome (o construtor gera o valor a partir do nome). */
  private optionValue(entity: Entity, field: string, label: string): string {
    const f = ((entity.fields as unknown as RawField[]) || []).find((x) => x.slug === field);
    const o = (f?.options || []).map((x) => (typeof x === 'string' ? { value: x, label: x } : x)).find((x) => x.label === label);
    return o?.value ?? label;
  }

  private optionLabels(entity: Entity, field: string): string[] {
    const f = ((entity.fields as unknown as RawField[]) || []).find((x) => x.slug === field);
    return (f?.options || []).map((x) => (typeof x === 'string' ? x : x.label));
  }

  async status(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.config(tenantId);
    if (!cfg) return { configured: false, defaultStores: DEFAULT_STORES };
    const e = await this.entities(tenantId, cfg).catch(() => null);
    if (!e) return { configured: false, broken: true, defaultStores: DEFAULT_STORES };
    // Lojas pelo cargo de quem pede (pipeline central de leitura)
    const { where } = await this.queryService.buildWhere({ entitySlug: e.stores.slug, user });
    const stores = await this.prisma.entityData.findMany({ where, select: { id: true, data: true }, orderBy: { createdAt: 'asc' }, take: 50 });
    const demo = cfg.demo && cfg.demo.until > Date.now() ? cfg.demo : null;
    return {
      configured: true,
      tables: cfg.tables,
      dashboardId: cfg.dashboardId ?? null,
      stores: stores.map((s) => {
        const d = (s.data || {}) as Record<string, unknown>;
        return { id: s.id, name: String(d.nome ?? ''), active: d.ativa !== false, ifoodId: String(d.ifood_id ?? ''), food99Id: String(d.food99_id ?? '') };
      }),
      // Conectores de verdade: fases 2 (iFood) e 3 (99Food)
      connectors: { ifood: 'waiting-access', food99: 'waiting-access' },
      demo: demo ? { until: new Date(demo.until).toISOString(), every: demo.every } : null,
    };
  }

  /**
   * Monta o modelo: tabelas, painel com som, cargos e automacao pelo construtor (fica no
   * historico), depois lojas, cardapio e, se pedido, pedidos de exemplo das ultimas semanas.
   */
  async setup(user: CurrentUser, stores: string[] | undefined, history: boolean) {
    const tenantId = getEffectiveTenantId(user);
    if (await this.config(tenantId)) throw new ConflictException('A central de pedidos já está montada.');
    const names = [...new Set((stores?.length ? stores : DEFAULT_STORES).map((s) => s.trim()).filter(Boolean))].slice(0, 20);
    if (names.length === 0) throw new BadRequestException('Informe pelo menos uma loja.');

    const result = await this.workspace.apply({
      proposal: deliveryStarterDraft(names) as unknown as Record<string, unknown>,
      conversation: ['Montar a central de pedidos de delivery (Integrações → Apps de delivery)'],
    }, user);
    if (result.failed) throw new BadRequestException(`Não deu para montar: ${result.failed.name}: ${result.failed.message}`);

    const tableIds = new Map(result.applied.filter((a) => a.module === 'table' && a.kind === 'create').map((a) => [a.key, a.id]));
    const rows = await this.prisma.entity.findMany({ where: { tenantId, id: { in: [...tableIds.values()] } }, select: { id: true, slug: true } });
    const slugOf = (key: string) => rows.find((r) => r.id === tableIds.get(key))?.slug;
    const tables = { stores: slugOf(KEYS.stores), menu: slugOf(KEYS.menu), orders: slugOf(KEYS.orders), items: slugOf(KEYS.items) };
    if (!tables.stores || !tables.menu || !tables.orders || !tables.items) throw new BadRequestException('As tabelas de delivery não foram criadas.');
    const dashboardId = result.applied.find((a) => a.module === 'dashboard' && a.kind === 'create')?.id;
    if (dashboardId) await this.dashboardService.update(dashboardId, { settings: { newRecordAlert: true } }, user);
    const cfg: DeliveryConfig = { tables: tables as DeliveryConfig['tables'], dashboardId };
    await this.saveConfig(tenantId, cfg);

    // Lojas e cardapio (dados iniciais, gravados direto como numa importacao)
    const e = await this.entities(tenantId, cfg);
    const seed = (entity: Entity, data: Record<string, unknown>) =>
      this.prisma.entityData.create({ data: { tenantId, entityId: entity.id, data: data as Prisma.InputJsonValue, createdById: user.id, updatedById: user.id } });
    for (const [i, name] of names.entries()) {
      await seed(e.stores, { nome: name, ativa: true, telefone: `(11) 3${String(100 + i).padStart(3, '0')}-${String(1000 + i * 37).slice(-4)}`, endereco: `Endereço da ${name}` });
    }
    for (const m of MENU) await seed(e.menu, { nome: m.nome, categoria: this.optionValue(e.menu, 'categoria', m.categoria), preco: m.preco, ativo: true });
    if (history) await this.backfill(tenantId, e, user.id);
    return this.status(user);
  }

  /** Pedido de mentira montado com as lojas e o cardapio da empresa. */
  private async fakeOrder(tenantId: string, e: Awaited<ReturnType<DeliveryService['entities']>>, when: Date, status: string) {
    const storeRows = await this.prisma.entityData.findMany({ where: { tenantId, entityId: e.stores.id, deletedAt: null }, select: { data: true } });
    const menuRows = await this.prisma.entityData.findMany({ where: { tenantId, entityId: e.menu.id, deletedAt: null }, select: { data: true } });
    const storeNames = storeRows.map((r) => (r.data as Record<string, unknown>)).filter((d) => d.ativa !== false).map((d) => String(d.nome));
    const labels = this.optionLabels(e.orders, 'loja');
    const store = pick(storeNames.filter((s) => labels.includes(s)).length ? storeNames.filter((s) => labels.includes(s)) : labels);
    const menu = menuRows.map((r) => r.data as { nome: string; preco: number; categoria?: string; ativo?: boolean }).filter((m) => m.ativo !== false);
    if (!store || menu.length === 0) throw new BadRequestException('Cadastre lojas e o cardápio antes de simular pedidos.');
    const roll = rand();
    const app = roll < 0.55 ? 'iFood' : roll < 0.9 ? '99Food' : 'Balcão';
    const mains = menu.filter((m) => m.categoria === this.optionValue(e.menu, 'categoria', 'Marmita'));
    const others = menu.filter((m) => !mains.includes(m));
    const items: Array<{ produto: string; quantidade: number; preco: number }> = [];
    for (let i = 0, n = 1 + Math.floor(rand() * 2); i < n; i++) items.push({ produto: pick(mains.length ? mains : menu).nome, quantidade: 1 + Math.floor(rand() * 2), preco: 0 });
    if (others.length && rand() < 0.6) items.push({ produto: pick(others).nome, quantidade: 1, preco: 0 });
    for (const it of items) it.preco = menu.find((m) => m.nome === it.produto)?.preco ?? 0;
    const fee = app === 'Balcão' ? 0 : money(4.99 + Math.floor(rand() * 5));
    const total = money(items.reduce((s, it) => s + it.preco * it.quantidade, 0) + fee);
    const payment = app === 'Balcão' ? pick(['Dinheiro na entrega', 'Cartão na entrega']) : rand() < 0.8 ? 'Pago no app' : pick(['Dinheiro na entrega', 'Cartão na entrega']);
    const prefix = app === 'iFood' ? 'IF' : app === '99Food' ? '99' : 'BL';
    const minutes = (m: number) => new Date(when.getTime() + m * 60_000).toISOString();
    const customer = fakeCustomer(rand);
    const data: Record<string, unknown> = {
      numero: `${prefix}-${Math.floor(10000 + rand() * 89999)}`,
      app: this.optionValue(e.orders, 'app', app),
      loja: this.optionValue(e.orders, 'loja', store),
      situacao: this.optionValue(e.orders, 'situacao', status),
      ...customer,
      ...(app === 'Balcão' ? { endereco: 'Retirada no balcão' } : {}),
      pagamento: this.optionValue(e.orders, 'pagamento', payment),
      recebido_em: when.toISOString(),
      entregar_ate: minutes(45),
      ...(status === 'Entregue' ? { entregue_em: minutes(25 + Math.floor(rand() * 30)) } : {}),
      ...(status === 'Cancelado' ? { motivo_cancelamento: pick(['Cliente desistiu', 'Endereço fora da área', 'Item em falta']) } : {}),
      total,
      taxa_entrega: fee,
      ...(app !== 'Balcão' ? { codigo_app: `${app === 'iFood' ? 'ifd' : '99f'}-${Math.floor(rand() * 1e9).toString(36)}` } : {}),
    };
    return { data, items, app };
  }

  /** Pedidos de exemplo das ultimas 3 semanas (para os graficos) e alguns em andamento agora. */
  private async backfill(tenantId: string, e: Awaited<ReturnType<DeliveryService['entities']>>, userId: string) {
    const now = Date.now();
    const create = async (when: Date, status: string) => {
      const o = await this.fakeOrder(tenantId, e, when, status);
      const order = await this.prisma.entityData.create({
        data: { tenantId, entityId: e.orders.id, data: o.data as Prisma.InputJsonValue, createdAt: when, updatedAt: when, createdById: userId },
      });
      for (const it of o.items) {
        await this.prisma.entityData.create({
          data: { tenantId, entityId: e.items.id, parentRecordId: order.id, data: it as Prisma.InputJsonValue, createdAt: when, updatedAt: when, createdById: userId },
        });
      }
    };
    for (let day = 21; day >= 1; day--) {
      const perDay = 4 + Math.floor(rand() * 6);
      for (let i = 0; i < perDay; i++) {
        const when = new Date(now - day * 86_400_000);
        when.setHours(11 + Math.floor(rand() * 3), Math.floor(rand() * 60), 0, 0);
        await create(when, rand() < 0.92 ? 'Entregue' : 'Cancelado');
      }
    }
    for (const status of ['Aceito', 'Em preparo', 'Em preparo', 'Saiu para entrega', 'Entregue', 'Entregue']) {
      await create(new Date(now - (5 + Math.floor(rand() * 50)) * 60_000), status);
    }
  }

  /**
   * Pedido(s) novo(s) chegando agora, como se viessem dos apps: passam pelo mesmo caminho
   * de um pedido de fora (aviso em tempo real, som no painel, automacoes).
   */
  async simulateForTenant(tenantId: string, count: number): Promise<number> {
    const cfg = await this.config(tenantId);
    if (!cfg) throw new BadRequestException('Monte a central de pedidos antes.');
    const e = await this.entities(tenantId, cfg);
    let made = 0;
    for (let i = 0; i < Math.min(Math.max(count, 1), 10); i++) {
      const o = await this.fakeOrder(tenantId, e, new Date(), 'Novo');
      const actor = o.app === 'Balcão' ? 'Balcão (demonstração)' : `${o.app} (demonstração)`;
      const order = await this.dataService.createFromSite(e.orders, o.data, actor);
      for (const it of o.items) await this.dataService.createFromSite(e.items, it, actor, order.id);
      made++;
    }
    return made;
  }

  async simulate(user: CurrentUser, count: number) {
    return { created: await this.simulateForTenant(getEffectiveTenantId(user), count) };
  }

  async startDemo(user: CurrentUser, minutes: number, every: number) {
    const tenantId = getEffectiveTenantId(user);
    if (!(await this.config(tenantId))) throw new BadRequestException('Monte a central de pedidos antes.');
    const m = Math.min(Math.max(Math.round(minutes), 5), 240);
    const ev = Math.min(Math.max(Math.round(every), 1), 30);
    await this.saveConfig(tenantId, { demo: { until: Date.now() + m * 60_000, every: ev, last: 0 } });
    await this.simulateForTenant(tenantId, 1);
    await this.saveConfig(tenantId, { demo: { until: Date.now() + m * 60_000, every: ev, last: Date.now() } });
    return this.status(user);
  }

  async stopDemo(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const cfg = await this.config(tenantId);
    if (cfg?.demo) await this.saveConfig(tenantId, { demo: undefined });
    return this.status(user);
  }

  /** A cada 30 s: empresas em modo demonstracao recebem um pedido quando chega a hora. */
  private async demoTick() {
    try {
      const now = Date.now();
      const tenants = await this.prisma.tenant.findMany({
        where: { settings: { path: ['delivery', 'demo', 'until'], gt: now } },
        select: { id: true, settings: true },
      });
      for (const t of tenants) {
        const demo = ((t.settings || {}) as { delivery?: DeliveryConfig }).delivery?.demo;
        if (!demo || now - demo.last < demo.every * 60_000) continue;
        // Marca antes de criar: outra instancia da API nao repete o pedido
        const claimed = await this.prisma.$executeRaw`
          UPDATE "Tenant" SET settings = jsonb_set(settings::jsonb, '{delivery,demo,last}', to_jsonb(${now}::bigint))
          WHERE id = ${t.id} AND COALESCE((settings::jsonb #>> '{delivery,demo,last}')::bigint, 0) = ${demo.last}::bigint`;
        if (!claimed) continue;
        await this.simulateForTenant(t.id, rand() < 0.25 ? 2 : 1).catch((err) => this.logger.warn(`demo delivery tenant=${t.id}: ${(err as Error).message}`));
      }
    } catch (err) {
      this.logger.error(`demo delivery: ${(err as Error).message}`);
    }
  }
}
