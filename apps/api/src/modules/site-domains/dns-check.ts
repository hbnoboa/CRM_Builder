import { promises as dns } from 'dns';
import { isApex } from './domain-utils';

/**
 * Confere se o dominio do cliente ja aponta para a plataforma: subdominio (www.)
 * com CNAME para o nosso endereco, ou dominio principal com registro A nos nossos IPs.
 * DOMAIN_DNS_CHECK=mock (testes): conta como apontado o endereco terminado em ".ok.test".
 */

export interface DnsTarget {
  cname: string;
  ips: string[];
}

export function dnsTarget(): DnsTarget {
  return {
    cname: (process.env.SITE_DOMAIN_CNAME || 'iossystem.com.br').toLowerCase(),
    ips: (process.env.SITE_DOMAIN_IPS || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

export interface DnsResult {
  ok: boolean;
  /** O que esta configurado hoje (para mostrar a pessoa). */
  found: string[];
  error?: string;
}

export async function checkDns(host: string): Promise<DnsResult> {
  const target = dnsTarget();
  if (process.env.DOMAIN_DNS_CHECK === 'mock') {
    return host.endsWith('.ok.test')
      ? { ok: true, found: [target.cname] }
      : { ok: false, found: [], error: 'O endereço ainda não aponta para a plataforma.' };
  }
  const found: string[] = [];
  try {
    const cnames = await dns.resolveCname(host).catch(() => [] as string[]);
    found.push(...cnames.map((c) => `CNAME ${c.toLowerCase().replace(/\.$/, '')}`));
    if (cnames.some((c) => c.toLowerCase().replace(/\.$/, '') === target.cname)) return { ok: true, found };

    const a = await dns.resolve4(host).catch(() => [] as string[]);
    found.push(...a.map((ip) => `A ${ip}`));
    if (target.ips.length && a.some((ip) => target.ips.includes(ip))) return { ok: true, found };
    // Sem IPs configurados: aceita A igual ao do nosso endereco principal
    if (!target.ips.length && a.length) {
      const ours = await dns.resolve4(target.cname).catch(() => [] as string[]);
      if (a.some((ip) => ours.includes(ip))) return { ok: true, found };
    }
    if (!found.length) return { ok: false, found, error: 'Ainda não encontramos nenhum registro para esse endereço. Depois de criar, pode levar de alguns minutos a algumas horas para valer.' };
    return {
      ok: false, found,
      error: isApex(host)
        ? 'O endereço existe, mas ainda não aponta para a plataforma. Confira o registro A.'
        : 'O endereço existe, mas ainda não aponta para a plataforma. Confira o registro CNAME.',
    };
  } catch (err) {
    return { ok: false, found, error: `Não foi possível consultar o DNS agora (${(err as Error).message}).` };
  }
}
