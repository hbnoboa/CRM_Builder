import { Injectable } from '@nestjs/common';

/** Evento da fila do iFood (pedido novo, aceito, despachado, cancelado...). */
export interface IfoodEvent {
  id: string;
  code: string;
  fullCode?: string;
  orderId: string;
  merchantId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

/** Partes do pedido que a central usa (o iFood manda mais coisas). */
export interface IfoodOrder {
  id: string;
  displayId?: string;
  orderType?: string;
  createdAt?: string;
  merchant?: { id?: string; name?: string };
  customer?: { name?: string; phone?: { number?: string; localizer?: string } };
  delivery?: {
    deliveryAddress?: { formattedAddress?: string; streetName?: string; streetNumber?: string; complement?: string; neighborhood?: string; reference?: string };
    deliveryDateTime?: string; observations?: string; pickupCode?: string;
    /** MERCHANT = entrega propria da loja; IFOOD = entregador do iFood. */
    deliveredBy?: string;
  };
  takeout?: { takeoutDateTime?: string };
  /** id = item do cardapio no iFood (o mesmo `itemId` dos itens a venda). */
  items?: Array<{ id?: string; externalCode?: string; name?: string; quantity?: number; unitPrice?: number; totalPrice?: number; observations?: string; options?: Array<{ name?: string; quantity?: number }> }>;
  total?: { subTotal?: number; deliveryFee?: number; orderAmount?: number };
  payments?: { prepaid?: number; pending?: number; methods?: Array<{ method?: string; type?: string; prepaid?: boolean; cash?: { changeFor?: number } }> };
  extraInfo?: string;
  /** Pedido de teste: o iFood troca o nome dos itens por "PEDIDO DE TESTE - NÃO ENTREGAR". */
  isTest?: boolean;
}

/** Cardapio da loja no iFood (um por contexto: DEFAULT e o do app de delivery). */
export interface IfoodCatalog {
  catalogId: string;
  groupId?: string;
  context?: string[];
  status?: string;
}

export interface IfoodOptionGroup {
  name?: string;
  min?: number;
  max?: number;
  status?: string;
  options?: Array<{ name?: string; status?: string; price?: { value?: number } }>;
}

/** Item como o cardapio guarda (categorias com itens). */
export interface IfoodCategoryItem {
  id: string;
  name?: string;
  description?: string;
  externalCode?: string;
  status?: string;
  imagePath?: string;
  price?: { value?: number; originalValue?: number };
  optionGroups?: IfoodOptionGroup[];
  /** itemContextId do contexto DEFAULT = id do item nos pedidos e nos itens a venda. */
  contextModifiers?: Array<{ catalogContext?: string; itemContextId?: string }>;
}

export interface IfoodCategory {
  id: string;
  name?: string;
  status?: string;
  /** DEFAULT = itens comuns; PIZZA e outros montam os itens a venda a partir de opcoes. */
  template?: string;
  items?: IfoodCategoryItem[];
}

/** Item a venda como o cliente ve (pizza ja aberta por tamanho). */
export interface IfoodSellableItem {
  itemId: string;
  categoryId?: string;
  categoryName?: string;
  itemName?: string;
  itemDescription?: string;
  itemExternalCode?: string;
  logosUrls?: string[];
  itemPrice?: { value?: number | null; originalValue?: number | null };
  itemMinSalePrice?: number;
  itemOptionGroups?: Array<{ name?: string; minQuantity?: number; maxQuantity?: number; options?: Array<{ name?: string; price?: { value?: number | null } }> }>;
}

/** Codigo que o dono confirma no Portal do Parceiro (aplicativo distribuido). */
export interface IfoodUserCode {
  userCode: string;
  authorizationCodeVerifier: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresIn: number;
}

export interface IfoodTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Autorizacao de uma empresa: entrega o token valido (renovando quando vence). */
export interface IfoodAuth {
  token(): Promise<string>;
  /** O iFood recusou o token: na proxima chamada, renova. */
  reset(): void;
}

export class IfoodError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Chamadas a API de parceiros do iFood com o aplicativo distribuido do CRM Builder:
 * cada empresa autoriza com o login da loja dela (codigo do dono) e recebe um token
 * so das lojas que o dono liberou. Sem IFOOD_CLIENT_ID/IFOOD_CLIENT_SECRET o conector
 * fica desligado.
 */
@Injectable()
export class IfoodClient {
  private readonly base = (process.env.IFOOD_API_URL || 'https://merchant-api.ifood.com.br').replace(/\/$/, '');

  get configured() {
    return !!(process.env.IFOOD_CLIENT_ID && process.env.IFOOD_CLIENT_SECRET);
  }

  private async form<T>(path: string, fields: Record<string, string>): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) throw new IfoodError(`iFood ${path}: HTTP ${res.status} ${this.detail(text)}`.trim(), res.status);
    return JSON.parse(text) as T;
  }

  private detail(text: string) {
    try {
      const j = JSON.parse(text) as { message?: string; error?: { message?: string } };
      return j.error?.message || j.message || text.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  }

  /** Passo 1: codigo para o dono confirmar no Portal do Parceiro. */
  userCode() {
    return this.form<IfoodUserCode>('/authentication/v1.0/oauth/userCode', { clientId: process.env.IFOOD_CLIENT_ID || '' });
  }

  /** Passo 2: troca o codigo de autorizacao que o portal mostrou por tokens. */
  exchange(authorizationCode: string, verifier: string) {
    return this.form<IfoodTokens>('/authentication/v1.0/oauth/token', {
      grantType: 'authorization_code',
      clientId: process.env.IFOOD_CLIENT_ID || '',
      clientSecret: process.env.IFOOD_CLIENT_SECRET || '',
      authorizationCode,
      authorizationCodeVerifier: verifier,
    });
  }

  refresh(refreshToken: string) {
    return this.form<IfoodTokens>('/authentication/v1.0/oauth/token', {
      grantType: 'refresh_token',
      clientId: process.env.IFOOD_CLIENT_ID || '',
      clientSecret: process.env.IFOOD_CLIENT_SECRET || '',
      refreshToken,
    });
  }

  private async call<T>(auth: IfoodAuth, method: 'GET' | 'POST', path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<T | null> {
    const send = async () => fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await auth.token()}`,
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    let res = await send();
    if (res.status === 401) {
      auth.reset();
      res = await send();
    }
    if (res.status === 204) return null;
    const text = await res.text();
    if (!res.ok) throw new IfoodError(`iFood ${method} ${path.split('?')[0]}: HTTP ${res.status} ${this.detail(text)}`.trim(), res.status);
    // As acoes (confirm, dispatch...) respondem 202 sem JSON: nao e erro
    try {
      return text ? (JSON.parse(text) as T) : null;
    } catch {
      return null;
    }
  }

  /** Lojas que o dono liberou para o CRM Builder. */
  async merchants(auth: IfoodAuth) {
    return (await this.call<Array<{ id: string; name: string }>>(auth, 'GET', '/merchant/v1.0/merchants')) ?? [];
  }

  /** Fila de eventos das lojas (chamar a cada 30 s tambem mantem a loja conectada). */
  async poll(auth: IfoodAuth, merchantIds: string[]): Promise<IfoodEvent[]> {
    if (merchantIds.length === 0) return [];
    return (await this.call<IfoodEvent[]>(auth, 'GET', '/order/v1.0/events:polling', { headers: { 'x-polling-merchants': merchantIds.join(',') } })) ?? [];
  }

  async ack(auth: IfoodAuth, eventIds: string[]) {
    if (eventIds.length === 0) return;
    await this.call(auth, 'POST', '/order/v1.0/events/acknowledgment', { body: eventIds.map((id) => ({ id })) });
  }

  order(auth: IfoodAuth, orderId: string) {
    return this.call<IfoodOrder>(auth, 'GET', `/order/v1.0/orders/${encodeURIComponent(orderId)}`);
  }

  async action(auth: IfoodAuth, orderId: string, action: 'confirm' | 'startPreparation' | 'readyToPickup' | 'dispatch') {
    await this.call(auth, 'POST', `/order/v1.0/orders/${encodeURIComponent(orderId)}/${action}`);
  }

  /** Entrega propria: o codigo que o cliente informa conclui o pedido no iFood (errado = HTTP 400). */
  async verifyDeliveryCode(auth: IfoodAuth, orderId: string, code: string) {
    await this.call(auth, 'POST', `/order/v1.0/orders/${encodeURIComponent(orderId)}/verifyDeliveryCode`, { body: { code } });
  }

  // ---- Cardapio (so leitura) ----

  async catalogs(auth: IfoodAuth, merchantId: string) {
    return (await this.call<IfoodCatalog[]>(auth, 'GET', `/catalog/v2.0/merchants/${encodeURIComponent(merchantId)}/catalogs`)) ?? [];
  }

  async categories(auth: IfoodAuth, merchantId: string, catalogId: string) {
    return (await this.call<IfoodCategory[]>(
      auth, 'GET', `/catalog/v2.0/merchants/${encodeURIComponent(merchantId)}/catalogs/${encodeURIComponent(catalogId)}/categories?includeItems=true`,
    )) ?? [];
  }

  /** Itens a venda (pede o groupId do cardapio, nao o catalogId). */
  async sellableItems(auth: IfoodAuth, merchantId: string, groupId: string) {
    return (await this.call<IfoodSellableItem[]>(
      auth, 'GET', `/catalog/v2.0/merchants/${encodeURIComponent(merchantId)}/catalogs/${encodeURIComponent(groupId)}/sellableItems`,
    )) ?? [];
  }

  async cancellationReasons(auth: IfoodAuth, orderId: string) {
    return (await this.call<Array<{ cancelCodeId?: string; code?: string; description?: string }>>(
      auth, 'GET', `/order/v1.0/orders/${encodeURIComponent(orderId)}/cancellationReasons`,
    )) ?? [];
  }

  async requestCancellation(auth: IfoodAuth, orderId: string, reason: string, cancellationCode: string) {
    await this.call(auth, 'POST', `/order/v1.0/orders/${encodeURIComponent(orderId)}/requestCancellation`, { body: { reason, cancellationCode } });
  }
}
