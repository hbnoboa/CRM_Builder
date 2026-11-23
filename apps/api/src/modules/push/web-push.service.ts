import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush = require('web-push');
import { PrismaService } from '../../prisma/prisma.service';

/** Servicos de push dos navegadores (Chrome/Android, Firefox, Safari/iPhone, Edge). */
const PUSH_HOST_SUFFIXES = ['.googleapis.com', '.mozilla.com', '.mozaws.net', '.push.apple.com', '.notify.windows.com'];

/** So aceita endereco de servico de push conhecido (a API faz POST nele: nada de URL interna). */
export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOST_SUFFIXES.some((s) => `.${url.hostname}`.endsWith(s));
  } catch {
    return false;
  }
}

export interface WebPushPayload {
  title: string;
  body: string;
  /** Tela que abre ao tocar na notificacao (caminho do proprio sistema). */
  url: string;
  icon?: string;
  tag?: string;
}

type AppSettings = { app?: { enabled?: boolean } };

/**
 * Notificacao no navegador (Web Push) para o aplicativo instalavel (PWA). Chaves VAPID em
 * WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY (sem elas fica desligado). Cada aparelho e
 * inscrito numa empresa e so recebe os avisos dela, enquanto a empresa mantiver o
 * aplicativo ligado.
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private readonly publicKey: string;
  private enabled: boolean;
  // Empresa -> { slug, app ligado }, guardado por 1 minuto
  private readonly tenantCache = new Map<string, { slug: string; app: boolean; until: number }>();

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.publicKey = config.get<string>('WEB_PUSH_PUBLIC_KEY') || '';
    const privateKey = config.get<string>('WEB_PUSH_PRIVATE_KEY') || '';
    const subject = config.get<string>('WEB_PUSH_SUBJECT') || 'https://iossystem.com.br';
    this.enabled = !!(this.publicKey && privateKey);
    if (this.enabled) {
      try {
        webpush.setVapidDetails(subject, this.publicKey, privateKey);
      } catch (error) {
        this.enabled = false;
        this.logger.warn(`Chaves de Web Push invalidas: ${(error as Error).message}`);
      }
    } else {
      this.logger.warn('WEB_PUSH_PUBLIC_KEY/WEB_PUSH_PRIVATE_KEY ausentes - notificacao no navegador desligada');
    }
  }

  /** Chave publica para o navegador se inscrever; null quando desligado. */
  get vapidPublicKey(): string | null {
    return this.enabled ? this.publicKey : null;
  }

  /** `fresh`: le do banco (tela de configuracao); envio usa o valor guardado por 1 minuto. */
  private async tenantInfo(tenantId: string, fresh = false) {
    const hit = this.tenantCache.get(tenantId);
    if (!fresh && hit && hit.until > Date.now()) return hit;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, settings: true, status: true } });
    const info = {
      slug: tenant?.slug ?? '',
      app: !!tenant && tenant.status === 'ACTIVE' && ((tenant.settings ?? {}) as AppSettings).app?.enabled === true,
      until: Date.now() + 60_000,
    };
    this.tenantCache.set(tenantId, info);
    return info;
  }

  /** A empresa permite notificacao no navegador (aplicativo ligado e chaves configuradas)? */
  async availableFor(tenantId: string): Promise<boolean> {
    return this.enabled && (await this.tenantInfo(tenantId, true)).app;
  }

  async subscribe(userId: string, tenantId: string, sub: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) {
    // O mesmo aparelho passa a ser desta pessoa/empresa (troca de conta no mesmo navegador)
    await this.prisma.webPushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, tenantId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, userAgent: sub.userAgent?.slice(0, 300) },
      update: { userId, tenantId, p256dh: sub.p256dh, auth: sub.auth, userAgent: sub.userAgent?.slice(0, 300) },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.webPushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async isSubscribed(userId: string, tenantId: string, endpoint: string): Promise<boolean> {
    return (await this.prisma.webPushSubscription.count({ where: { userId, tenantId, endpoint } })) > 0;
  }

  /**
   * Envia aos aparelhos da pessoa inscritos nesta empresa. `path`: tela relativa a empresa
   * (ex.: "data?entity=veiculos"). Inscricao vencida (404/410) e apagada.
   */
  async sendToUser(userId: string, tenantId: string, message: { title: string; body: string; path?: string; tag?: string }) {
    if (!this.enabled) return;
    const tenant = await this.tenantInfo(tenantId);
    if (!tenant.app) return;
    const subs = await this.prisma.webPushSubscription.findMany({ where: { userId, tenantId } });
    if (subs.length === 0) return;

    const base = `/pt-BR/${tenant.slug}`;
    const payload: WebPushPayload = {
      title: message.title.slice(0, 120),
      body: message.body.slice(0, 400),
      url: `${base}/${message.path || 'home'}`,
      icon: `${base}/app-icon/192.png`,
      tag: message.tag,
    };
    const body = JSON.stringify(payload);
    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, { TTL: 86_400, urgency: 'normal' });
        await this.prisma.webPushSubscription.update({ where: { id: sub.id }, data: { lastSentAt: new Date() } }).catch(() => undefined);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.prisma.webPushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        } else {
          this.logger.warn(`Web Push falhou (${status ?? 'erro'}) para ${userId}: ${(error as Error).message}`);
        }
      }
    }));
  }
}
