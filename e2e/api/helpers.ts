import { createHmac } from 'crypto';
import { APIRequestContext, APIResponse, expect } from '@playwright/test';

// Monta o cenario so pela API, com sufixo novo a cada execucao. Nada e reaproveitado
// entre rodadas: empresas nao podem ser apagadas, entao ficam em dev como "QA API ...".
export const API = process.env.API_URL
  || (process.env.BASE_URL ? `${process.env.BASE_URL.replace(/\/$/, '')}/api/v1` : 'http://localhost:3101/api/v1');

export const PASSWORD = 'Teste@2026qa';
export const suffix = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export type Session = { token: string; slug?: string; userId?: string; email?: string };
type CallOptions = { data?: unknown; expected?: number | number[] };

export async function call(
  ctx: APIRequestContext,
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  path: string,
  session: Session | null,
  options: CallOptions = {},
): Promise<APIResponse> {
  const headers: Record<string, string> = {};
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  if (session?.slug) headers['X-Tenant-Slug'] = session.slug;
  const response = await ctx[method](`${API}${path}`, { headers, data: options.data as never });
  if (options.expected !== undefined) {
    const expected = ([] as number[]).concat(options.expected);
    expect(expected, `${method.toUpperCase()} ${path}: ${response.status()} ${await response.text()}`).toContain(response.status());
  }
  return response;
}

/** Login com espera: em dev o nginx e a API limitam tentativas por minuto. */
async function loginWithRetry(ctx: APIRequestContext, path: string, email: string, password: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await ctx.post(`${API}${path}`, { data: { email, password } });
    if (![429, 503].includes(response.status())) return response;
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  throw new Error(`Login limitado: ${email}`);
}

export async function loginStaff(ctx: APIRequestContext, email: string, password: string): Promise<Session> {
  const response = await loginWithRetry(ctx, '/platform/auth/login', email, password);
  expect(response.status(), await response.text()).toBe(200);
  return { token: (await response.json()).accessToken, email };
}

export async function loginUser(ctx: APIRequestContext, email: string, slug: string): Promise<Session> {
  const response = await loginWithRetry(ctx, '/auth/login', email, PASSWORD);
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json();
  return { token: body.accessToken, slug, userId: body.user?.id, email };
}

export async function ownerStaff(ctx: APIRequestContext): Promise<Session> {
  const email = process.env.PLATFORM_EMAIL;
  const password = process.env.PLATFORM_PASSWORD;
  if (!email || !password) throw new Error('Defina PLATFORM_EMAIL e PLATFORM_PASSWORD (dono do console)');
  return loginStaff(ctx, email, password);
}

export type Tenant = { id: string; slug: string; name: string; ownerEmail: string; owner: Session };

export async function createTenant(ctx: APIRequestContext, staff: Session): Promise<Tenant> {
  const id = suffix();
  const slug = `qa-api-${id}`;
  const ownerEmail = `qa-api-${id}@example.com`;
  const response = await call(ctx, 'post', '/platform/tenants', staff, {
    expected: [200, 201],
    data: { name: `QA API ${id}`, slug, adminName: 'Dono QA', adminEmail: ownerEmail, adminPassword: PASSWORD },
  });
  const tenant = await response.json();
  return { id: tenant.id, slug, name: tenant.name, ownerEmail, owner: await loginUser(ctx, ownerEmail, slug) };
}

export async function listRoles(ctx: APIRequestContext, session: Session): Promise<Array<{ id: string; name: string }>> {
  const body = await (await call(ctx, 'get', '/custom-roles?limit=100', session, { expected: 200 })).json();
  return body.data ?? body;
}

export async function createRole(ctx: APIRequestContext, session: Session, data: Record<string, unknown>): Promise<string> {
  const response = await call(ctx, 'post', '/custom-roles', session, { expected: [200, 201], data });
  return (await response.json()).id;
}

export async function createPerson(
  ctx: APIRequestContext,
  owner: Session,
  slug: string,
  name: string,
  customRoleId: string,
): Promise<Session> {
  const email = `qa-${name.toLowerCase()}-${suffix()}@example.com`;
  await call(ctx, 'post', '/users', owner, { expected: [200, 201], data: { email, name, password: PASSWORD, customRoleId } });
  return loginUser(ctx, email, slug);
}

export const CLIENT_FIELDS = [
  { slug: 'nome', name: 'Nome', type: 'text' },
  { slug: 'vip', name: 'VIP', type: 'text' },
  { slug: 'cpf', name: 'CPF', type: 'text' },
];

export async function createClientsTable(ctx: APIRequestContext, owner: Session): Promise<string> {
  const response = await call(ctx, 'post', '/entities', owner, {
    expected: [200, 201],
    data: { name: 'Clientes', slug: 'clientes', fields: CLIENT_FIELDS },
  });
  return (await response.json()).id;
}

export async function createRecord(ctx: APIRequestContext, session: Session, nome: string, vip = 'nao'): Promise<string> {
  const response = await call(ctx, 'post', '/data/clientes', session, {
    expected: [200, 201],
    data: { data: { nome, vip, cpf: `cpf-${nome}` } },
  });
  return (await response.json()).id;
}

export async function visibleNames(ctx: APIRequestContext, session: Session): Promise<string[]> {
  const body = await (await call(ctx, 'get', '/data/clientes?limit=100', session, { expected: 200 })).json();
  return body.data.map((r: { data: { nome: string } }) => r.data.nome).sort();
}

/** Codigo TOTP (RFC 6238, SHA-1, 30 s, 6 digitos) a partir do segredo em base32. */
export function totp(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
