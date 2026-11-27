import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Entity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DataService } from '../data/data.service';
import { MENU_APP_FIELDS, ORDER_ITEM_MENU_FIELD } from './delivery-starter';
import { DeliveryService, type DeliveryEntities } from './delivery.service';
import { IfoodClient, type IfoodAuth, type IfoodCategory, type IfoodCategoryItem, type IfoodOptionGroup, type IfoodSellableItem } from './ifood.client';

const ACTOR = 'iFood';
/**
 * A leitura do cardapio do iFood demora alguns segundos para mostrar o que acabou de ser
 * gravado: procura de novo antes de desistir, e a importacao deixa quieto por um tempo o
 * item que o sistema acabou de mandar (senao le o valor velho e desfaz a mudanca).
 */
const READ_TRIES = 8;
const READ_WAIT_MS = 4_000;
const PUSHED_TTL_MS = 5 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const IMAGE_BASE = 'https://static-images.ifood.com.br/image/upload/t_medium/pratos/';

/** Resultado da ultima importacao (fica nas configuracoes, o cartao do iFood mostra). */
export interface MenuSyncResult {
  at: string;
  items: number;
  created: number;
  updated: number;
  unavailable: number;
  trashed: number;
  errors: string[];
}

/** Item do iFood no formato da tabela Cardapio (sem a loja). */
interface MenuItem {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  ativo: boolean;
  descricao: string;
  complementos: string;
  foto: string;
  codigo_externo: string;
}

type Row = { id: string; data: Record<string, unknown> };

const money = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
const image = (path?: string) => (!path ? '' : /^https?:\/\//.test(path) ? path : `${IMAGE_BASE}${path}`);
/** Igualdade de valores gravados (o banco reordena as chaves dos objetos JSON). */
const stable = (v: unknown): string => (v && typeof v === 'object' && !Array.isArray(v)
  ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  : JSON.stringify(v ?? ''));
/** Campos do cardapio que vao para o iFood quando alguem muda no sistema. */
export const MENU_PUSH_FIELDS = ['nome', 'categoria', 'preco', 'ativo', 'descricao', 'codigo_externo'] as const;
export const changed = (a: Record<string, unknown>, b: Record<string, unknown>, keys: readonly string[]) => keys.filter((k) => stable(a[k]) !== stable(b[k]));
const contextId = (it: { id: string; contextModifiers?: Array<{ catalogContext?: string; itemContextId?: string }> }) =>
  it.contextModifiers?.find((m) => m.catalogContext === 'DEFAULT')?.itemContextId ?? it.contextModifiers?.[0]?.itemContextId ?? it.id;
export const storeOf = (d: Record<string, unknown>) => {
  const l = d.loja;
  return l && typeof l === 'object' ? String((l as { value?: unknown }).value ?? '') : String(l ?? '');
};

/** "Grupo (obrigatório, até 2): Opção (+R$ 1,00), ..." um grupo por linha. */
function groupsText(groups: Array<{ name?: string; min?: number; max?: number; options?: Array<{ name?: string; price?: number | null }> }>) {
  return groups
    .filter((g) => g.options?.length)
    .map((g) => {
      const rule = [(g.min ?? 0) > 0 ? 'obrigatório' : '', g.max ? `até ${g.max}` : ''].filter(Boolean).join(', ');
      const options = (g.options ?? []).map((o) => `${o.name ?? ''}${o.price ? ` (+${brl(o.price)})` : ''}`).join(', ');
      return `${g.name ?? 'Complementos'}${rule ? ` (${rule})` : ''}: ${options}`;
    })
    .join('\n');
}

const fromCategoryGroups = (groups: IfoodOptionGroup[] = []) => groupsText(groups.filter((g) => g.status !== 'UNAVAILABLE').map((g) => ({
  name: g.name, min: g.min, max: g.max,
  options: (g.options ?? []).filter((o) => o.status !== 'UNAVAILABLE').map((o) => ({ name: o.name, price: o.price?.value })),
})));

const fromSellableGroups = (s: IfoodSellableItem) => groupsText((s.itemOptionGroups ?? []).map((g) => ({
  name: g.name, min: g.minQuantity, max: g.maxQuantity, options: (g.options ?? []).map((o) => ({ name: o.name, price: o.price?.value })),
})));

/**
 * Cardapio do iFood -> tabela Cardapio da central (so leitura do iFood). Cada item fica
 * ligado a loja e guarda o codigo do item no iFood, o mesmo que vem nos pedidos.
 * Item indisponivel no iFood fica "a venda: nao"; item que saiu do cardapio vai para a
 * Lixeira (restaura por la).
 */
@Injectable()
export class IfoodMenuService {
  private readonly logger = new Logger(IfoodMenuService.name);
  /** Itens que o sistema mandou ao iFood ha pouco: empresa:codigo -> quando. */
  private readonly pushed = new Map<string, number>();

  private markPushed(tenantId: string, code: string) {
    const now = Date.now();
    for (const [k, at] of this.pushed) if (now - at > PUSHED_TTL_MS) this.pushed.delete(k);
    if (code) this.pushed.set(`${tenantId}:${code}`, now);
  }

  private recentlyPushed(tenantId: string, code: string) {
    return Date.now() - (this.pushed.get(`${tenantId}:${code}`) ?? 0) < PUSHED_TTL_MS;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: IfoodClient,
    private readonly delivery: DeliveryService,
    private readonly dataService: DataService,
  ) {}

  /** Campos do cardapio e do item do pedido que as centrais antigas nao tem. */
  async ensureFields(e: DeliveryEntities) {
    e.menu = await this.delivery.ensureFields(e.menu, MENU_APP_FIELDS, { lojas: e.stores });
    e.items = await this.delivery.ensureFields(e.items, [ORDER_ITEM_MENU_FIELD], { cardapio: e.menu });
  }

  /**
   * Os itens do cardapio no formato da central. Categoria comum: itens do cardapio, com a
   * situacao de cada um. Pizza e parecidos: os itens a venda (ja abertos por tamanho);
   * os que nao aparecem agora ficam como estao (podem so estar fora do horario).
   */
  async read(auth: IfoodAuth, merchantId: string): Promise<{ items: MenuItem[]; keepCategories: Set<string> }> {
    const catalogs = await this.client.catalogs(auth, merchantId);
    const catalog = catalogs.find((c) => c.context?.includes('DEFAULT')) ?? catalogs[0];
    if (!catalog) throw new Error('a loja não tem cardápio no iFood');
    const categories: IfoodCategory[] = await this.client.categories(auth, merchantId, catalog.catalogId);
    const special = categories.filter((c) => (c.template ?? 'DEFAULT') !== 'DEFAULT');
    const sellable = special.length && catalog.groupId ? await this.client.sellableItems(auth, merchantId, catalog.groupId) : [];

    const items: MenuItem[] = [];
    const keepCategories = new Set<string>();
    for (const cat of categories) {
      const name = (cat.name ?? '').trim() || 'Sem categoria';
      const catOn = cat.status !== 'UNAVAILABLE';
      if ((cat.template ?? 'DEFAULT') === 'DEFAULT') {
        for (const it of cat.items ?? []) {
          // O id que vem nos pedidos e o do item no contexto DEFAULT
          const id = contextId(it);
          items.push({
            id, nome: (it.name ?? '').trim() || 'Item', categoria: name, preco: money(it.price?.value),
            ativo: catOn && (it.status ?? 'AVAILABLE') === 'AVAILABLE',
            descricao: it.description ?? '', complementos: fromCategoryGroups(it.optionGroups), foto: image(it.imagePath), codigo_externo: it.externalCode ?? '',
          });
        }
        continue;
      }
      keepCategories.add(name);
      for (const s of sellable.filter((x) => x.categoryId === cat.id)) {
        items.push({
          id: s.itemId, nome: (s.itemName ?? '').trim() || 'Item', categoria: name,
          // Pizza: o preco vem das opcoes; "a partir de" e o minimo de venda
          preco: money(s.itemPrice?.value || s.itemMinSalePrice), ativo: catOn,
          descricao: s.itemDescription ?? '', complementos: fromSellableGroups(s), foto: image(s.logosUrls?.[0]), codigo_externo: s.itemExternalCode ?? '',
        });
      }
    }
    return { items, keepCategories };
  }

  /** Importa o cardapio de cada loja ligada (um erro numa loja nao para as outras). */
  async sync(tenantId: string, auth: IfoodAuth, e: DeliveryEntities, stores: Array<{ merchantId: string; storeId: string; store: string }>): Promise<MenuSyncResult> {
    const result: MenuSyncResult = { at: new Date().toISOString(), items: 0, created: 0, updated: 0, unavailable: 0, trashed: 0, errors: [] };
    await this.ensureFields(e);
    const rows = await this.prisma.entityData.findMany({ where: { tenantId, entityId: e.menu.id, deletedAt: null }, select: { id: true, data: true } });
    // Excluido aqui fica indisponivel no iFood: nao volta para o cardapio enquanto estiver assim
    const trashed = await this.prisma.entityData.findMany({ where: { tenantId, entityId: e.menu.id, deletedAt: { not: null } }, select: { data: true } });
    for (const s of stores) {
      try {
        const menu = await this.read(auth, s.merchantId);
        const gone = new Set(trashed.map((r) => (r.data || {}) as Record<string, unknown>).filter((d) => storeOf(d) === s.storeId).map((d) => String(d.codigo_app ?? '')));
        await this.apply(tenantId, e, s, menu, rows.map((r) => ({ id: r.id, data: (r.data || {}) as Record<string, unknown> })).filter((r) => storeOf(r.data) === s.storeId), gone, result);
      } catch (err) {
        this.logger.warn(`iFood cardapio tenant=${tenantId} loja=${s.merchantId}: ${(err as Error).message}`);
        result.errors.push(`${s.store}: ${(err as Error).message}`);
      }
    }
    return result;
  }

  private async apply(
    tenantId: string, e: DeliveryEntities, s: { storeId: string; store: string }, menu: { items: MenuItem[]; keepCategories: Set<string> }, existing: Row[], gone: Set<string>,
    result: MenuSyncResult,
  ) {
    const byCode = new Map(existing.filter((r) => r.data.codigo_app).map((r) => [String(r.data.codigo_app), r]));
    const seen = new Set<string>();
    for (const it of menu.items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      if (!byCode.has(it.id) && gone.has(it.id) && (!it.ativo || this.recentlyPushed(tenantId, it.id))) continue;
      e.menu = await this.delivery.ensureOption(e.menu, 'categoria', it.categoria);
      const data: Record<string, unknown> = {
        nome: it.nome,
        categoria: this.delivery.optionValue(e.menu, 'categoria', it.categoria),
        preco: it.preco,
        ativo: it.ativo,
        loja: { value: s.storeId, label: s.store },
        codigo_app: it.id,
        codigo_externo: it.codigo_externo,
        descricao: it.descricao,
        complementos: it.complementos,
        foto: it.foto,
      };
      result.items++;
      if (!it.ativo) result.unavailable++;
      const row = byCode.get(it.id);
      if (row && this.recentlyPushed(tenantId, it.id)) continue;
      if (!row) {
        await this.dataService.createFromSite(e.menu, data, ACTOR, undefined, { notify: false });
        result.created++;
        continue;
      }
      // So grava o que mudou (nao enche o historico a cada hora)
      const patch = Object.fromEntries(Object.entries(data).filter(([k, v]) => stable(row.data[k]) !== stable(v)));
      if (Object.keys(patch).length === 0) continue;
      await this.dataService.updateFromSite(e.menu, row.id, patch, ACTOR, { notify: false });
      result.updated++;
    }
    for (const row of existing) {
      const code = String(row.data.codigo_app ?? '');
      if (!code || seen.has(code) || this.recentlyPushed(tenantId, code)) continue;
      // Pizza e parecidos: fora da lista agora nao quer dizer que saiu do cardapio
      if (menu.keepCategories.has(this.label(e.menu, 'categoria', row.data.categoria))) continue;
      await this.dataService.removeFromSite(e.menu, row.id, ACTOR, { notify: false });
      result.trashed++;
    }
  }

  // ---- Sistema -> iFood ----------------------------------------------------

  /** Cardapio DEFAULT da loja e onde o item esta nele (pelo id dos pedidos ou pelo id do item). */
  private async locate(auth: IfoodAuth, merchantId: string, code: string) {
    const catalogs = await this.client.catalogs(auth, merchantId);
    const catalog = catalogs.find((c) => c.context?.includes('DEFAULT')) ?? catalogs[0];
    if (!catalog) throw new Error('a loja não tem cardápio no iFood');
    // Item gravado ha pouco pode ainda nao aparecer na leitura
    for (let attempt = 1; ; attempt++) {
      const categories = await this.client.categories(auth, merchantId, catalog.catalogId);
      let found: { category: IfoodCategory; item: IfoodCategoryItem } | null = null;
      for (const category of categories) {
        const item = (category.items ?? []).find((it) => it.id === code || contextId(it) === code);
        if (item) found = { category, item };
      }
      if (found || !code || attempt >= READ_TRIES) return { catalogId: catalog.catalogId, categories, found };
      await sleep(READ_WAIT_MS);
    }
  }

  /** Categoria do iFood com o nome da categoria do sistema (cria se nao existir). */
  private async categoryId(auth: IfoodAuth, merchantId: string, catalogId: string, categories: IfoodCategory[], name: string) {
    const wanted = name.trim().toLowerCase();
    const hit = categories.find((c) => (c.template ?? 'DEFAULT') === 'DEFAULT' && (c.name ?? '').trim().toLowerCase() === wanted);
    if (hit) return hit.id;
    const created = await this.client.createCategory(auth, merchantId, catalogId, name.trim(), categories.length);
    if (!created?.id) throw new Error(`o iFood não criou a categoria ${name}`);
    return created.id;
  }

  private itemFields(e: DeliveryEntities, d: Record<string, unknown>) {
    const preco = money(typeof d.preco === 'number' ? d.preco : Number(d.preco));
    return {
      nome: String(d.nome ?? '').trim(),
      descricao: String(d.descricao ?? ''),
      categoria: this.label(e.menu, 'categoria', d.categoria) || 'Outros',
      preco,
      status: (d.ativo === false ? 'UNAVAILABLE' : 'AVAILABLE') as 'AVAILABLE' | 'UNAVAILABLE',
      externalCode: String(d.codigo_externo ?? '').trim(),
    };
  }

  /** O que o iFood gravou (ele ajusta maiusculas do nome e da descricao) para guardar de volta. */
  private savedBack(saved: Awaited<ReturnType<IfoodClient['saveItem']>>, productId: string) {
    const product = saved?.products?.find((p) => p.id === productId);
    const code = saved?.item ? contextId(saved.item) : undefined;
    return {
      ...(code ? { codigo_app: code } : {}),
      ...(product?.name !== undefined ? { nome: product.name } : {}),
      ...(product?.description !== undefined ? { descricao: product.description } : {}),
    };
  }

  /** Item novo no sistema numa loja ligada: cria no iFood. Devolve o que guardar no registro. */
  async pushCreate(tenantId: string, auth: IfoodAuth, merchantId: string, e: DeliveryEntities, data: Record<string, unknown>) {
    const f = this.itemFields(e, data);
    if (!f.nome) throw new Error('o item precisa de nome');
    const { catalogId, categories } = await this.locate(auth, merchantId, '');
    const categoryId = await this.categoryId(auth, merchantId, catalogId, categories, f.categoria);
    const id = randomUUID();
    const productId = randomUUID();
    const saved = await this.client.saveItem(auth, merchantId, {
      item: {
        id, type: 'DEFAULT', categoryId, status: f.status, price: { value: f.preco }, productId, shifts: [], contextModifiers: [],
        ...(f.externalCode ? { externalCode: f.externalCode } : {}),
      },
      products: [{ id: productId, name: f.nome, description: f.descricao, optionGroups: [] }],
      optionGroups: [],
      options: [],
    });
    const back = { codigo_app: id, ...this.savedBack(saved, productId) };
    this.markPushed(tenantId, back.codigo_app);
    return back;
  }

  /**
   * Alteracao feita no sistema: preco e "a venda" vao pelas rotas proprias; nome,
   * descricao, categoria e codigo PDV regravam o item inteiro (mantendo os complementos).
   */
  async pushUpdate(tenantId: string, auth: IfoodAuth, merchantId: string, e: DeliveryEntities, previous: Record<string, unknown>, current: Record<string, unknown>) {
    const keys = changed(previous, current, MENU_PUSH_FIELDS);
    if (keys.length === 0) return {};
    const { catalogId, categories, found } = await this.locate(auth, merchantId, String(current.codigo_app ?? ''));
    const f = this.itemFields(e, current);
    // Pizza e parecidos: os tamanhos sao montados pelo iFood a partir de opcoes
    const special = (name: string) => categories.some((c) => (c.template ?? 'DEFAULT') !== 'DEFAULT' && (c.name ?? '').trim().toLowerCase() === name.trim().toLowerCase());
    if (found ? (found.category.template ?? 'DEFAULT') !== 'DEFAULT' : special(this.itemFields(e, previous).categoria)) {
      throw new Error('itens de pizza se mudam no Portal do Parceiro do iFood');
    }
    if (!found) throw new Error('o item não está mais no cardápio do iFood');
    const itemId = found.item.id;
    if (keys.every((k) => k === 'preco' || k === 'ativo')) {
      if (keys.includes('preco')) await this.client.itemPrice(auth, merchantId, itemId, f.preco);
      if (keys.includes('ativo')) await this.client.itemStatus(auth, merchantId, itemId, f.status);
      this.markPushed(tenantId, String(current.codigo_app ?? ''));
      return {};
    }
    // Item inteiro como esta no iFood (corpo do PUT), com as mudancas
    let full = await this.client.categoryItems(auth, merchantId, found.category.id);
    for (let attempt = 1; attempt < READ_TRIES && !(full.items ?? []).some((it) => it.id === itemId); attempt++) {
      await sleep(READ_WAIT_MS);
      full = await this.client.categoryItems(auth, merchantId, found.category.id);
    }
    const item = (full.items ?? []).find((it) => it.id === itemId);
    const product = (full.products ?? []).find((p) => p.id === item?.productId);
    if (!item || !product) throw new Error('o iFood não devolveu o item para editar');
    const groupIds = new Set((product.optionGroups ?? []).map((g) => g.id));
    const optionGroups = (full.optionGroups ?? []).filter((g) => groupIds.has(g.id));
    const optionIds = new Set(optionGroups.flatMap((g) => g.optionIds ?? []));
    const options = (full.options ?? []).filter((o) => optionIds.has(o.id));
    const optionProducts = new Set(options.map((o) => o.productId));
    const categoryId = keys.includes('categoria') ? await this.categoryId(auth, merchantId, catalogId, categories, f.categoria) : item.categoryId;
    const status = f.status;
    const price = { ...((item.price as object) ?? {}), value: f.preco };
    const saved = await this.client.saveItem(auth, merchantId, {
      item: {
        ...item, categoryId, status, price,
        ...(f.externalCode ? { externalCode: f.externalCode } : { externalCode: undefined }),
        contextModifiers: (item.contextModifiers ?? []).map((m) => (m.catalogContext === 'DEFAULT'
          ? { ...m, status, price: { ...(((m as { price?: object }).price) ?? {}), value: f.preco }, ...(f.externalCode ? { externalCode: f.externalCode } : { externalCode: undefined }) }
          : m)),
      },
      products: [{ ...product, name: f.nome, description: f.descricao }, ...(full.products ?? []).filter((p) => optionProducts.has(p.id))],
      optionGroups,
      options,
    });
    const back = this.savedBack(saved, product.id);
    delete (back as { codigo_app?: string }).codigo_app;
    this.markPushed(tenantId, String(current.codigo_app ?? ''));
    return back;
  }

  /** Excluido no sistema: fica indisponivel no iFood (o historico de vendas continua la). */
  async pushDelete(tenantId: string, auth: IfoodAuth, merchantId: string, previous: Record<string, unknown>) {
    const { found } = await this.locate(auth, merchantId, String(previous.codigo_app ?? ''));
    if (!found) return;
    // Sempre manda (a leitura pode estar velha e mostrar o item ja indisponivel)
    await this.client.itemStatus(auth, merchantId, found.item.id, 'UNAVAILABLE');
    this.markPushed(tenantId, String(previous.codigo_app ?? ''));
  }

  /** Itens do cardapio de uma loja pelo codigo do iFood (para ligar os itens dos pedidos). */
  async byCode(tenantId: string, menu: Entity, storeId: string, codes: string[]): Promise<Map<string, { id: string; nome: string }>> {
    const wanted = codes.filter(Boolean);
    if (wanted.length === 0) return new Map();
    const rows = await this.prisma.entityData.findMany({
      where: { tenantId, entityId: menu.id, deletedAt: null, OR: wanted.map((c) => ({ data: { path: ['codigo_app'], equals: c } })) },
      select: { id: true, data: true },
    });
    return new Map(rows
      .map((r) => ({ id: r.id, data: (r.data || {}) as Record<string, unknown> }))
      .filter((r) => storeOf(r.data) === storeId)
      .map((r) => [String(r.data.codigo_app), { id: r.id, nome: String(r.data.nome ?? '') }]));
  }

  private label(entity: Entity, field: string, value: unknown): string {
    const f = ((entity.fields as unknown as Array<{ slug: string; options?: Array<string | { value: string; label: string }> }>) || []).find((x) => x.slug === field);
    const o = (f?.options || []).map((x) => (typeof x === 'string' ? { value: x, label: x } : x)).find((x) => x.value === value || x.label === value);
    return o?.label ?? String(value ?? '');
  }
}
