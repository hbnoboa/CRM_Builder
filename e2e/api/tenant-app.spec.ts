import { test, expect } from '@playwright/test';
import { API, call, createTenant, ownerStaff, type Tenant } from './helpers';

// Aplicativo instalavel (PWA) por empresa: dados publicos so com a opcao ligada.
test.describe.configure({ mode: 'serial' });

let tenant: Tenant;
// PNG 1x1 (vermelho)
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

const app = (request: Parameters<typeof call>[0]) => request.get(`${API}/public/tenants/${tenant.slug}/app`);
const logo = (request: Parameters<typeof call>[0]) => request.get(`${API}/public/tenants/${tenant.slug}/app/logo.png`);

test.beforeAll(async ({ request }) => {
  test.setTimeout(120_000);
  tenant = await createTenant(request, await ownerStaff(request));
});

test('desligado (padrao): nada publico sobre a empresa', async ({ request }) => {
  expect((await app(request)).status()).toBe(404);
  expect((await logo(request)).status()).toBe(404);
  expect((await request.get(`${API}/public/tenants/nao-existe-${Date.now()}/app`)).status()).toBe(404);
});

test('ligado: nome, nome curto, cor e versao que muda com a marca', async ({ request }) => {
  await call(request, 'patch', '/tenants/me', tenant.owner, { expected: 200, data: { appEnabled: true, appShortName: '  Campo  ', brandColor: '#123abc' } });
  const res = await app(request);
  expect(res.status()).toBe(200);
  const info = await res.json();
  expect(info).toMatchObject({ slug: tenant.slug, name: tenant.name, shortName: 'Campo', brandColor: '#123abc', hasLogo: false });
  expect(info.version).toMatch(/^[0-9a-f]{10}$/);
  expect(Object.keys(info).sort()).toEqual(['brandColor', 'hasLogo', 'name', 'shortName', 'slug', 'version']);

  await call(request, 'patch', '/tenants/me', tenant.owner, { expected: 200, data: { appShortName: null, brandColor: '#654321' } });
  const again = await (await app(request)).json();
  expect(again.shortName).toBe(tenant.name.slice(0, 20));
  expect(again.version).not.toBe(info.version);

  await call(request, 'patch', '/tenants/me', tenant.owner, { expected: 400, data: { appShortName: 'x'.repeat(21) } });
});

test('logo vira PNG so quando e arquivo do proprio sistema', async ({ request }) => {
  const up = await request.post(`${API}/upload/image`, {
    headers: { Authorization: `Bearer ${tenant.owner.token}`, 'X-Tenant-Slug': tenant.slug },
    multipart: { image: { name: 'logo.png', mimeType: 'image/png', buffer: PNG_1PX }, folder: 'branding' },
  });
  expect(up.ok(), await up.text()).toBeTruthy();
  const uploaded = await up.json();
  await call(request, 'patch', '/tenants/me', tenant.owner, { expected: 200, data: { logo: uploaded.publicUrl || uploaded.url } });
  const res = await logo(request);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  const body = await res.body();
  expect(body.subarray(1, 4).toString()).toBe('PNG');
  expect((await (await app(request)).json()).hasLogo).toBe(true);

  // Endereco de fora: a API nao busca (sem acesso a URL arbitraria)
  await call(request, 'patch', '/tenants/me', tenant.owner, { expected: 200, data: { logo: 'https://example.com/logo.png' } });
  expect((await logo(request)).status()).toBe(404);
});

test('desligar some de novo', async ({ request }) => {
  await call(request, 'patch', '/tenants/me', tenant.owner, { expected: 200, data: { appEnabled: false } });
  expect((await app(request)).status()).toBe(404);
});
