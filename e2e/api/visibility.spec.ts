import { test, expect } from '@playwright/test';
import {
  call, createClientsTable, createPerson, createRecord, createRole, createTenant, listRoles, loginUser, ownerStaff,
  Session, Tenant, visibleNames,
} from './helpers';

// X-01 e X-05: quem ve o que, em todas as superficies que devolvem registros.
test.describe.configure({ mode: 'serial' });

const READ_WRITE = { canRead: true, canCreate: true, canUpdate: true, canDelete: false };
const DATA_MODULE = { data: { canRead: true, canCreate: true, canUpdate: true, canDelete: false } };

let tenant: Tenant;
let ana: Session; let bruno: Session; let carla: Session; let vera: Session;
const ids: Record<string, string> = {};
let entityId: string;

test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  const staff = await ownerStaff(request);
  tenant = await createTenant(request, staff);
  entityId = await createClientsTable(request, tenant.owner);
  const roles = await listRoles(request, tenant.owner);
  const viewerId = roles.find((r) => r.name === 'Visualizador')!.id;

  const ownRole = await createRole(request, tenant.owner, {
    name: 'QA Proprios',
    modulePermissions: { ...DATA_MODULE, templates: { canRead: true, canGenerate: true } },
    permissions: [{
      entitySlug: 'clientes', ...READ_WRITE, scope: 'own',
      fieldPermissions: [{ fieldSlug: 'cpf', canView: false, canEdit: false }],
      dataFilters: [{ fieldSlug: 'vip', fieldName: 'VIP', fieldType: 'text', operator: 'equals', value: 'nao' }],
    }],
  });
  const teamRole = await createRole(request, tenant.owner, {
    name: 'QA Equipe',
    modulePermissions: DATA_MODULE,
    permissions: [{ entitySlug: 'clientes', ...READ_WRITE, scope: 'team' }],
  });

  ana = await createPerson(request, tenant.owner, tenant.slug, 'Ana', ownRole);
  bruno = await createPerson(request, tenant.owner, tenant.slug, 'Bruno', teamRole);
  carla = await createPerson(request, tenant.owner, tenant.slug, 'Carla', teamRole);
  vera = await createPerson(request, tenant.owner, tenant.slug, 'Vera', viewerId);

  for (const [name, members] of [['Norte', [ana, bruno]], ['Sul', [carla]]] as const) {
    const team = await (await call(request, 'post', '/teams', tenant.owner, { expected: [200, 201], data: { name } })).json();
    await call(request, 'put', `/teams/${team.id}/members`, tenant.owner, {
      expected: 200,
      data: { members: members.map((m) => ({ userId: m.userId })) },
    });
  }

  ids.D = await createRecord(request, tenant.owner, 'D');
  // Ana nao edita o CPF: cria sem ele.
  ids.A = await createRecord(request, ana, 'A', 'nao', false);
  ids.B = await createRecord(request, bruno, 'B');
  ids.C = await createRecord(request, carla, 'C');
  ids.A3 = await createRecord(request, ana, 'A3', 'sim', false);
});

test('[X-01] matriz de quem ve o que na lista', async ({ request }) => {
  expect(await visibleNames(request, tenant.owner)).toEqual(['A', 'A3', 'B', 'C', 'D']);
  expect(await visibleNames(request, vera)).toEqual(['A', 'A3', 'B', 'C', 'D']);
  expect(await visibleNames(request, ana)).toEqual(['A']);
  expect(await visibleNames(request, bruno)).toEqual(['A', 'A3', 'B']);
  expect(await visibleNames(request, carla)).toEqual(['C']);
});

test('[X-01] leitura e edicao por ID fora do escopo', async ({ request }) => {
  await call(request, 'get', `/data/clientes/${ids.D}`, ana, { expected: [403, 404] });
  await call(request, 'get', `/data/clientes/${ids.C}`, bruno, { expected: [403, 404] });
  await call(request, 'patch', `/data/clientes/${ids.C}`, bruno, { expected: [403, 404], data: { data: { nome: 'X' } } });
  await call(request, 'get', `/data/clientes/${ids.A}`, bruno, { expected: 200 });
});

test('[X-01] arquivados seguem o escopo', async ({ request }) => {
  const body = await (await call(request, 'get', '/data/clientes/archived', ana, { expected: 200 })).json();
  for (const record of body.data) expect(record.createdById).toBe(ana.userId);
});

test('[X-01] PDF por ID segue o escopo', async ({ request }) => {
  const template = await (await call(request, 'post', '/pdf-templates', tenant.owner, {
    expected: [200, 201],
    data: { name: 'QA Ficha', slug: 'qa-ficha', sourceEntityId: entityId },
  })).json();
  await call(request, 'post', `/pdf-templates/${template.id}/generate`, ana, { expected: 404, data: { recordId: ids.D } });
  const batch = await call(request, 'post', `/pdf-templates/${template.id}/generate-batch`, ana, { data: { recordIds: [ids.D, ids.C] } });
  expect(batch.ok()).toBeFalsy();
});

test('[X-01] sugestoes do chat seguem escopo e campos', async ({ request }) => {
  const nomes = await (await call(request, 'get', '/chat/field-suggestions?entitySlug=clientes&field=nome&q=cpf', tenant.owner, { expected: 200 })).json();
  expect(Array.isArray(nomes)).toBeTruthy();
  const own = await (await call(request, 'get', '/chat/field-suggestions?entitySlug=clientes&field=cpf&q=cpf-', ana, { expected: [200, 403] })).json();
  if (Array.isArray(own)) expect(own).toEqual([]);
  const team = await (await call(request, 'get', '/chat/field-suggestions?entitySlug=clientes&field=cpf&q=cpf-', bruno, { expected: [200, 403] })).json();
  if (Array.isArray(team)) expect(team).not.toContain('cpf-C');
});

test('[E-07/7] negar um campo esconde so ele', async ({ request }) => {
  const body = await (await call(request, 'get', '/data/clientes', ana, { expected: 200 })).json();
  expect(body.data[0].data.nome).toBe('A');
  expect(body.data[0].data).not.toHaveProperty('cpf');

  const updated = await (await call(request, 'patch', `/data/clientes/${ids.A}`, ana, { expected: 200, data: { data: { nome: 'A' } } })).json();
  expect(updated.data).not.toHaveProperty('cpf');
  await call(request, 'patch', `/data/clientes/${ids.A}`, ana, { expected: 403, data: { data: { cpf: 'novo' } } });
});

test('[X-05] filtro de dados vale na leitura por ID', async ({ request }) => {
  await call(request, 'get', `/data/clientes/${ids.A3}`, ana, { expected: [403, 404] });
});

test('[O-09/8] Gerente padrao exporta pelo coringa', async ({ request }) => {
  const roles = await listRoles(request, tenant.owner);
  const gil = await createPerson(request, tenant.owner, tenant.slug, 'Gil', roles.find((r) => r.name === 'Gerente')!.id);
  await call(request, 'get', '/data/clientes/export?format=json', gil, { expected: 200 });
  await call(request, 'get', '/data/clientes/export?format=json', vera, { expected: 403 });
});

test('[O-17] cargo vem da empresa ativa', async ({ request }) => {
  const staff = await ownerStaff(request);
  const other = await createTenant(request, staff);
  const roles = await listRoles(request, tenant.owner);
  await call(request, 'post', `/platform/tenants/${tenant.id}/members`, staff, {
    expected: [200, 201],
    data: { email: other.ownerEmail, customRoleId: roles.find((r) => r.name === 'Operador')!.id },
  });
  const session = await loginUser(request, other.ownerEmail, tenant.slug);
  expect(await visibleNames(request, session)).toEqual([]);
});

test('[P-10] adicionar membro nao muda cargo de quem ja e membro', async ({ request }) => {
  const staff = await ownerStaff(request);
  const roles = await listRoles(request, tenant.owner);
  await call(request, 'post', `/platform/tenants/${tenant.id}/members`, staff, {
    expected: 409,
    data: { email: tenant.ownerEmail, customRoleId: roles.find((r) => r.name === 'Operador')!.id },
  });
});

test('[POST idempotente] reenviar o mesmo id nao duplica', async ({ request }) => {
  const id = `qa-${Date.now()}`;
  const data = { id, data: { nome: 'Offline', vip: 'nao' } };
  await call(request, 'post', '/data/clientes', bruno, { expected: [200, 201], data });
  await call(request, 'post', '/data/clientes', bruno, { expected: [200, 201], data });
  const names = await visibleNames(request, bruno);
  expect(names.filter((n) => n === 'Offline')).toHaveLength(1);
  await call(request, 'post', '/data/clientes', carla, { expected: 409, data });
});

test('[E-16] run_script nao pode ser criado', async ({ request }) => {
  await call(request, 'post', `/entities/${entityId}/automations`, tenant.owner, {
    expected: 400,
    data: { name: 'QA script', trigger: 'MANUAL', actions: [{ type: 'run_script', order: 0, config: { code: 'return 1' } }] },
  });
});

test('[X-05] estatisticas do painel nao mostram nem deixam deduzir campo oculto', async ({ request }) => {
  const get = async (session: Session, path: string) =>
    (await call(request, 'get', `/stats/entity/clientes/${path}`, session, { expected: 200 })).json();
  const cpfIgual = encodeURIComponent(JSON.stringify([{ fieldSlug: 'cpf', operator: 'equals', value: 'cpf-A', fieldType: 'text' }]));

  // Controle: o dono ve o CPF nos graficos; a Ana agrupa por nome normalmente
  expect((await get(tenant.owner, 'field-distribution?fieldSlug=cpf')).length).toBeGreaterThan(0);
  expect((await get(ana, 'field-distribution?fieldSlug=nome')).length).toBeGreaterThan(0);

  // Ana (CPF oculto): agrupar, cruzar, contar distintos, agregar ou ordenar pelo CPF responde vazio
  expect(await get(ana, 'field-distribution?fieldSlug=cpf')).toEqual([]);
  expect((await get(ana, 'cross-field-distribution?rowField=nome&columnField=cpf')).rows ?? []).toEqual([]);
  expect((await get(ana, 'distinct-count?fields=cpf')).count ?? 0).toBe(0);
  expect(await get(ana, `grouped-data?groupBy=cpf&aggregations=${encodeURIComponent(JSON.stringify([{ type: 'count', alias: 'n' }]))}`)).toEqual([]);
  expect(await get(ana, 'top-records?fields=nome,cpf')).toEqual([]);
  // ...nem filtrar pelo CPF para descobrir o valor
  expect(await get(ana, `field-distribution?fieldSlug=nome&filters=${cpfIgual}`)).toEqual([]);

  // Listas de registros saem sem o campo oculto
  for (const path of ['top-records?limit=10', 'recent-activity?limit=10']) {
    const rows = await get(ana, path);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.data ?? {}).not.toHaveProperty('cpf');
  }
});
