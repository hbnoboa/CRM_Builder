import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';

/**
 * Ids da 99Food sao inteiros de 64 bits (o JSON.parse arredonda): viram texto ao ler e
 * voltam a numero ao mandar.
 */
const BIG_KEYS = ['order_id', 'app_id', 'shop_id', 'apply_id', 'uid', 'item_id'];
const quoteBig = (text: string) => text.replace(/("(?:[a-z_]+_id|uid)"\s*:\s*)(-?\d{16,})/g, '$1"$2"');
const unquoteBig = (json: string) => json.replace(new RegExp(`("(?:${BIG_KEYS.join('|')})"\\s*:\\s*)"(-?\\d+)"`, 'g'), '$1$2');

export const parse99 = <T>(text: string): T => JSON.parse(quoteBig(text)) as T;

/** Assinatura das chamadas da empresa: parametros em ordem "a=1&b=2" + segredo, MD5. */
export function sign99(params: Record<string, unknown>, secret: string) {
  const keys = Object.keys(params).filter((k) => k !== 'sign' && params[k] !== undefined && params[k] !== null && params[k] !== '').sort();
  return createHash('md5').update(keys.map((k) => `${k}=${String(params[k])}`).join('&') + secret).digest('hex');
}

/** O aviso veio mesmo da 99Food: MD5 do corpo cru + segredo, no cabecalho didi-header-sign. */
export function verify99(raw: Buffer | string, header: string | undefined, secret: string) {
  if (!header || !secret) return false;
  return createHash('md5').update(Buffer.concat([Buffer.from(raw), Buffer.from(secret)])).digest('hex') === header.trim().toLowerCase();
}

/** Aviso (webhook) da 99Food. */
export interface Food99Event {
  app_id?: string;
  app_shop_id?: string;
  type: string;
  timestamp?: number;
  data?: Record<string, unknown> | string;
}

/** Partes do pedido que a central usa (valores em centavos). */
export interface Food99Order {
  order_id: string;
  status?: number;
  order_index?: number;
  remark?: string;
  pay_type?: number;
  pay_method?: number;
  change_for?: number;
  /** 0 = retirada; 1 = entregador da 99; 2 = entrega da loja. */
  delivery_type?: number;
  /** 0 = entrega; 1 = retirada. */
  fulfillment_mode?: number;
  create_time?: number;
  expected_arrived_eta?: number;
  need_cutlery?: boolean;
  pickup_code?: string;
  handover_code?: string;
  takeaway_code?: string;
  price?: { order_price?: number; real_price?: number; real_pay_price?: number; delivery_price?: number; customer_need_paying_money?: number };
  shop?: { app_shop_id?: string; shop_name?: string };
  receive_address?: {
    name?: string; first_name?: string; last_name?: string; phone?: string; calling_code?: string;
    poi_address?: string; formatted_address?: string; street_name?: string; street_number?: string; district?: string;
    complement?: string; reference?: string; virtual_phone_number?: string; locator?: string;
  };
  order_items?: Array<{ app_item_id?: string; name?: string; amount?: number; sku_price?: number; remark?: string; sub_item_list?: Array<{ name?: string; amount?: number; sku_price?: number }> }>;
}

export interface Food99Shop {
  shop_id: string;
  shop_name?: string;
  app_shop_id?: string;
  bound_flag?: number;
}

export class Food99Error extends Error {
  constructor(message: string, readonly errno: number) {
    super(message);
  }
}

/** Token da loja que venceu ou sumiu: renovar e tentar de novo. */
export const TOKEN_ERRORS = new Set([10100, 10101, 10102]);

/**
 * Chamadas a API da 99Food (Open Platform). Um aplicativo da IOS System para todas as
 * empresas: cada loja autoriza pelo link de autorizacao e tem o proprio auth_token. Sem
 * FOOD99_APP_ID/FOOD99_APP_SECRET o conector fica desligado.
 */
@Injectable()
export class Food99Client {
  private readonly base = (process.env.FOOD99_API_URL || 'https://openapi.99food.com').replace(/\/$/, '');
  /** Pedir e renovar token: 1 chamada a cada 30 s para o aplicativo todo. */
  private tokenSlot = Promise.resolve();
  private lastTokenCall = 0;

  get configured() {
    return !!(process.env.FOOD99_APP_ID && process.env.FOOD99_APP_SECRET);
  }

  get appId() {
    return process.env.FOOD99_APP_ID || '';
  }

  get secret() {
    return process.env.FOOD99_APP_SECRET || '';
  }

  private async request<T>(method: 'GET' | 'POST', path: string, params: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.base}${path}`);
    let body: string | undefined;
    if (method === 'GET') for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    else body = unquoteBig(JSON.stringify(params));
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let json: { errno?: number; errmsg?: string; data?: T };
    try {
      json = parse99(text);
    } catch {
      throw new Food99Error(`99Food ${path}: HTTP ${res.status} ${text.slice(0, 200)}`.trim(), -res.status);
    }
    if (!res.ok || (json.errno ?? 0) !== 0) {
      throw new Food99Error(`99Food ${path}: ${json.errmsg || `HTTP ${res.status}`} (${json.errno ?? res.status})`, json.errno ?? -res.status);
    }
    return json.data as T;
  }

  /** Espera a vez (limite da 99 para os enderecos de token). */
  private async tokenTurn<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tokenSlot.then(async () => {
      const wait = this.lastTokenCall + 30_500 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastTokenCall = Date.now();
      return fn();
    });
    this.tokenSlot = run.then(() => undefined, () => undefined);
    return run;
  }

  getToken(appShopId: string) {
    return this.tokenTurn(() => this.request<{ auth_token: string; token_expiration_time?: number }>(
      'GET', '/v1/auth/authtoken/get', { app_id: this.appId, app_secret: this.secret, app_shop_id: appShopId },
    ));
  }

  refreshToken(appShopId: string) {
    return this.tokenTurn(() => this.request<boolean>('GET', '/v1/auth/authtoken/refresh', { app_id: this.appId, app_secret: this.secret, app_shop_id: appShopId }));
  }

  /** Link para o dono autorizar as lojas dele (vale 7 dias). */
  async authorizationUrl() {
    const data = await this.request<{ url: string }>('POST', '/v1/auth/authorizationpage/getUrl', { app_id: this.appId });
    return data.url;
  }

  /** Lojas que autorizaram o aplicativo (com o app_shop_id quando ja ligadas). */
  async authorizedShops(): Promise<Food99Shop[]> {
    const shops: Food99Shop[] = [];
    for (let page = 1; page <= 20; page++) {
      const params: Record<string, unknown> = { app_id: this.appId, timestamp: Math.floor(Date.now() / 1000), page_no: page, page_size: 15 };
      params.sign = sign99(params, this.secret);
      const data = await this.request<{ total_page?: number; shops?: Food99Shop[] }>('POST', '/v3/auth/authorization/getAuthorizedShops', params);
      shops.push(...(data.shops ?? []));
      if (!data.total_page || page >= data.total_page) break;
    }
    return shops;
  }

  orderDetail(token: string, orderId: string) {
    return this.request<Food99Order>('GET', '/v1/order/order/detail', { auth_token: token, order_id: orderId });
  }

  async action(token: string, orderId: string, action: 'confirm' | 'ready' | 'delivered') {
    await this.request('POST', `/v1/order/order/${action}`, { auth_token: token, order_id: orderId });
  }

  async cancel(token: string, orderId: string, reasonId: number, reason: string) {
    await this.request('POST', '/v1/order/order/cancel', { auth_token: token, order_id: orderId, reason_id: reasonId, reason });
  }
}
