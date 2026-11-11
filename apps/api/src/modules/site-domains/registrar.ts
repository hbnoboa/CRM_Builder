import { Logger } from '@nestjs/common';
import { tldOf } from './domain-utils';

/**
 * Registrador de dominios. Hoje so existe o de TESTE (DOMAIN_REGISTRAR=mock): diz se
 * um dominio esta livre, da um preco e "registra" na hora, sem cobrar nem registrar
 * de verdade. Quando a IOS System contratar uma revenda com API, entra outro provedor
 * com a mesma interface. Sem DOMAIN_REGISTRAR, a compra de dominios fica desligada.
 */

export interface DomainQuote {
  hostname: string;
  available: boolean;
  /** Preco por ano, em centavos. */
  priceCents: number;
  currency: string;
}

export interface Registrant {
  name: string;
  document: string;
  email: string;
  phone: string;
}

export interface DomainRegistrar {
  readonly name: string;
  /** Teste: nada e registrado nem cobrado de verdade. */
  readonly testMode: boolean;
  quote(hostname: string): Promise<DomainQuote>;
  /** Registra no nome do titular e aponta o DNS para a plataforma. */
  register(hostname: string, years: number, registrant: Registrant): Promise<{ providerRef: string; expiresAt: Date }>;
}

/** Precos de teste por ano (centavos), so para o fluxo funcionar. */
const MOCK_PRICES: Record<string, number> = { 'com.br': 4000, 'net.br': 4000, com: 7900, net: 8900 };
const MOCK_TAKEN = ['google', 'facebook', 'iossystem', 'crmbuilder', 'ocupado'];

class MockRegistrar implements DomainRegistrar {
  readonly name = 'mock';
  readonly testMode = true;
  private readonly logger = new Logger('MockRegistrar');

  async quote(hostname: string): Promise<DomainQuote> {
    const label = hostname.split('.')[0];
    const price = MOCK_PRICES[tldOf(hostname)] ?? 9900;
    return { hostname, available: !MOCK_TAKEN.some((t) => label.includes(t)), priceCents: price, currency: 'BRL' };
  }

  async register(hostname: string, years: number): Promise<{ providerRef: string; expiresAt: Date }> {
    if (hostname.split('.')[0].includes('falha')) throw new Error('O registrador recusou o pedido (teste).');
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + years);
    this.logger.log(`[teste] dominio ${hostname} "registrado" por ${years} ano(s)`);
    return { providerRef: `teste-${hostname}`, expiresAt };
  }
}

export function createRegistrar(): DomainRegistrar | null {
  const kind = (process.env.DOMAIN_REGISTRAR || '').toLowerCase();
  if (kind === 'mock') return new MockRegistrar();
  return null;
}
