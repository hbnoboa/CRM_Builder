import { test } from '@playwright/test';
import { call, createTenant, loginStaff, ownerStaff, PASSWORD, Session, suffix, Tenant } from './helpers';

// P-06 direto nas rotas. O corpo vazio nao altera nada: quem pode recebe 400 da validacao,
// quem nao pode recebe 403 do guard, que roda antes.
test.describe.configure({ mode: 'serial' });

const ROLES = ['SUPPORT', 'FINANCE', 'READONLY'] as const;
type Role = 'OWNER' | (typeof ROLES)[number];

const staff: Partial<Record<Role, Session>> = {};
const staffIds: string[] = [];
let tenant: Tenant;

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000);
  staff.OWNER = await ownerStaff(request);
  tenant = await createTenant(request, staff.OWNER);
  for (const role of ROLES) {
    const email = `qa-staff-${role.toLowerCase()}-${suffix()}@example.com`;
    const created = await call(request, 'post', '/platform/staff', staff.OWNER, {
      expected: [200, 201],
      data: { email, name: `QA ${role}`, role, password: PASSWORD },
    });
    staffIds.push((await created.json()).id);
    staff[role] = await loginStaff(request, email, PASSWORD);
  }
});

test.afterAll(async ({ request }) => {
  for (const id of staffIds) await call(request, 'delete', `/platform/staff/${id}`, staff.OWNER!);
});

type Rule = { name: string; method: 'get' | 'post' | 'patch'; path: () => string; allowed: Role[] };
const rules: Rule[] = [
  { name: 'metricas', method: 'get', path: () => '/platform/metrics', allowed: ['OWNER', 'FINANCE', 'READONLY'] },
  { name: 'equipe', method: 'get', path: () => '/platform/staff', allowed: ['OWNER'] },
  { name: 'novo cliente', method: 'post', path: () => '/platform/tenants', allowed: ['OWNER', 'SUPPORT'] },
  { name: 'situacao', method: 'patch', path: () => `/platform/tenants/${tenant.id}/lifecycle`, allowed: ['OWNER', 'FINANCE'] },
  { name: 'plano do cliente', method: 'patch', path: () => `/platform/tenants/${tenant.id}/plan`, allowed: ['OWNER', 'FINANCE'] },
  { name: 'funcoes', method: 'patch', path: () => `/platform/tenants/${tenant.id}/features`, allowed: ['OWNER', 'SUPPORT'] },
  { name: 'novo plano', method: 'post', path: () => '/platform/plans', allowed: ['OWNER', 'FINANCE'] },
  { name: 'novo comunicado', method: 'post', path: () => '/platform/announcements', allowed: ['OWNER', 'SUPPORT'] },
  { name: 'adicionar membro', method: 'post', path: () => `/platform/tenants/${tenant.id}/members`, allowed: ['OWNER', 'SUPPORT'] },
  { name: 'auditoria', method: 'get', path: () => '/platform/audit-logs', allowed: ['OWNER', 'SUPPORT', 'FINANCE', 'READONLY'] },
  { name: 'saude', method: 'get', path: () => '/platform/health', allowed: ['OWNER', 'SUPPORT', 'FINANCE', 'READONLY'] },
];

for (const rule of rules) {
  test(`[P-06] ${rule.name}`, async ({ request }) => {
    for (const role of ['OWNER', ...ROLES] as Role[]) {
      const allowed = rule.allowed.includes(role);
      const okStatuses = rule.method === 'get' ? [200] : [200, 201, 400, 404];
      await call(request, rule.method, rule.path(), staff[role]!, {
        data: rule.method === 'get' ? undefined : {},
        expected: allowed ? okStatuses : 403,
      });
    }
  });
}

// A rota de massa valida o corpo antes de conferir a acao: aqui vai corpo valido, so em previa.
test('[P-06] massa', async ({ request }) => {
  const data = () => ({ action: 'lifecycle', tenantIds: [tenant.id], lifecycle: 'ACTIVE', dryRun: true });
  await call(request, 'post', '/platform/tenants/bulk', staff.OWNER!, { expected: [200, 201], data: data() });
  await call(request, 'post', '/platform/tenants/bulk', staff.FINANCE!, { expected: [200, 201], data: data() });
  await call(request, 'post', '/platform/tenants/bulk', staff.SUPPORT!, { expected: 403, data: data() });
  await call(request, 'post', '/platform/tenants/bulk', staff.READONLY!, { expected: 403, data: data() });
});
