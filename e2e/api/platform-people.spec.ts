import { test, expect } from '@playwright/test';
import { call, createTenant, ownerStaff, type Session, type Tenant } from './helpers';

// Console › Pessoas: lista de todas as empresas (mais recentes primeiro) com busca e filtros.

test.describe('console: lista de pessoas', () => {
  let staff: Session;
  let tenant: Tenant;
  test.beforeAll(async ({ request }) => {
    staff = await ownerStaff(request);
    tenant = await createTenant(request, staff);
  });

  test('sem busca ja lista, paginado', async ({ request }) => {
    const body = await (await call(request, 'get', '/platform/users?limit=5', staff, { expected: 200 })).json();
    expect(body.meta).toMatchObject({ page: 1, limit: 5 });
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.data.length).toBeLessThanOrEqual(5);
  });

  test('filtros: empresa, donos e busca', async ({ request }) => {
    const byTenant = await (await call(request, 'get', `/platform/users?tenantId=${tenant.id}`, staff, { expected: 200 })).json();
    expect(byTenant.data.map((p: { email: string }) => p.email)).toEqual([tenant.ownerEmail]);
    expect(byTenant.data[0].memberships.some((m: { tenant: { id: string }; isOwner: boolean }) => m.tenant.id === tenant.id && m.isOwner)).toBe(true);

    const owners = await (await call(request, 'get', '/platform/users?owner=true&limit=100', staff, { expected: 200 })).json();
    expect(owners.data.every((p: { memberships: Array<{ isOwner: boolean }> }) => p.memberships.some((m) => m.isOwner))).toBe(true);

    const found = await (await call(request, 'get', `/platform/users?q=${encodeURIComponent(tenant.ownerEmail)}`, staff, { expected: 200 })).json();
    expect(found.data.map((p: { email: string }) => p.email)).toEqual([tenant.ownerEmail]);

    await call(request, 'get', '/platform/users?status=QUALQUER', staff, { expected: 400 });
  });
});
