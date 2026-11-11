/**
 * Regras de nomes de dominio: normalizar o que a pessoa digita, recusar enderecos
 * da propria plataforma e separar dominio principal (apex) de subdominio.
 */

const HOST_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
/** Sufixos de dois niveis comuns no Brasil (meucafe.com.br e apex, nao subdominio). */
const TWO_LEVEL = new Set(['com.br', 'net.br', 'org.br', 'art.br', 'blog.br', 'eco.br', 'ind.br', 'adv.br', 'eng.br', 'med.br', 'arq.br', 'tec.br', 'app.br', 'dev.br', 'emp.br', 'nom.br']);

/** Dominios que vendemos na busca (na ordem em que aparecem). */
export const SEARCH_TLDS = ['com.br', 'com', 'net.br', 'net'];

/** "https://www.MeuCafe.com.br/cardapio" -> "www.meucafe.com.br"; vazio se invalido. */
export function normalizeHostname(raw: unknown): string {
  let s = String(raw ?? '').trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '');
  return HOST_RE.test(s) ? s : '';
}

/** Endereco da propria plataforma (nunca pode ser dominio de cliente). */
export function isPlatformHost(host: string): boolean {
  const extra = (process.env.PLATFORM_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return host === 'iossystem.com.br' || host.endsWith('.iossystem.com.br') || host === 'localhost'
    || /^\d+\.\d+\.\d+\.\d+$/.test(host) || extra.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Parte "registravel" do endereco: www.meucafe.com.br -> meucafe.com.br. */
export function registrableDomain(host: string): string {
  const parts = host.split('.');
  const last2 = parts.slice(-2).join('.');
  return TWO_LEVEL.has(last2) ? parts.slice(-3).join('.') : last2;
}

/** meucafe.com.br e apex (precisa de registro A); www.meucafe.com.br e subdominio (CNAME). */
export function isApex(host: string): boolean {
  return registrableDomain(host) === host;
}

/** "Meu Café Docinho!" -> "meucafedocinho" (para a busca de dominios). */
export function domainLabel(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split('.')[0].replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 63);
}

export function tldOf(host: string): string {
  return host.slice(registrableDomain(host).indexOf('.') + 1);
}

/** CPF (11) ou CNPJ (14) so com digitos validos. */
export function validDocument(raw: unknown): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 11) return validCpf(d) ? d : '';
  if (d.length === 14) return validCnpj(d) ? d : '';
  return '';
}

function validCpf(c: string): boolean {
  if (/^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

function validCnpj(c: string): boolean {
  if (/^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((acc, wi, i) => acc + Number(c[i]) * wi, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}
