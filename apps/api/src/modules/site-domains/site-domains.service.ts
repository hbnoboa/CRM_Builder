import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/types';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { AuditService } from '../audit/audit.service';
import { PlatformAuditService } from '../platform/platform-audit.service';
import type { PlatformStaffPrincipal } from '../platform/platform-permissions';
import { checkDns, dnsTarget } from './dns-check';
import { SEARCH_TLDS, domainLabel, isApex, isPlatformHost, normalizeHostname, tldOf, validDocument } from './domain-utils';
import { createRegistrar, type DomainRegistrar, type Registrant } from './registrar';

const MAX_DOMAINS = 5;

/**
 * Dominios proprios das empresas: ligar um dominio que o cliente ja tem (ele aponta o
 * DNS e o sistema confere) e comprar um dominio novo (pedido; a equipe da plataforma
 * cobra por fora, marca como pago e o registro e feito pelo registrador).
 */
@Injectable()
export class SiteDomainsService {
  private readonly logger = new Logger(SiteDomainsService.name);
  private readonly registrar: DomainRegistrar | null = createRegistrar();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  // ── Empresa ────────────────────────────────────────────────────────────

  async overview(user: CurrentUser) {
    const tenantId = getEffectiveTenantId(user);
    const [domains, orders] = await Promise.all([
      this.prisma.tenantDomain.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.domainOrder.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    const target = dnsTarget();
    return {
      domains: domains.map((d) => ({ ...d, apex: isApex(d.hostname) })),
      orders,
      dns: { cname: target.cname, ips: target.ips },
      purchase: this.registrar
        ? { enabled: true, testMode: this.registrar.testMode, tlds: SEARCH_TLDS }
        : { enabled: false, testMode: false, tlds: [] },
    };
  }

  /** Liga um dominio que o cliente ja tem. Fica pendente ate o DNS apontar para nos. */
  async connect(user: CurrentUser, raw: string) {
    const tenantId = getEffectiveTenantId(user);
    const hostname = normalizeHostname(raw);
    if (!hostname) throw new BadRequestException('Digite um endereço válido, por exemplo www.suaempresa.com.br.');
    if (isPlatformHost(hostname)) throw new BadRequestException('Esse endereço é da própria plataforma. Use um domínio da sua empresa.');
    if ((await this.prisma.tenantDomain.count({ where: { tenantId } })) >= MAX_DOMAINS) {
      throw new BadRequestException(`Cada empresa pode ligar até ${MAX_DOMAINS} domínios.`);
    }
    const existing = await this.prisma.tenantDomain.findUnique({ where: { hostname } });
    if (existing) {
      throw new ConflictException(existing.tenantId === tenantId ? 'Esse domínio já está ligado à sua empresa.' : 'Esse domínio já está ligado a outra empresa. Se ele é seu, fale com o suporte.');
    }
    const domain = await this.prisma.tenantDomain.create({ data: { tenantId, hostname, kind: 'connected', createdById: user.id } });
    await this.audit.log(user, { action: 'create', resource: 'site_domain', resourceId: domain.id, newData: { hostname } }).catch(() => undefined);
    return this.verifyRecord(domain.id, tenantId);
  }

  async verify(user: CurrentUser, id: string) {
    const tenantId = getEffectiveTenantId(user);
    return this.verifyRecord(id, tenantId);
  }

  private async verifyRecord(id: string, tenantId: string) {
    const domain = await this.prisma.tenantDomain.findFirst({ where: { id, tenantId } });
    if (!domain) throw new NotFoundException('Domínio não encontrado');
    const result = await checkDns(domain.hostname);
    const hasPrimary = await this.prisma.tenantDomain.count({ where: { tenantId, isPrimary: true, id: { not: id } } });
    const updated = await this.prisma.tenantDomain.update({
      where: { id },
      data: result.ok
        ? { status: 'active', verifiedAt: domain.verifiedAt ?? new Date(), lastCheckAt: new Date(), lastError: null, ...(hasPrimary ? {} : { isPrimary: true }) }
        // Ja ativo e o DNS saiu do ar: avisa, mas so desliga se nunca foi verificado
        : { status: domain.status === 'active' ? 'error' : 'pending_dns', lastCheckAt: new Date(), lastError: result.error ?? null },
    });
    return { ...updated, apex: isApex(updated.hostname), found: result.found };
  }

  /** Dominio principal: o usado nos links do site. So um ativo pode ser principal. */
  async setPrimary(user: CurrentUser, id: string) {
    const tenantId = getEffectiveTenantId(user);
    const domain = await this.prisma.tenantDomain.findFirst({ where: { id, tenantId } });
    if (!domain) throw new NotFoundException('Domínio não encontrado');
    if (domain.status !== 'active') throw new BadRequestException('O domínio precisa estar conectado antes de virar o principal.');
    await this.prisma.$transaction([
      this.prisma.tenantDomain.updateMany({ where: { tenantId }, data: { isPrimary: false } }),
      this.prisma.tenantDomain.update({ where: { id }, data: { isPrimary: true } }),
    ]);
    return this.overview(user);
  }

  async remove(user: CurrentUser, id: string) {
    const tenantId = getEffectiveTenantId(user);
    const domain = await this.prisma.tenantDomain.findFirst({ where: { id, tenantId } });
    if (!domain) throw new NotFoundException('Domínio não encontrado');
    await this.prisma.tenantDomain.delete({ where: { id } });
    // O proximo ativo vira o principal
    if (domain.isPrimary) {
      const next = await this.prisma.tenantDomain.findFirst({ where: { tenantId, status: 'active' }, orderBy: { createdAt: 'asc' } });
      if (next) await this.prisma.tenantDomain.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await this.audit.log(user, { action: 'delete', resource: 'site_domain', resourceId: id, oldData: { hostname: domain.hostname } }).catch(() => undefined);
    return { ok: true };
  }

  // ── Compra de dominio ──────────────────────────────────────────────────

  private requireRegistrar(): DomainRegistrar {
    if (!this.registrar) throw new BadRequestException('A compra de domínios ainda não está disponível. Você pode ligar um domínio que já tem.');
    return this.registrar;
  }

  /** "meu cafe" -> meucafe.com.br, meucafe.com... (ou o endereco exato digitado). */
  async search(user: CurrentUser, raw: string) {
    getEffectiveTenantId(user);
    const registrar = this.requireRegistrar();
    const exact = normalizeHostname(raw);
    const label = domainLabel(raw);
    if (!label || label.length < 2) throw new BadRequestException('Digite o nome que você quer, por exemplo meucafe.');
    const names = [...new Set([
      ...(exact && SEARCH_TLDS.includes(tldOf(exact)) && exact.split('.').length <= 3 ? [exact.replace(/^www\./, '')] : []),
      ...SEARCH_TLDS.map((tld) => `${label}.${tld}`),
    ])];
    const taken = new Set((await this.prisma.tenantDomain.findMany({ where: { hostname: { in: names.flatMap((n) => [n, `www.${n}`]) } }, select: { hostname: true } })).map((d) => d.hostname.replace(/^www\./, '')));
    const pending = new Set((await this.prisma.domainOrder.findMany({ where: { hostname: { in: names }, status: { in: ['awaiting_payment', 'registering'] } }, select: { hostname: true } })).map((o) => o.hostname));
    const quotes = await Promise.all(names.map((n) => registrar.quote(n)));
    return {
      testMode: registrar.testMode,
      results: quotes.map((q) => ({ ...q, available: q.available && !taken.has(q.hostname) && !pending.has(q.hostname) })),
    };
  }

  async createOrder(user: CurrentUser, dto: { hostname: string; years?: number; registrant: Partial<Registrant> }) {
    const tenantId = getEffectiveTenantId(user);
    const registrar = this.requireRegistrar();
    const hostname = normalizeHostname(dto.hostname);
    if (!hostname || !isApex(hostname) || !SEARCH_TLDS.includes(tldOf(hostname))) throw new BadRequestException('Escolha um dos domínios da busca.');
    const years = Math.min(3, Math.max(1, Math.round(Number(dto.years) || 1)));
    const r = dto.registrant || {};
    const name = String(r.name ?? '').trim().slice(0, 120);
    const document = validDocument(r.document);
    const email = String(r.email ?? '').trim().slice(0, 150);
    const phone = String(r.phone ?? '').replace(/[^\d+]/g, '').slice(0, 20);
    if (name.length < 3) throw new BadRequestException('Informe o nome do titular (pessoa ou empresa dona do domínio).');
    if (!document) throw new BadRequestException('Informe um CPF ou CNPJ válido do titular.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Informe um e-mail válido do titular.');
    if (phone.replace(/\D/g, '').length < 10) throw new BadRequestException('Informe um telefone com DDD do titular.');
    if (tldOf(hostname).endsWith('.br') && document.length !== 11 && document.length !== 14) throw new BadRequestException('Domínios .br precisam de CPF ou CNPJ.');

    const quote = await registrar.quote(hostname);
    const busy = await this.prisma.tenantDomain.findFirst({ where: { hostname: { in: [hostname, `www.${hostname}`] } } })
      || await this.prisma.domainOrder.findFirst({ where: { hostname, status: { in: ['awaiting_payment', 'registering'] } } });
    if (!quote.available || busy) throw new ConflictException('Esse domínio não está mais disponível. Faça uma nova busca.');

    const order = await this.prisma.domainOrder.create({
      data: {
        tenantId, hostname, years, priceCents: quote.priceCents * years, currency: quote.currency,
        registrant: { name, document, email, phone } as Prisma.InputJsonValue,
        provider: registrar.name, createdById: user.id,
      },
    });
    await this.audit.log(user, { action: 'create', resource: 'site_domain', resourceId: order.id, newData: { order: hostname, years } }).catch(() => undefined);
    return order;
  }

  async cancelOrder(user: CurrentUser, id: string) {
    const tenantId = getEffectiveTenantId(user);
    const order = await this.prisma.domainOrder.findFirst({ where: { id, tenantId } });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.status !== 'awaiting_payment') throw new BadRequestException('Só dá para cancelar pedidos que ainda aguardam pagamento.');
    return this.prisma.domainOrder.update({ where: { id }, data: { status: 'cancelled' } });
  }

  // ── Console da plataforma ──────────────────────────────────────────────

  async listOrders(status?: string) {
    const orders = await this.prisma.domainOrder.findMany({
      where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200,
    });
    const tenants = await this.prisma.tenant.findMany({ where: { id: { in: [...new Set(orders.map((o) => o.tenantId))] } }, select: { id: true, name: true, slug: true } });
    const byId = new Map(tenants.map((t) => [t.id, t]));
    return orders.map((o) => ({ ...o, tenant: byId.get(o.tenantId) ?? null }));
  }

  /** Pagamento recebido por fora: registra o dominio e ja liga ao site da empresa. */
  async markPaid(staff: PlatformStaffPrincipal, id: string, notes?: string) {
    const order = await this.prisma.domainOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (!['awaiting_payment', 'failed'].includes(order.status)) throw new BadRequestException('Esse pedido não está aguardando pagamento.');
    const registrar = this.registrar;
    if (!registrar || registrar.name !== order.provider) throw new BadRequestException('O registrador desse pedido não está configurado.');
    await this.prisma.domainOrder.update({
      where: { id },
      data: { status: 'registering', paidAt: order.paidAt ?? new Date(), paidByStaff: staff.name, ...(notes ? { notes: notes.slice(0, 500) } : {}) },
    });
    try {
      const reg = await registrar.register(order.hostname, order.years, order.registrant as unknown as Registrant);
      const updated = await this.prisma.domainOrder.update({
        where: { id }, data: { status: 'registered', providerRef: reg.providerRef, expiresAt: reg.expiresAt, lastError: null },
      });
      // O registrador ja aponta o DNS para a plataforma: o dominio entra conectado
      const hasPrimary = await this.prisma.tenantDomain.count({ where: { tenantId: order.tenantId, isPrimary: true } });
      await this.prisma.tenantDomain.upsert({
        where: { hostname: order.hostname },
        create: {
          tenantId: order.tenantId, hostname: order.hostname, kind: 'purchased', status: 'active', verifiedAt: new Date(),
          orderId: order.id, isPrimary: !hasPrimary,
        },
        update: { tenantId: order.tenantId, kind: 'purchased', status: 'active', verifiedAt: new Date(), orderId: order.id, lastError: null },
      });
      await this.platformAudit.log(staff, { action: 'domain.registered', targetType: 'domain_order', targetId: id, tenantId: order.tenantId, metadata: { hostname: order.hostname, years: order.years } });
      return updated;
    } catch (err) {
      const message = (err as Error).message || 'Falha no registrador';
      this.logger.warn(`Registro de ${order.hostname} falhou: ${message}`);
      await this.platformAudit.log(staff, { action: 'domain.failed', targetType: 'domain_order', targetId: id, tenantId: order.tenantId, metadata: { hostname: order.hostname, error: message } });
      return this.prisma.domainOrder.update({ where: { id }, data: { status: 'failed', lastError: message.slice(0, 500) } });
    }
  }

  async cancelByStaff(staff: PlatformStaffPrincipal, id: string, notes?: string) {
    const order = await this.prisma.domainOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (!['awaiting_payment', 'failed'].includes(order.status)) throw new BadRequestException('Só dá para cancelar pedidos não registrados.');
    await this.platformAudit.log(staff, { action: 'domain.cancelled', targetType: 'domain_order', targetId: id, tenantId: order.tenantId, metadata: { hostname: order.hostname } });
    return this.prisma.domainOrder.update({ where: { id }, data: { status: 'cancelled', ...(notes ? { notes: notes.slice(0, 500) } : {}) } });
  }

  /**
   * Confere sozinho, a cada 10 minutos, os dominios ainda esperando o DNS (e os que
   * deram erro), para a pessoa nao precisar clicar em "Conferir agora".
   */
  @Cron('*/10 * * * *', { name: 'site-domains-recheck', timeZone: 'America/Sao_Paulo' })
  async recheckPending() {
    const due = new Date(Date.now() - 9 * 60 * 1000);
    const list = await this.prisma.tenantDomain.findMany({
      where: { status: { in: ['pending_dns', 'error'] }, OR: [{ lastCheckAt: null }, { lastCheckAt: { lt: due } }] },
      orderBy: { lastCheckAt: 'asc' }, take: 50, select: { id: true, tenantId: true },
    });
    for (const d of list) {
      try {
        await this.verifyRecord(d.id, d.tenantId);
      } catch (err) {
        this.logger.warn(`Conferencia de DNS falhou (${d.id}): ${(err as Error).message}`);
      }
    }
  }

  // ── Publico (site no dominio do cliente) ───────────────────────────────

  /** Qual empresa responde neste endereco (so dominios ativos de empresas ativas), com a marca dela. */
  async resolve(rawHost: string) {
    const hostname = normalizeHostname(rawHost);
    if (!hostname) return null;
    const domain = await this.prisma.tenantDomain.findUnique({ where: { hostname } });
    if (!domain || domain.status === 'pending_dns') return null;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: domain.tenantId }, select: { slug: true, status: true, name: true, logo: true, settings: true } });
    if (!tenant || tenant.status !== Status.ACTIVE) return null;
    // Nome, logo e cor: a tela de login no dominio da empresa usa a marca dela
    const brandColor = (tenant.settings as { theme?: { brandColor?: string } } | null)?.theme?.brandColor ?? null;
    return { tenant: tenant.slug, name: tenant.name, logo: tenant.logo, brandColor };
  }

  /** O servidor pode pedir certificado para este endereco? (so dominios cadastrados) */
  async tlsAllowed(rawHost: string) {
    const hostname = normalizeHostname(rawHost);
    if (!hostname) return false;
    return (await this.prisma.tenantDomain.count({ where: { hostname } })) > 0;
  }

  /** Dominio principal ativo da empresa (para os links do site). */
  async primaryHost(tenantId: string): Promise<string | null> {
    const d = await this.prisma.tenantDomain.findFirst({ where: { tenantId, isPrimary: true, status: 'active' }, select: { hostname: true } });
    return d?.hostname ?? null;
  }
}
