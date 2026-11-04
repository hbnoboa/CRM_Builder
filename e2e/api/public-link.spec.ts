import { test, expect } from '@playwright/test';
import { API, call, createClientsTable, createPerson, createTenant, listRoles, ownerStaff, PASSWORD, Session, suffix, Tenant, totp } from './helpers';

// E-13/3 e O-18/8-10: o formulario publico e porta de entrada sem login.
test.describe.configure({ mode: 'serial' });

let tenant: Tenant;
let roles: Array<{ id: string; name: string }>;
let link: { slug: string };
let vera: Session;

test.beforeAll(async ({ request }) => {
  test.setTimeout(120_000);
  tenant = await createTenant(request, await ownerStaff(request));
  await createClientsTable(request, tenant.owner);
  roles = await listRoles(request, tenant.owner);
  vera = await createPerson(request, tenant.owner, tenant.slug, 'Vera', roles.find((r) => r.name === 'Visualizador')!.id);
  link = await (await call(request, 'post', '/public-links', tenant.owner, {
    expected: [200, 201],
    data: { name: 'QA Link', entitySlug: 'clientes' },
  })).json();
});

test('[E-13/3] link nao aceita cargo de gestao', async ({ request }) => {
  for (const name of ['Administrador', 'Gerente']) {
    await call(request, 'post', '/public-links', tenant.owner, {
      expected: 400,
      data: { name: 'QA Admin', entitySlug: 'clientes', customRoleId: roles.find((r) => r.name === name)!.id },
    });
  }
});

test('cadastro pelo link nao ganha administracao', async ({ request }) => {
  const email = `qa-link-${suffix()}@example.com`;
  const response = await request.post(`${API}/p/${link.slug}/register`, { data: { name: 'Visitante', email, password: PASSWORD } });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json();
  await call(request, 'get', '/users', { token: body.accessToken, slug: tenant.slug }, { expected: 403 });
});

test('[O-18/10] login pelo link nao altera cargo da empresa', async ({ request }) => {
  const before = await (await call(request, 'get', `/custom-roles/${roles.find((r) => r.name === 'Visualizador')!.id}`, tenant.owner, { expected: 200 })).json();
  const response = await request.post(`${API}/p/${link.slug}/login`, { data: { identifier: vera.email, password: PASSWORD } });
  expect(response.status(), await response.text()).toBe(201);
  const after = await (await call(request, 'get', `/custom-roles/${roles.find((r) => r.name === 'Visualizador')!.id}`, tenant.owner, { expected: 200 })).json();
  expect(after.permissions).toEqual(before.permissions);
});

test('[O-18/8] conta com duas etapas nao entra pelo link', async ({ request }) => {
  const setup = await (await call(request, 'post', '/auth/mfa/setup', tenant.owner, { expected: [200, 201] })).json();
  await call(request, 'post', '/auth/mfa/enable', tenant.owner, { expected: [200, 201], data: { code: totp(setup.secret) } });
  const response = await request.post(`${API}/p/${link.slug}/login`, { data: { identifier: tenant.ownerEmail, password: PASSWORD } });
  expect(response.status(), await response.text()).toBe(403);
});

test('[O-18/9] login pelo link tem limite de tentativas', async ({ request }) => {
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const response = await request.post(`${API}/p/${link.slug}/login`, { data: { identifier: vera.email, password: 'errada-123' } });
    statuses.push(response.status());
  }
  expect(statuses).toContain(429);
});

test('[P-01/4b] refreshToken no corpo nao anula o limite de login', async ({ request }) => {
  const statuses: number[] = [];
  const email = `qa-limite-${suffix()}@example.com`;
  for (let i = 0; i < 6; i++) {
    const response = await request.post(`${API}/platform/auth/login`, { data: { email, password: 'errada-123', refreshToken: suffix() } });
    statuses.push(response.status());
  }
  expect(statuses).toContain(429);
});
