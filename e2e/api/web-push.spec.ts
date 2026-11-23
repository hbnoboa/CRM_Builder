import { test, expect } from '@playwright/test';
import { call, createTenant, ownerStaff, type Tenant } from './helpers';

// Notificacao no navegador (Web Push) do aplicativo instalavel: so com o aplicativo ligado,
// so endereco de servico de push conhecido, e cada aparelho preso a pessoa e a empresa.
test.describe.configure({ mode: 'serial' });

let tenant: Tenant;
const FCM = (id: string) => `https://fcm.googleapis.com/fcm/send/qa-${id}`;
const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };

test.beforeAll(async ({ request }) => {
  test.setTimeout(120_000);
  tenant = await createTenant(request, await ownerStaff(request));
});

test('aplicativo desligado: indisponivel e nao inscreve', async ({ request }) => {
  const cfg = await (await call(request, 'get', '/push/web/config', tenant.owner, { expected: 200 })).json();
  expect(cfg).toEqual({ available: false, publicKey: null });
  await call(request, 'post', '/push/web/subscribe', tenant.owner, { expected: 400, data: { endpoint: FCM('a'), keys: KEYS } });
});

test('ligado: inscreve, consulta e desinscreve; endereco de fora e recusado', async ({ request }) => {
  await call(request, 'patch', '/tenants/me', tenant.owner, { expected: 200, data: { appEnabled: true } });
  const cfg = await (await call(request, 'get', '/push/web/config', tenant.owner, { expected: 200 })).json();
  test.skip(!cfg.available, 'API sem chaves de Web Push (WEB_PUSH_PUBLIC_KEY/PRIVATE_KEY)');
  expect(cfg.publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);

  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://exemplo.com/push', 'https://googleapis.com.evil.io/x', 'nao-e-url']) {
    await call(request, 'post', '/push/web/subscribe', tenant.owner, { expected: 400, data: { endpoint, keys: KEYS } });
  }

  const endpoint = FCM(`${Date.now()}`);
  await call(request, 'post', '/push/web/subscribe', tenant.owner, { expected: [200, 201], data: { endpoint, keys: KEYS } });
  const st = await (await call(request, 'post', '/push/web/status', tenant.owner, { expected: 200, data: { endpoint } })).json();
  expect(st.subscribed).toBe(true);
  await call(request, 'delete', '/push/web/subscribe', tenant.owner, { expected: 200, data: { endpoint } });
  const after = await (await call(request, 'post', '/push/web/status', tenant.owner, { expected: 200, data: { endpoint } })).json();
  expect(after.subscribed).toBe(false);
});

test('desligar o aplicativo deixa indisponivel de novo', async ({ request }) => {
  await call(request, 'patch', '/tenants/me', tenant.owner, { expected: 200, data: { appEnabled: false } });
  const cfg = await (await call(request, 'get', '/push/web/config', tenant.owner, { expected: 200 })).json();
  expect(cfg.available).toBe(false);
});
