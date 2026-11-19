import { Logger } from '@nestjs/common';
import { tldOf } from './domain-utils';

/**
 * Registrador de dominios (DOMAIN_REGISTRAR):
 *   - mock: TESTE. Diz se um dominio esta livre, da um preco e "registra" na hora, sem
 *     cobrar nem registrar de verdade.
 *   - manual: disponibilidade de verdade pela consulta publica RDAP (Registro.br para
 *     .br, Verisign para .com/.net) e preco de DOMAIN_PRICES_CENTS. O registro e feito
 *     pela equipe no painel do Registro.br/revenda, no CPF/CNPJ do titular; o console so
 *     marca como pago e registrado.
 * Quando houver credenciamento EPP ou revenda com API, entra outro provedor com a mesma
 * interface. Sem DOMAIN_REGISTRAR, a compra de dominios fica desligada.
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

/** Consulta publica de registro (RDAP) de cada extensao vendida. */
const RDAP_BY_TLD: Record<string, string> = {
  'com.br': 'https://rdap.registro.br/domain/',
  'net.br': 'https://rdap.registro.br/domain/',
  com: 'https://rdap.verisign.com/com/v1/domain/',
  net: 'https://rdap.verisign.com/net/v1/domain/',
};
const RDAP_TIMEOUT_MS = 5000;
const RDAP_CACHE_MS = 5 * 60 * 1000;

/** Preco de venda por ano (centavos). DOMAIN_PRICES_CENTS='{"com.br":6000,"com":9900}' sobrepoe. */
function salePrices(): Record<string, number> {
  try {
    return { ...MOCK_PRICES, ...(JSON.parse(process.env.DOMAIN_PRICES_CENTS || '{}') as Record<string, number>) };
  } catch {
    return MOCK_PRICES;
  }
}

class ManualRegistrar implements DomainRegistrar {
  readonly name = 'manual';
  readonly testMode = false;
  private readonly logger = new Logger('ManualRegistrar');
  private readonly prices = salePrices();
  private readonly cache = new Map<string, { available: boolean; until: number }>();

  async quote(hostname: string): Promise<DomainQuote> {
    const tld = tldOf(hostname);
    const price = this.prices[tld];
    if (!price || !RDAP_BY_TLD[tld]) return { hostname, available: false, priceCents: price ?? 0, currency: 'BRL' };
    return { hostname, available: await this.isFree(hostname, RDAP_BY_TLD[tld]), priceCents: price, currency: 'BRL' };
  }

  /** RDAP: 404 = ninguem registrou. Qualquer outra resposta (ou falha) = nao oferece. */
  private async isFree(hostname: string, base: string): Promise<boolean> {
    const hit = this.cache.get(hostname);
    if (hit && hit.until > Date.now()) return hit.available;
    let available = false;
    try {
      const res = await fetch(`${base}${encodeURIComponent(hostname)}`, {
        headers: { Accept: 'application/rdap+json' },
        signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
      });
      available = res.status === 404;
      if (res.status !== 404 && res.status !== 200) this.logger.warn(`RDAP de ${hostname} respondeu ${res.status}`);
    } catch (err) {
      this.logger.warn(`RDAP de ${hostname} falhou: ${(err as Error).message}`);
      return false; // sem resposta: nao oferece e nao guarda
    }
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(hostname, { available, until: Date.now() + RDAP_CACHE_MS });
    return available;
  }

  /** A equipe ja registrou no painel do Registro.br/revenda: so confere e anota. */
  async register(hostname: string, years: number): Promise<{ providerRef: string; expiresAt: Date }> {
    const base = RDAP_BY_TLD[tldOf(hostname)];
    if (base) {
      this.cache.delete(hostname);
      if (await this.isFree(hostname, base)) {
        throw new Error('O domínio ainda aparece livre na consulta pública. Registre no painel do Registro.br (ou da revenda) no CPF/CNPJ do titular e tente de novo.');
      }
    }
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + years);
    return { providerRef: `manual-${hostname}`, expiresAt };
  }
}

export function createRegistrar(): DomainRegistrar | null {
  const kind = (process.env.DOMAIN_REGISTRAR || '').toLowerCase();
  if (kind === 'mock') return new MockRegistrar();
  if (kind === 'manual') return new ManualRegistrar();
  return null;
}
