import { writeFileSync } from 'fs';
import { test, expect } from '@playwright/test';
import { API, call, loginStaff, ownerStaff, Session } from '../api/helpers';

// Monta o cenario do roteiro (docs/teste-e2e-completo.md, secao 0.2) pela API.
// As contas usam o e-mail `<apelido>.<SEED_SUFFIX>@example.com` e a senha QA_PASSWORD.
const SUFFIX = process.env.SEED_SUFFIX;
const PASSWORD = process.env.QA_PASSWORD;
const OUTPUT = process.env.SEED_OUTPUT || 'e2e/.dev-accounts.local.json';

const mail = (nick: string) => `${nick}.${SUFFIX}@example.com`;
const READ = { canRead: true, canCreate: false, canUpdate: false, canDelete: false };
const READ_WRITE = { canRead: true, canCreate: true, canUpdate: true, canDelete: false };

test('monta o cenario do roteiro', async ({ request }) => {
  test.setTimeout(420_000);
  if (!SUFFIX || !PASSWORD) throw new Error('Defina SEED_SUFFIX e QA_PASSWORD');

  const paula = await ownerStaff(request);
  const body = async (r: { json(): Promise<any> }) => r.json();

  // Plataforma: equipe (P-05) e planos (P-07)
  for (const [nick, name, role] of [['sergio', 'Sérgio', 'SUPPORT'], ['fabio', 'Fábio', 'FINANCE'], ['lia', 'Lia', 'READONLY']]) {
    await call(request, 'post', '/platform/staff', paula, {
      expected: [200, 201],
      data: { email: mail(nick), name, role, password: PASSWORD },
    });
  }
  const basic = await body(await call(request, 'post', '/platform/plans', paula, {
    expected: [200, 201],
    data: {
      name: `QA Básico ${SUFFIX}`, slug: `qa-basico-${SUFFIX}`, isActive: true,
      limits: { maxUsers: 8, maxRecords: 60, maxStorageMb: 50 },
      features: { chat: true, pdf: true, automations: true, webhooks: true, publicLinks: true, mobile: true },
    },
  }));
  const minimal = await body(await call(request, 'post', '/platform/plans', paula, {
    expected: [200, 201],
    data: {
      name: `QA Mínimo ${SUFFIX}`, slug: `qa-minimo-${SUFFIX}`, isActive: true,
      limits: { maxUsers: 2, maxRecords: 5 },
      features: { chat: false, pdf: false, automations: true, webhooks: true, publicLinks: false, mobile: true },
    },
  }));

  // QA Console: fluxo assistido (P-08)
  const consoleSlug = `qa-console-${SUFFIX}`;
  const consoleTenant = await body(await call(request, 'post', '/platform/tenants', paula, {
    expected: [200, 201],
    data: {
      name: `QA Console ${SUFFIX}`, slug: consoleSlug, planId: minimal.id, lifecycle: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      adminName: 'Admin Console', adminEmail: mail('consoleadmin'), adminPassword: PASSWORD,
    },
  }));

  // QA Total: cadastro self-service (E-01)
  const registered = await request.post(`${API}/auth/register`, {
    data: { name: 'Dora', tenantName: `QA Total ${SUFFIX}`, email: mail('dora'), password: PASSWORD },
  });
  expect(registered.ok(), await registered.text()).toBeTruthy();
  const reg = await registered.json();
  const tenantId: string = reg.user.tenantId;
  const tenant = await body(await call(request, 'get', `/platform/tenants/${tenantId}`, paula, { expected: 200 }));
  const slug: string = tenant.slug;
  const dora: Session = { token: reg.accessToken, slug, userId: reg.user.id, email: mail('dora') };
  await call(request, 'patch', `/platform/tenants/${tenantId}/plan`, paula, { expected: 200, data: { planId: basic.id } });

  // Tabelas (E-06)
  const visitas = await body(await call(request, 'post', '/entities', dora, {
    expected: [200, 201],
    data: {
      name: 'Visitas', slug: 'visitas', category: 'CRM',
      fields: [{ slug: 'data', name: 'Data', type: 'date' }, { slug: 'resumo', name: 'Resumo', type: 'text' }],
    },
  }));
  const clientes = await body(await call(request, 'post', '/entities', dora, {
    expected: [200, 201],
    data: {
      name: 'Clientes', slug: 'clientes', category: 'CRM',
      fields: [
        { slug: 'nome', name: 'Nome', type: 'text', required: true },
        { slug: 'email', name: 'Email', type: 'email', unique: true },
        { slug: 'telefone', name: 'Telefone', type: 'phone' },
        {
          slug: 'status', name: 'Status', type: 'select',
          options: [{ value: 'novo', label: 'Novo' }, { value: 'contato', label: 'Em contato' }, { value: 'fechado', label: 'Fechado' }],
        },
        { slug: 'vip', name: 'VIP', type: 'boolean' },
        { slug: 'cpf', name: 'CPF', type: 'cpf' },
        { slug: 'visitas', name: 'Visitas', type: 'sub-entity', subEntitySlug: 'visitas', subEntityId: visitas.id },
      ],
    },
  }));

  // Politica de senha (E-05)
  await call(request, 'patch', '/security/policy', dora, { expected: 200, data: { passwordMinLength: 10, passwordRequireSymbol: true } });

  // Cargos (E-07)
  const rolesBody = await body(await call(request, 'get', '/custom-roles?limit=100', dora, { expected: 200 }));
  const roles: Array<{ id: string; name: string; permissions: unknown; modulePermissions: unknown }> = rolesBody.data ?? rolesBody;
  const role = (name: string) => roles.find((r) => r.name === name)!;
  const teamRole = await body(await call(request, 'post', '/custom-roles', dora, {
    expected: [200, 201],
    data: {
      name: 'Equipe campo', rank: 60,
      modulePermissions: { dashboard: READ, data: READ_WRITE, chat: {} },
      permissions: [
        { entitySlug: 'clientes', ...READ_WRITE, scope: 'team' },
        { entitySlug: 'visitas', ...READ_WRITE, scope: 'team' },
      ],
    },
  }));
  await call(request, 'post', '/custom-roles', dora, {
    expected: [200, 201],
    data: {
      name: 'Auditor', rank: 65,
      modulePermissions: { logs: READ },
      permissions: [{ entitySlug: 'clientes', ...READ, scope: 'all' }],
    },
  });
  await call(request, 'patch', `/custom-roles/${role('Operador').id}`, dora, {
    expected: 200,
    data: {
      permissions: [
        {
          entitySlug: 'clientes', ...READ_WRITE, scope: 'own',
          fieldPermissions: [{ fieldSlug: 'cpf', canView: false, canEdit: false }],
          dataFilters: [{ fieldSlug: 'vip', fieldName: 'VIP', fieldType: 'boolean', operator: 'equals', value: false }],
        },
        { entitySlug: '*', ...READ_WRITE, scope: 'own' },
      ],
    },
  });

  // Convites (E-08)
  const people: Record<string, Session> = {};
  const invite = async (nick: string, name: string, customRoleId: string) => {
    const invited = await body(await call(request, 'post', '/invitations', dora, {
      expected: [200, 201],
      data: { email: mail(nick), name, customRoleId },
    }));
    expect(invited.link, 'convite sem link copiavel').toBeTruthy();
    const token = String(invited.link).split('/').pop()!.split('?')[0];
    const accepted = await request.post(`${API}/invitations/public/${token}/accept`, { data: { name, password: PASSWORD } });
    expect(accepted.ok(), await accepted.text()).toBeTruthy();
    const session = await accepted.json();
    people[nick] = { token: session.accessToken, slug, userId: session.user?.id, email: mail(nick) };
    await new Promise((resolve) => setTimeout(resolve, 13_000)); // aceite: 5 por minuto por IP
  };
  await invite('alex', 'Alex', role('Administrador').id);
  await invite('gil', 'Gil', role('Gerente').id);
  await invite('ana', 'Ana', role('Operador').id);
  await invite('bruno', 'Bruno', teamRole.id);
  await invite('carla', 'Carla', teamRole.id);
  await invite('vera', 'Vera', role('Visualizador').id);

  // Equipes (E-10)
  for (const [name, members] of [['Norte', ['ana', 'bruno']], ['Sul', ['carla']]] as const) {
    const team = await body(await call(request, 'post', '/teams', dora, { expected: [200, 201], data: { name } }));
    await call(request, 'put', `/teams/${team.id}/members`, dora, {
      expected: 200,
      data: { members: members.map((nick) => ({ userId: people[nick].userId, isLeader: nick === 'bruno' })) },
    });
  }

  // Um registro por pessoa (X-01)
  const record = async (session: Session, nome: string, withCpf: boolean) => call(request, 'post', '/data/clientes', session, {
    expected: [200, 201],
    data: { data: { nome, email: `${nome.toLowerCase().replace(/\s/g, '.')}.${SUFFIX}@example.com`, status: 'novo', vip: false, ...(withCpf ? { cpf: '529.982.247-25' } : {}) } },
  });
  await record(dora, 'Cliente D', true);
  await record(people.ana, 'Cliente A', false);
  await record(people.bruno, 'Cliente B', false);
  await record(people.carla, 'Cliente C', false);

  // Login de cada staff confere as contas antes de documentar.
  for (const nick of ['sergio', 'fabio', 'lia']) await loginStaff(request, mail(nick), PASSWORD);

  writeFileSync(OUTPUT, JSON.stringify({
    suffix: SUFFIX, slug, consoleSlug, tenantId, consoleTenantId: consoleTenant.id,
    planIds: { basic: basic.id, minimal: minimal.id }, entityIds: { clientes: clientes.id, visitas: visitas.id },
    accounts: Object.fromEntries(['sergio', 'fabio', 'lia', 'consoleadmin', 'dora', 'alex', 'gil', 'ana', 'bruno', 'carla', 'vera'].map((n) => [n, mail(n)])),
    userIds: Object.fromEntries(Object.entries(people).map(([n, s]) => [n, s.userId])),
  }, null, 2));
});
