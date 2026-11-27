import { Injectable, Logger } from '@nestjs/common';
import type { Entity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DataService } from '../data/data.service';
import { MENU_APP_FIELDS, ORDER_ITEM_MENU_FIELD } from './delivery-starter';
import { DeliveryService, type DeliveryEntities } from './delivery.service';
import { IfoodClient, type IfoodAuth, type IfoodCategory, type IfoodOptionGroup, type IfoodSellableItem } from './ifood.client';

const ACTOR = 'iFood';
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
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
const image = (path?: string) => (!path ? '' : /^https?:\/\//.test(path) ? path : `${IMAGE_BASE}${path}`);
/** Igualdade de valores gravados (o banco reordena as chaves dos objetos JSON). */
const stable = (v: unknown): string => (v && typeof v === 'object' && !Array.isArray(v)
  ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  : JSON.stringify(v ?? ''));
const storeOf = (d: Record<string, unknown>) => {
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
          const id = it.contextModifiers?.find((m) => m.catalogContext === 'DEFAULT')?.itemContextId ?? it.contextModifiers?.[0]?.itemContextId ?? it.id;
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
    for (const s of stores) {
      try {
        const menu = await this.read(auth, s.merchantId);
        await this.apply(e, s, menu, rows.map((r) => ({ id: r.id, data: (r.data || {}) as Record<string, unknown> })).filter((r) => storeOf(r.data) === s.storeId), result);
      } catch (err) {
        this.logger.warn(`iFood cardapio tenant=${tenantId} loja=${s.merchantId}: ${(err as Error).message}`);
        result.errors.push(`${s.store}: ${(err as Error).message}`);
      }
    }
    return result;
  }

  private async apply(
    e: DeliveryEntities, s: { storeId: string; store: string }, menu: { items: MenuItem[]; keepCategories: Set<string> }, existing: Row[], result: MenuSyncResult,
  ) {
    const byCode = new Map(existing.filter((r) => r.data.codigo_app).map((r) => [String(r.data.codigo_app), r]));
    const seen = new Set<string>();
    for (const it of menu.items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
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
      if (!code || seen.has(code)) continue;
      // Pizza e parecidos: fora da lista agora nao quer dizer que saiu do cardapio
      if (menu.keepCategories.has(this.label(e.menu, 'categoria', row.data.categoria))) continue;
      await this.dataService.removeFromSite(e.menu, row.id, ACTOR, { notify: false });
      result.trashed++;
    }
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
