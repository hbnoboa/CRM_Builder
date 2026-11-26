import { Injectable, Logger } from '@nestjs/common';

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
  };
  takeout?: { takeoutDateTime?: string };
  items?: Array<{ name?: string; quantity?: number; unitPrice?: number; totalPrice?: number; observations?: string; options?: Array<{ name?: string; quantity?: number }> }>;
  total?: { subTotal?: number; deliveryFee?: number; orderAmount?: number };
  payments?: { prepaid?: number; pending?: number; methods?: Array<{ method?: string; type?: string; prepaid?: boolean }> };
  extraInfo?: string;
}

export class IfoodError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Chamadas a API de parceiros do iFood (aplicativo centralizado: uma credencial da
 * IOS System; cada restaurante autoriza o aplicativo no Portal do Parceiro dele).
 * Sem IFOOD_CLIENT_ID/IFOOD_CLIENT_SECRET o conector fica desligado.
 */
@Injectable()
export class IfoodClient {
  private readonly logger = new Logger(IfoodClient.name);
  private readonly base = (process.env.IFOOD_API_URL || 'https://merchant-api.ifood.com.br').replace(/\/$/, '');
  private token: { value: string; until: number } | null = null;

  get configured() {
    return !!(process.env.IFOOD_CLIENT_ID && process.env.IFOOD_CLIENT_SECRET);
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const body = new URLSearchParams({
      grantType: 'client_credentials',
      clientId: process.env.IFOOD_CLIENT_ID || '',
      clientSecret: process.env.IFOOD_CLIENT_SECRET || '',
    });
    const res = await fetch(`${this.base}/authentication/v1.0/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new IfoodError(`iFood recusou a credencial (HTTP ${res.status})`, res.status);
    const json = (await res.json()) as { accessToken: string; expiresIn?: number };
    // Renova 5 min antes de vencer
    this.token = { value: json.accessToken, until: Date.now() + Math.max((json.expiresIn ?? 3600) - 300, 60) * 1000 };
    return json.accessToken;
  }

  private async call<T>(method: 'GET' | 'POST', path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<T | null> {
    const send = async () => fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    let res = await send();
    if (res.status === 401) {
      this.token = null;
      res = await send();
    }
    if (res.status === 204) return null;
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 300);
      try {
        const j = JSON.parse(text) as { message?: string; error?: { message?: string } };
        detail = j.error?.message || j.message || detail;
      } catch { /* resposta sem JSON */ }
      throw new IfoodError(`iFood ${method} ${path.split('?')[0]}: HTTP ${res.status} ${detail}`.trim(), res.status);
    }
    return text ? (JSON.parse(text) as T) : null;
  }

  merchant(merchantId: string) {
    return this.call<{ id: string; name: string; status?: string; test?: string }>('GET', `/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}`);
  }

  merchantStatus(merchantId: string) {
    return this.call<Array<{ operation?: string; available?: boolean; state?: string; message?: { title?: string } }>>(
      'GET', `/merchant/v1.0/merchants/${encodeURIComponent(merchantId)}/status`,
    );
  }

  /** Fila de eventos das lojas (chamar a cada 30 s tambem mantem a loja conectada). */
  async poll(merchantIds: string[]): Promise<IfoodEvent[]> {
    if (merchantIds.length === 0) return [];
    return (await this.call<IfoodEvent[]>('GET', '/order/v1.0/events:polling', { headers: { 'x-polling-merchants': merchantIds.join(',') } })) ?? [];
  }

  async ack(eventIds: string[]) {
    if (eventIds.length === 0) return;
    await this.call('POST', '/order/v1.0/events/acknowledgment', { body: eventIds.map((id) => ({ id })) });
  }

  order(orderId: string) {
    return this.call<IfoodOrder>('GET', `/order/v1.0/orders/${encodeURIComponent(orderId)}`);
  }

  async action(orderId: string, action: 'confirm' | 'startPreparation' | 'readyToPickup' | 'dispatch') {
    await this.call('POST', `/order/v1.0/orders/${encodeURIComponent(orderId)}/${action}`);
  }

  async cancellationReasons(orderId: string) {
    return (await this.call<Array<{ cancelCodeId?: string; code?: string; description?: string }>>(
      'GET', `/order/v1.0/orders/${encodeURIComponent(orderId)}/cancellationReasons`,
    )) ?? [];
  }

  async requestCancellation(orderId: string, reason: string, cancellationCode: string) {
    await this.call('POST', `/order/v1.0/orders/${encodeURIComponent(orderId)}/requestCancellation`, { body: { reason, cancellationCode } });
  }
}
