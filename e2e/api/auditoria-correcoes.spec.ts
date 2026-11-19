import { test, expect } from '@playwright/test';
import { API, PASSWORD, call, createPerson, createRole, createTenant, listRoles, ownerStaff, Session, Tenant } from './helpers';

// Correcoes da auditoria de 18/11/2026: campo oculto de outra geracao e na busca,
// extensao dos anexos, limite do bot, cargo do cliente do portal e e-mail das empresas-modelo.
test.describe.configure({ mode: 'serial' });

let tenant: Tenant;
let inspetor: Session;
const ids: Record<string, string> = {};

const list = async (request: Parameters<typeof call>[0], session: Session, ent: string, query: string) =>
  (await (await call(request, 'get', `/data/${ent}?includeChildren=true&limit=100&${query}`, session, { expected: 200 })).json()).meta.total as number;
const filtro = (fieldSlug: string, value: string) =>
  encodeURIComponent(JSON.stringify([{ fieldSlug, operator: 'equals', value, fieldType: 'text' }]));

test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  tenant = await createTenant(request, await ownerStaff(request));
  const post = async (path: string, data: unknown) => (await call(request, 'post', path, tenant.owner, { expected: [200, 201], data })).json();

  // ops -> carros -> danos; o inspetor nao ve ops.codigo nem danos.custo
  const danos = await post('/entities', { name: 'Danos', slug: 'danos', fields: [
    { slug: 'peca', name: 'peca', label: 'Peca', type: 'text' },
    { slug: 'custo', name: 'custo', label: 'Custo', type: 'text' },
  ] });
  const carros = await post('/entities', { name: 'Carros', slug: 'carros', fields: [
    { slug: 'chassi', name: 'chassi', label: 'Chassi', type: 'text' },
    { slug: 'danos', name: 'danos', label: 'Danos', type: 'sub-entity', subEntitySlug: 'danos', subEntityId: danos.id },
  ] });
  await post('/entities', {
    name: 'Ops', slug: 'ops',
    settings: { searchFields: ['codigo'] },
    fields: [
      { slug: 'navio', name: 'navio', label: 'Navio', type: 'text' },
      { slug: 'codigo', name: 'codigo', label: 'Codigo', type: 'text' },
      { slug: 'carros', name: 'carros', label: 'Carros', type: 'sub-entity', subEntitySlug: 'carros', subEntityId: carros.id },
    ],
  });
  ids.op = (await post('/data/ops', { data: { navio: 'Alfa', codigo: 'X1' } })).id;
  ids.carro = (await post('/data/carros', { data: { chassi: 'c1' }, parentRecordId: ids.op })).id;
  ids.dano = (await post('/data/danos', { data: { peca: 'porta', custo: '100' }, parentRecordId: ids.carro })).id;

  const read = { canRead: true, canCreate: false, canUpdate: false, canDelete: false, scope: 'all' };
  const role = await createRole(request, tenant.owner, {
    name: 'QA Inspetor',
    modulePermissions: { data: { canRead: true } },
    permissions: [
      { entitySlug: 'ops', ...read, fieldPermissions: [{ fieldSlug: 'codigo', canView: false, canEdit: false }] },
      { entitySlug: 'carros', ...read },
      { entitySlug: 'danos', ...read, fieldPermissions: [{ fieldSlug: 'custo', canView: false, canEdit: false }] },
    ],
  });
  inspetor = await createPerson(request, tenant.owner, tenant.slug, 'Inspetor', role);
});

test('filtro por campo oculto de outra geracao nao traz nada (filho e avo)', async ({ request }) => {
  // Neto oculto filtrando o avo: child.danos.custo
  expect(await list(request, tenant.owner, 'ops', `dashboardFilters=${filtro('child.danos.custo', '100')}`)).toBe(1);
  expect(await list(request, inspetor, 'ops', `dashboardFilters=${filtro('child.danos.custo', '100')}`)).toBe(0);
  expect(await list(request, inspetor, 'ops', `filters=${filtro('child.danos.custo', '100')}`)).toBe(0);
  // Avo oculto filtrando o neto: parent.parent.codigo
  expect(await list(request, tenant.owner, 'danos', `dashboardFilters=${filtro('parent.parent.codigo', 'X1')}`)).toBe(1);
  expect(await list(request, inspetor, 'danos', `dashboardFilters=${filtro('parent.parent.codigo', 'X1')}`)).toBe(0);
  // Controle: campo visivel de outra geracao continua filtrando
  expect(await list(request, inspetor, 'danos', `dashboardFilters=${filtro('parent.parent.navio', 'Alfa')}`)).toBe(1);
});

test('estatistica com filtro por campo oculto de outra geracao responde vazio', async ({ request }) => {
  const get = async (session: Session) => (await call(request, 'get',
    `/stats/entity/ops/field-distribution?fieldSlug=navio&filters=${filtro('child.danos.custo', '100')}`, session, { expected: 200 })).json();
  expect((await get(tenant.owner)).length).toBeGreaterThan(0);
  expect(await get(inspetor)).toEqual([]);
});

test('busca nao procura em campo oculto', async ({ request }) => {
  expect(await list(request, tenant.owner, 'ops', 'search=X1')).toBe(1);
  expect(await list(request, inspetor, 'ops', 'search=X1')).toBe(0);
});

test('anexo grava a extensao do tipo aceito e e entregue sem rodar script', async ({ request }) => {
  const channelId = (await (await call(request, 'post', '/chat/channels/group/ops', tenant.owner, { expected: [200, 201] })).json()).id;
  const res = await request.post(`${API}/chat/channels/${channelId}/attachments`, {
    headers: { Authorization: `Bearer ${tenant.owner.token}`, 'X-Tenant-Slug': tenant.slug },
    multipart: { file: { name: 'pagina.html', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') } },
  });
  expect(res.ok()).toBeTruthy();
  const sent = await res.json();
  expect(sent.meta.attachments[0].key).toMatch(/\.png$/);
  const file = await call(request, 'get', `/chat/channels/${channelId}/messages/${sent.id}/file`, tenant.owner, { expected: 200 });
  expect(file.headers()['content-security-policy']).toContain('sandbox');
  expect(file.headers()['x-content-type-options']).toBe('nosniff');
});

test('arquivamento antigo nao abre por endereco publico', async ({ request }) => {
  const res = await request.get(`${API.replace(/\/api\/v1$/, '')}/uploads/${tenant.id}/archives/entity-data/ops-2026-10.json`);
  expect(res.status()).toBe(404);
});

test('pergunta ao bot tem tamanho maximo', async ({ request }) => {
  const channelId = (await (await call(request, 'post', '/chat/channels/group/ops', tenant.owner, { expected: [200, 201] })).json()).id;
  await call(request, 'post', `/chat/channels/${channelId}/bot`, tenant.owner, { expected: 400, data: { message: 'a'.repeat(4001) } });
});

test('cliente do portal nao recebe cargo de acesso total', async ({ request }) => {
  const admin = (await listRoles(request, tenant.owner)).find((r) => r.name === 'Administrador')!.id;
  const res = await call(request, 'post', '/users', tenant.owner, {
    expected: 400,
    data: { name: 'Cliente', email: `qa-cli-${Date.now()}@example.com`, password: PASSWORD, customRoleId: admin, clientEntitySlug: 'ops', clientRecordId: ids.op },
  });
  expect(await res.text()).toContain('acesso total');
});

test('cadastro publico recusa o e-mail das empresas-modelo', async ({ request }) => {
  const res = await request.post(`${API}/auth/register`, {
    data: { name: 'Modelo', email: 'modelos+vistoria-veicular@iossystem.com.br', password: PASSWORD, tenantName: 'Modelo falso' },
  });
  expect(res.status()).toBe(400);
});

test('PDF gerado fica privado e o historico baixa pela API', async ({ request }) => {
  const opsId = (await (await call(request, 'get', '/entities/slug/ops', tenant.owner, { expected: 200 })).json()).id;
  const template = await (await call(request, 'post', '/pdf-templates', tenant.owner, {
    expected: [200, 201],
    data: { name: 'QA Ops', slug: `qa-ops-${Date.now()}`, sourceEntityId: opsId, content: { body: [{ id: 't', type: 'text', content: 'Navio {{navio}}' }] } },
  })).json();
  await call(request, 'post', `/pdf-templates/${template.id}/generate`, tenant.owner, { expected: [200, 201], data: { recordId: ids.op } });
  const list = await (await call(request, 'get', `/pdf-templates/generations?templateId=${template.id}`, tenant.owner, { expected: 200 })).json();
  const generation = (list.data ?? list)[0];
  expect(generation.fileUrl).toMatch(/^private:/);
  const pdf = await call(request, 'get', `/pdf-templates/generations/${generation.id}/download`, tenant.owner, { expected: 200 });
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect(Buffer.from(await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
});
