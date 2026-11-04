import { test, expect } from '@playwright/test';
import { call, createClientsTable, createRecord, createTenant, listRoles, ownerStaff, Session, Tenant } from './helpers';

// Nada de uma empresa aparece nem muda a partir do token de outra.
test.describe.configure({ mode: 'serial' });

let a: Tenant; let b: Tenant;
let recordB: string; let roleB: string; let entityB: string; let teamB: string; let webhookB: string;

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000);
  const staff = await ownerStaff(request);
  a = await createTenant(request, staff);
  b = await createTenant(request, staff);
  await createClientsTable(request, a.owner);
  entityB = await createClientsTable(request, b.owner);
  recordB = await createRecord(request, b.owner, 'Segredo');
  roleB = (await listRoles(request, b.owner))[0].id;
  teamB = (await (await call(request, 'post', '/teams', b.owner, { expected: [200, 201], data: { name: 'Time B' } })).json()).id;
  webhookB = (await (await call(request, 'post', '/webhooks', b.owner, {
    expected: [200, 201],
    data: { name: 'QA', url: 'https://example.com/hook', events: ['created'], entityId: entityB },
  })).json()).id;
});

test('slug de outra empresa e recusado', async ({ request }) => {
  const forged: Session = { token: a.owner.token, slug: b.slug };
  await call(request, 'get', '/data/clientes', forged, { expected: [401, 403] });
});

test('IDs de outra empresa nao abrem nem mudam', async ({ request }) => {
  const s = a.owner;
  await call(request, 'get', `/data/clientes/${recordB}`, s, { expected: [403, 404] });
  await call(request, 'patch', `/data/clientes/${recordB}`, s, { expected: [403, 404], data: { data: { nome: 'x' } } });
  await call(request, 'delete', `/data/clientes/${recordB}`, s, { expected: [403, 404] });
  await call(request, 'get', `/custom-roles/${roleB}`, s, { expected: [403, 404] });
  await call(request, 'patch', `/custom-roles/${roleB}`, s, { expected: [403, 404], data: { name: 'x' } });
  await call(request, 'get', `/entities/${entityB}`, s, { expected: [403, 404] });
  await call(request, 'patch', `/teams/${teamB}`, s, { expected: [403, 404], data: { name: 'xx' } });
  await call(request, 'get', `/webhooks/${webhookB}`, s, { expected: [403, 404] });
  await call(request, 'get', `/users/${b.owner.userId}`, s, { expected: [403, 404] });
});

test('lista da outra empresa nao traz nada', async ({ request }) => {
  const body = await (await call(request, 'get', '/data/clientes', a.owner, { expected: 200 })).json();
  expect(JSON.stringify(body)).not.toContain('Segredo');
  expect(JSON.stringify(body)).not.toContain(recordB);
});

test('token de empresa nao entra no console e vice-versa', async ({ request }) => {
  await call(request, 'get', '/platform/tenants', a.owner, { expected: 401 });
  const staff = await ownerStaff(request);
  await call(request, 'get', '/auth/me', staff, { expected: 401 });
});
