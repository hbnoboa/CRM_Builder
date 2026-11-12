import { test, expect } from '@playwright/test';
import { PASSWORD, call, createRole, createTenant, loginUser, ownerStaff, type Session, type Tenant } from './helpers';

// Portal do cliente: um usuario vinculado a um registro (a empresa cliente) com cargo de
// escopo 'client' ve so esse registro, o que esta dentro dele e o que aponta para ele.
// O que ele cria fica preso ao cliente dele; nada de outro cliente aparece nem muda.

const ids = { a: '', b: '', opA1: '', opA2: '', opB: '', pedA: '', pedB: '', andA: '', andB: '' };

test.describe.serial('portal do cliente', () => {
  let tenant: Tenant;
  let roleId: string;
  let client: Session;
  let clientEmail = '';

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    const o = tenant.owner;
    const post = async (path: string, data: unknown) => (await call(request, 'post', path, o, { expected: [200, 201], data })).json();
    const andamentos = await post('/entities', { name: 'Andamento', slug: 'andamentos', fields: [{ slug: 'texto', name: 'texto', label: 'Texto', type: 'text' }] });
    const oportunidades = await post('/entities', {
      name: 'Oportunidade', slug: 'oportunidades', settings: { titleField: 'titulo' },
      fields: [
        { slug: 'titulo', name: 'titulo', label: 'Título', type: 'text', required: true },
        { slug: 'interno', name: 'interno', label: 'Nota interna', type: 'text' },
        { slug: 'andamentos', name: 'andamentos', label: 'Andamentos', type: 'sub-entity', subEntitySlug: 'andamentos', subEntityId: andamentos.id },
      ],
    });
    const empresas = await post('/entities', {
      name: 'Empresa', slug: 'empresas', settings: { titleField: 'nome' },
      fields: [
        { slug: 'nome', name: 'nome', label: 'Nome', type: 'text', required: true },
        { slug: 'oportunidades', name: 'oportunidades', label: 'Oportunidades', type: 'sub-entity', subEntitySlug: 'oportunidades', subEntityId: oportunidades.id },
      ],
    });
    await post('/entities', {
      name: 'Pedido', slug: 'pedidos', settings: { titleField: 'numero' },
      fields: [
        { slug: 'numero', name: 'numero', label: 'Número', type: 'text', required: true },
        { slug: 'empresa', name: 'empresa', label: 'Empresa', type: 'relation', relatedEntitySlug: 'empresas', relatedEntityId: empresas.id },
      ],
    });
    ids.a = (await post('/data/empresas', { data: { nome: 'Cliente A' } })).id;
    ids.b = (await post('/data/empresas', { data: { nome: 'Cliente B' } })).id;
    ids.opA1 = (await post('/data/oportunidades', { data: { titulo: 'A1', interno: 'margem 40%' }, parentRecordId: ids.a })).id;
    ids.opA2 = (await post('/data/oportunidades', { data: { titulo: 'A2' }, parentRecordId: ids.a })).id;
    ids.opB = (await post('/data/oportunidades', { data: { titulo: 'B1' }, parentRecordId: ids.b })).id;
    ids.andA = (await post('/data/andamentos', { data: { texto: 'neto de A' }, parentRecordId: ids.opA1 })).id;
    ids.andB = (await post('/data/andamentos', { data: { texto: 'neto de B' }, parentRecordId: ids.opB })).id;
    ids.pedA = (await post('/data/pedidos', { data: { numero: 'P-A', empresa: ids.a } })).id;
    ids.pedB = (await post('/data/pedidos', { data: { numero: 'P-B', empresa: ids.b } })).id;

    roleId = await createRole(request, o, {
      name: 'Cliente (portal)',
      permissions: [
        { entitySlug: 'empresas', canRead: true, scope: 'client' },
        { entitySlug: 'oportunidades', canRead: true, canCreate: true, scope: 'client', fieldPermissions: [{ fieldSlug: 'interno', canView: false, canEdit: false }] },
        { entitySlug: 'andamentos', canRead: true, scope: 'client' },
        { entitySlug: 'pedidos', canRead: true, canCreate: true, canUpdate: true, scope: 'client' },
      ],
      modulePermissions: { data: { canRead: true, canCreate: true, canUpdate: true } },
    });
    clientEmail = `qa-portal-${Date.now()}@example.com`;
    const created = await (await call(request, 'post', '/users', o, {
      expected: [200, 201],
      data: { name: 'Contato do A', email: clientEmail, password: PASSWORD, customRoleId: roleId, clientEntitySlug: 'empresas', clientRecordId: ids.a },
    })).json();
    expect(created).toMatchObject({ clientRecordId: ids.a });
    client = await loginUser(request, clientEmail, tenant.slug);
  });

  const names = async (request: Parameters<typeof call>[0], path: string, field: string) =>
    ((await (await call(request, 'get', path, client, { expected: 200 })).json()).data as Array<{ data: Record<string, unknown> }>).map((r) => r.data[field]).sort();

  test('ve so o proprio cadastro, o que esta dentro dele e o que aponta para ele', async ({ request }) => {
    expect(await names(request, '/data/empresas', 'nome')).toEqual(['Cliente A']);
    expect(await names(request, `/data/oportunidades?parentRecordId=${ids.a}`, 'titulo')).toEqual(['A1', 'A2']);
    expect(await names(request, `/data/oportunidades?parentRecordId=${ids.b}`, 'titulo')).toEqual([]);
    expect(await names(request, '/data/oportunidades?includeChildren=true', 'titulo')).toEqual(['A1', 'A2']);
    expect(await names(request, '/data/andamentos?includeChildren=true', 'texto')).toEqual(['neto de A']);
    expect(await names(request, '/data/pedidos', 'numero')).toEqual(['P-A']);
    // Campo oculto do cargo nao vem
    const a1 = await (await call(request, 'get', `/data/oportunidades/${ids.opA1}`, client, { expected: 200 })).json();
    expect(a1.data.interno).toBeUndefined();
  });

  test('menu conta so o que e dele; exportar e mexer nos cargos fica fechado', async ({ request }) => {
    const grouped = await (await call(request, 'get', '/entities/grouped', client, { expected: 200 })).json() as Array<{ entities: Array<{ slug: string; _count: { data: number } }> }>;
    const bySlug = new Map(grouped.flatMap((g) => g.entities).map((e) => [e.slug, e._count.data]));
    expect(bySlug.get('empresas')).toBe(1);
    expect(bySlug.get('pedidos')).toBe(1);
    await call(request, 'get', '/data/empresas/export', client, { expected: 403 });
    // O que e da equipe nao abre no portal
    await call(request, 'get', '/chat/channels', client, { expected: 403 });
    await call(request, 'get', '/support/tickets', client, { expected: 403 });
    expect(await (await call(request, 'get', '/team-directory', client, { expected: 200 })).json()).toEqual([]);
    const me = await (await call(request, 'get', '/auth/me', client, { expected: 200 })).json();
    expect(me.clientPortal).toBe(true);
    const ownerMe = await (await call(request, 'get', '/auth/me', tenant.owner, { expected: 200 })).json();
    expect(ownerMe.clientPortal).toBe(false);
    await call(request, 'get', '/custom-roles', client, { expected: 403 });
  });

  test('registro de outro cliente: nada abre, nada muda', async ({ request }) => {
    await call(request, 'get', `/data/empresas/${ids.b}`, client, { expected: [403, 404] });
    await call(request, 'get', `/data/oportunidades/${ids.opB}`, client, { expected: [403, 404] });
    await call(request, 'get', `/data/andamentos/${ids.andB}`, client, { expected: [403, 404] });
    await call(request, 'get', `/data/pedidos/${ids.pedB}`, client, { expected: [403, 404] });
    await call(request, 'patch', `/data/pedidos/${ids.pedB}`, client, { expected: [403, 404], data: { data: { numero: 'invadido' } } });
    const b = await (await call(request, 'get', `/data/pedidos/${ids.pedB}`, tenant.owner, { expected: 200 })).json();
    expect(b.data.numero).toBe('P-B');
  });

  test('o que cria fica preso ao cliente dele', async ({ request }) => {
    // Sem pai: entra dentro do cadastro dele
    const op = await (await call(request, 'post', '/data/oportunidades', client, { expected: [200, 201], data: { data: { titulo: 'Novo pedido' } } })).json();
    expect(op.parentRecordId).toBe(ids.a);
    // Pai de outro cliente: recusado
    await call(request, 'post', '/data/oportunidades', client, { expected: 403, data: { data: { titulo: 'X' }, parentRecordId: ids.b } });
    // Relacao apontando para outro cliente: vira a dele
    const ped = await (await call(request, 'post', '/data/pedidos', client, { expected: [200, 201], data: { data: { numero: 'P-novo', empresa: ids.b } } })).json();
    expect(ped.data.empresa).toBe(ids.a);
    // Editar o proprio pedido trocando a empresa: continua a dele
    await call(request, 'patch', `/data/pedidos/${ped.id}`, client, { expected: 200, data: { data: { empresa: ids.b } } });
    const again = await (await call(request, 'get', `/data/pedidos/${ped.id}`, tenant.owner, { expected: 200 })).json();
    expect(again.data.empresa).toBe(ids.a);
    // Outro cadastro de cliente: nao
    await call(request, 'post', '/data/empresas', client, { expected: 403, data: { data: { nome: 'Cliente C' } } });
  });

  test('quem tem o cargo de portal mas nao tem vinculo nao ve nada', async ({ request }) => {
    const email = `qa-portal-solto-${Date.now()}@example.com`;
    await call(request, 'post', '/users', tenant.owner, { expected: [200, 201], data: { name: 'Sem vinculo', email, password: PASSWORD, customRoleId: roleId } });
    const loose = await loginUser(request, email, tenant.slug);
    const list = await (await call(request, 'get', '/data/empresas', loose, { expected: 200 })).json();
    expect(list.data).toEqual([]);
    const peds = await (await call(request, 'get', '/data/pedidos', loose, { expected: 200 })).json();
    expect(peds.data).toEqual([]);
  });

  test('equipe ve quem tem acesso ao cliente; vinculo invalido e escopo desconhecido sao recusados', async ({ request }) => {
    const users = await (await call(request, 'get', `/users?clientRecordId=${ids.a}`, tenant.owner, { expected: 200 })).json();
    expect(users.data.map((u: { email: string }) => u.email)).toEqual([clientEmail]);
    await call(request, 'post', '/users', tenant.owner, {
      expected: 400,
      data: { name: 'X', email: `qa-x-${Date.now()}@example.com`, password: PASSWORD, customRoleId: roleId, clientEntitySlug: 'pedidos', clientRecordId: ids.a },
    });
    await call(request, 'post', '/custom-roles', tenant.owner, {
      expected: 400, data: { name: 'Escopo estranho', permissions: [{ entitySlug: 'empresas', canRead: true, scope: 'qualquer' }] },
    });
  });
});
