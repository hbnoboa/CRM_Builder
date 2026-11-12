import { BadRequestException } from '@nestjs/common';
import { lookup, type LookupAddress, type LookupOptions } from 'dns';
import { BlockList, isIP } from 'net';
import { Agent, fetch as undiciFetch, type RequestInit, type Response } from 'undici';

/**
 * Requisicao para URL configurada pelo cliente (webhook, automacao, tarefa agendada...).
 * Sem isso, quem configura a URL alcanca a rede interna da VM: banco, Redis e o
 * servidor de metadados do Google Cloud (169.254.169.254), que entrega credenciais.
 *
 * - so http/https; IP interno literal na URL e recusado;
 * - o IP resolvido pelo DNS e checado NA CONEXAO (cobre DNS rebinding);
 * - nao segue redirecionamento (um 30x poderia apontar para dentro).
 * OUTBOUND_ALLOW_PRIVATE=true libera enderecos internos (so para teste local).
 */
const blocked = new BlockList();
for (const cidr of [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12',
  '192.0.0.0/24', '192.168.0.0/16', '198.18.0.0/15', '224.0.0.0/4', '240.0.0.0/4',
]) {
  const [address, prefix] = cidr.split('/');
  blocked.addSubnet(address, Number(prefix), 'ipv4');
}
for (const cidr of ['::/128', '::1/128', 'fc00::/7', 'fe80::/10', 'ff00::/8']) {
  const [address, prefix] = cidr.split('/');
  blocked.addSubnet(address, Number(prefix), 'ipv6');
}

const allowPrivate = () => process.env.OUTBOUND_ALLOW_PRIVATE === 'true';

export function isBlockedAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return blocked.check(mapped[1], 'ipv4');
  const family = isIP(address);
  if (family === 4) return blocked.check(address, 'ipv4');
  if (family === 6) return blocked.check(address, 'ipv6');
  return true;
}

class BlockedDestinationError extends Error {
  readonly code = 'EBLOCKED';
}

function safeLookup(
  hostname: string,
  options: LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = addresses as LookupAddress[];
    if (!allowPrivate() && (list.length === 0 || list.some((a) => isBlockedAddress(a.address)))) {
      return callback(new BlockedDestinationError(`Destino bloqueado: ${hostname} aponta para um endereco interno`), '');
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

const agent = new Agent({ connect: { lookup: safeLookup as never } });

function parse(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('URL invalida');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestException('A URL precisa comecar com http:// ou https://');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!allowPrivate() && isIP(host) && isBlockedAddress(host)) {
    throw new BadRequestException('A URL aponta para um endereco interno');
  }
  return parsed;
}

/** Validacao para a hora de salvar (mensagem amigavel); o disparo checa de novo. */
export async function assertPublicUrl(url: string): Promise<void> {
  const parsed = parse(url);
  if (allowPrivate()) return;
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return;
  const addresses = await new Promise<LookupAddress[]>((resolve) =>
    lookup(host, { all: true }, (err, list) => resolve(err ? [] : (list as LookupAddress[]))),
  );
  if (addresses.length === 0) throw new BadRequestException(`Nao foi possivel encontrar o endereco ${host}`);
  if (addresses.some((a) => isBlockedAddress(a.address))) {
    throw new BadRequestException('A URL aponta para um endereco interno');
  }
}

export async function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  parse(url);
  try {
    return await undiciFetch(url, { ...init, redirect: 'manual', dispatcher: agent });
  } catch (error) {
    // undici embrulha o erro da conexao em "fetch failed": mostra o motivo real.
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    if (cause?.code === 'EBLOCKED') throw new Error(cause.message);
    throw error;
  }
}
