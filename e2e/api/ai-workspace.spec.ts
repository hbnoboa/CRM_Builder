import { test, expect } from '@playwright/test';
import { call, createClientsTable, createPerson, createRole, ownerStaff, createTenant, type Session, type Tenant } from './helpers';

type Field = { slug: string; label?: string; name?: string; type: string; options?: Array<{ value: string; label: string }>; subEntitySlug?: string; subEntityId?: string };
type EntityBody = { id: string; slug: string; name: string; fields: Field[]; settings: Record<string, unknown> };
type Change = { module: string; kind: string; key: string; name: string; details: string[]; removals?: string[] };

const draft = (tables: unknown[], extra: Record<string, unknown> = {}) => ({ reply: '', tables, dashboards: [], pdfs: [], ...extra });

/**
 * Construtor da tela inicial sem IA (preview/apply valem para qualquer provedor):
 * mudar o que existe, criar junto, excluir so confirmando e com permissao, historico.
 */
test.describe.serial('construtor da tela inicial', () => {
  let tenant: Tenant;
  let clientesId: string;
  // A leitura acrescenta as datas do sistema (createdAt/updatedAt); aqui so os campos da tabela
  const get = async (request: Parameters<typeof call>[0], session: Session, id: string) => {
    const body = (await (await call(request, 'get', `/entities/${id}`, session, { expected: 200 })).json()) as EntityBody;
    return { ...body, fields: body.fields.filter((f) => f.slug !== 'createdAt' && f.slug !== 'updatedAt') };
  };

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    clientesId = await createClientsTable(request, tenant.owner);
  });

  test('o que existe vem no formato do rascunho', async ({ request }) => {
    const res = await call(request, 'get', '/ai-builder/workspace', tenant.owner, { expected: 200 });
    const body = await res.json();
    const clientes = body.tables.find((t: { key: string }) => t.key === 'clientes');
    expect(clientes.existing).toBe(true);
    expect(clientes.fields.map((f: { key: string }) => f.key)).toEqual(['nome', 'vip', 'cpf']);
  });

  test('rascunho mexe no que existe e cria junto; tirar campo pede confirmacao', async ({ request }) => {
    const proposal = draft([
      // So o que muda: VIP renomeado, campo novo e CPF excluido; Nome fica (nao foi citado)
      { key: 'clientes', existing: true, name: 'Clientes', namePlural: 'Clientes', fields: [
        { key: 'vip', label: 'Cliente especial', type: 'text' },
        { key: 'tipo', label: 'Tipo', type: 'select', options: [{ label: 'Ouro', color: 'amber' }, { label: 'Prata' }] },
        { key: 'cpf', label: 'CPF', type: 'text', removed: true },
      ] },
      { key: 'visitas', name: 'Visita', namePlural: 'Visitas', description: 'Visitas ao cliente', parentKey: 'clientes',
        fields: [{ key: 'data', label: 'Data', type: 'date', required: true }, { key: 'relato', label: 'Relato', type: 'textarea' }] },
    ]);
    const preview = await (await call(request, 'post', '/ai-builder/workspace/preview', tenant.owner, { expected: 200, data: { proposal } })).json();
    const changes = preview.changes as Change[];
    expect(changes.map((c) => `${c.kind}:${c.module}:${c.key}`).sort()).toEqual(['create:table:visitas', 'update:table:clientes']);
    const upd = changes.find((c) => c.key === 'clientes')!;
    expect(upd.removals).toEqual(['campo "CPF"']);
    expect(upd.details.join(' ')).toMatch(/lista nova: Visitas/);
    expect(preview.marks.tables.clientes.fields).toMatchObject({ vip: 'changed', tipo: 'new', cpf: 'removed' });

    await call(request, 'post', '/ai-builder/workspace/apply', tenant.owner, { expected: 400, data: { proposal } });
    const applied = await (await call(request, 'post', '/ai-builder/workspace/apply', tenant.owner, {
      expected: 200, data: { proposal, confirmRemovals: true, conversation: ['Renomeie VIP, ponha o tipo, tire o CPF e crie visitas'] },
    })).json();
    expect(applied.failed).toBeNull();
    expect(applied.applied).toHaveLength(2);

    const clientes = await get(request, tenant.owner, clientesId);
    expect(clientes.fields.map((f) => f.slug)).toEqual(['nome', 'vip', 'tipo', 'visitas']);
    expect(clientes.fields.find((f) => f.slug === 'vip')!.label).toBe('Cliente especial');
    const sub = clientes.fields.find((f) => f.slug === 'visitas')!;
    expect(sub.type).toBe('sub-entity');
    expect(sub.subEntityId).toBeTruthy();
  });

  test('opcao renomeada guarda o valor gravado', async ({ request }) => {
    const before = (await get(request, tenant.owner, clientesId)).fields.find((f) => f.slug === 'tipo')!.options!;
    const ouro = before.find((o) => o.label === 'Ouro')!;
    const proposal = draft([{ key: 'clientes', existing: true, name: 'Clientes', namePlural: 'Clientes', fields: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: [{ label: 'Diamante', value: ouro.value }, { label: 'Prata' }] },
    ] }]);
    await call(request, 'post', '/ai-builder/workspace/apply', tenant.owner, { expected: 200, data: { proposal } });
    const after = (await get(request, tenant.owner, clientesId)).fields.find((f) => f.slug === 'tipo')!.options!;
    expect(after.find((o) => o.label === 'Diamante')!.value).toBe(ouro.value);
  });

  test('sem permissao de excluir nao exclui; sem cargo de montar nao entra', async ({ request }) => {
    const editorRole = await createRole(request, tenant.owner, {
      name: `Monta sem excluir ${Date.now()}`,
      permissions: [{ entitySlug: '*', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'all' }],
      modulePermissions: { entities: { canRead: true, canCreate: true, canUpdate: true, canDelete: false } },
    });
    const editor = await createPerson(request, tenant.owner, tenant.slug, 'Editor', editorRole);
    const removal = draft([{ key: 'clientes', existing: true, removed: true, name: 'Clientes', namePlural: 'Clientes', fields: [] }]);
    const denied = await call(request, 'post', '/ai-builder/workspace/apply', editor, { expected: 403, data: { proposal: removal, confirmRemovals: true } });
    expect((await denied.json()).message).toMatch(/excluir tabelas/);
    // Mudanca sem exclusao passa
    await call(request, 'post', '/ai-builder/workspace/apply', editor, {
      expected: 200,
      data: { proposal: draft([{ key: 'clientes', existing: true, name: 'Clientes', namePlural: 'Clientes', fields: [{ key: 'nome', label: 'Nome completo', type: 'text' }] }]) },
    });

    const viewerRole = await createRole(request, tenant.owner, {
      name: `So registros ${Date.now()}`,
      permissions: [{ entitySlug: '*', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'all' }],
      modulePermissions: {},
    });
    const viewer = await createPerson(request, tenant.owner, tenant.slug, 'Operador', viewerRole);
    await call(request, 'get', '/ai-builder/workspace', viewer, { expected: 403 });
    await call(request, 'post', '/ai-builder/workspace/preview', viewer, { expected: 403, data: { proposal: removal } });
  });

  test('cargo novo e regra de campo; quem nao mexe em cargos nao cria', async ({ request }) => {
    const proposal = {
      ...draft([{ key: 'clientes', existing: true, name: 'Clientes', namePlural: 'Clientes', fields: [
        // Regra pelo nome da opcao: grava o valor dela
        { key: 'nome', label: 'Nome completo', type: 'text', readOnlyIf: { field: 'tipo', operator: 'equals', value: 'Prata' } },
      ] }]),
      roles: [{ key: 'cargo-novo-1', name: 'Atendente QA', modules: { dashboard: 'read', data: 'edit' }, tables: [
        { table: 'clientes', read: true, update: true, readonlyFields: ['Cliente especial'], filters: [{ field: 'tipo', operator: 'equals', value: 'Prata' }] },
      ] }],
    };
    const preview = await (await call(request, 'post', '/ai-builder/workspace/preview', tenant.owner, { expected: 200, data: { proposal } })).json();
    expect((preview.changes as Change[]).map((c) => `${c.kind}:${c.module}`).sort()).toEqual(['create:role', 'update:table']);
    await call(request, 'post', '/ai-builder/workspace/apply', tenant.owner, { expected: 200, data: { proposal } });

    const nome = (await get(request, tenant.owner, clientesId)).fields.find((f) => f.slug === 'nome') as Field & { readOnlyIf?: { field: string; value: string } };
    const prata = (await get(request, tenant.owner, clientesId)).fields.find((f) => f.slug === 'tipo')!.options!.find((o) => o.label === 'Prata')!;
    expect(nome.readOnlyIf).toMatchObject({ field: 'tipo', value: prata.value });
    const state = await (await call(request, 'get', '/ai-builder/workspace', tenant.owner, { expected: 200 })).json();
    const role = state.roles.find((r: { name: string }) => r.name === 'Atendente QA');
    expect(role.modules).toMatchObject({ dashboard: 'read', data: 'edit', users: 'none' });
    expect(role.tables[0]).toMatchObject({ table: 'clientes', read: true, update: true, create: false, readonlyFields: ['vip'] });
    expect(role.tables[0].filters[0]).toMatchObject({ field: 'tipo', operator: 'equals', value: prata.value });

    // Quem monta tabelas mas nao mexe em cargos nao cria cargo
    const builderRole = await createRole(request, tenant.owner, {
      name: `Monta tabelas ${Date.now()}`,
      permissions: [{ entitySlug: '*', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'all' }],
      modulePermissions: { entities: { canRead: true, canCreate: true, canUpdate: true, canDelete: false } },
    });
    const builder = await createPerson(request, tenant.owner, tenant.slug, 'Montador', builderRole);
    const denied = await call(request, 'post', '/ai-builder/workspace/apply', builder, {
      expected: 403, data: { proposal: { ...draft([]), roles: [{ key: 'cargo-novo-1', name: 'Outro', modules: { data: 'read' } }] } },
    });
    expect((await denied.json()).message).toMatch(/criar cargos/);
  });

  test('automacao: cria pelo nome da pessoa, muda mantendo o resto e exclui confirmando', async ({ request }) => {
    const proposal = {
      ...draft([]),
      automations: [{
        key: 'automacao-nova-1', name: 'Avisar cliente Prata', table: 'clientes',
        when: { event: 'field_changed', field: 'Tipo', to: 'Prata' },
        conditions: [{ field: 'nome', operator: 'is_not_empty' }],
        actions: [
          { type: 'notify', person: 'dono qa', title: 'Cliente Prata', message: '{{record.nome}} virou Prata' },
          { type: 'set_field', field: 'vip', value: 'sim' },
          { type: 'webhook', url: 'http://sem-https.example.com' },
        ],
      }],
    };
    const preview = await (await call(request, 'post', '/ai-builder/workspace/preview', tenant.owner, { expected: 200, data: { proposal } })).json();
    expect(preview.changes[0]).toMatchObject({ module: 'automation', kind: 'create' });
    expect(preview.warnings.join(' ')).toMatch(/https/);
    await call(request, 'post', '/ai-builder/workspace/apply', tenant.owner, { expected: 200, data: { proposal } });

    const state = await (await call(request, 'get', '/ai-builder/workspace', tenant.owner, { expected: 200 })).json();
    const auto = state.automations.find((a: { name: string }) => a.name === 'Avisar cliente Prata');
    const prata = (await get(request, tenant.owner, clientesId)).fields.find((f) => f.slug === 'tipo')!.options!.find((o) => o.label === 'Prata')!;
    expect(auto.when).toEqual({ event: 'field_changed', field: 'tipo', to: prata.value });
    expect(auto.actions.map((a: { type: string }) => a.type)).toEqual(['notify', 'set_field']);
    expect(auto.actions[0].person).toBe(tenant.owner.userId);

    // Muda so o titulo do aviso: o resto (condicao, segunda acao) fica
    const changed = { ...auto, actions: [{ ...auto.actions[0], title: 'Cliente virou Prata' }, auto.actions[1]] };
    const p2 = await (await call(request, 'post', '/ai-builder/workspace/preview', tenant.owner, { expected: 200, data: { proposal: { ...draft([]), automations: [changed] } } })).json();
    expect(p2.changes).toHaveLength(1);
    await call(request, 'post', '/ai-builder/workspace/apply', tenant.owner, { expected: 200, data: { proposal: { ...draft([]), automations: [changed] } } });

    const removal = { ...draft([]), automations: [{ ...changed, removed: true }] };
    await call(request, 'post', '/ai-builder/workspace/apply', tenant.owner, { expected: 400, data: { proposal: removal } });
    await call(request, 'post', '/ai-builder/workspace/apply', tenant.owner, { expected: 200, data: { proposal: removal, confirmRemovals: true } });
    const after = await (await call(request, 'get', '/ai-builder/workspace', tenant.owner, { expected: 200 })).json();
    expect(after.automations).toHaveLength(0);
  });

  test('excluir tabela confirmando leva para a lixeira e fica no historico', async ({ request }) => {
    const state = await (await call(request, 'get', '/ai-builder/workspace', tenant.owner, { expected: 200 })).json();
    const visitas = state.tables.find((t: { key: string }) => t.key === 'visitas');
    const proposal = draft([{ ...visitas, removed: true }]);
    const preview = await (await call(request, 'post', '/ai-builder/workspace/preview', tenant.owner, { expected: 200, data: { proposal } })).json();
    expect(preview.changes[0].details[0]).toMatch(/0 registros vão para a lixeira/);
    await call(request, 'post', '/ai-builder/workspace/apply', tenant.owner, { expected: 200, data: { proposal, confirmRemovals: true } });
    const after = await (await call(request, 'get', '/ai-builder/workspace', tenant.owner, { expected: 200 })).json();
    expect(after.tables.map((t: { key: string }) => t.key)).not.toContain('visitas');

    const history = await (await call(request, 'get', '/ai-builder/workspace/history', tenant.owner, { expected: 200 })).json();
    expect(history).toHaveLength(8);
    const first = history[history.length - 1];
    expect(first.by).toBe('Dono QA');
    expect(first.request).toEqual(['Renomeie VIP, ponha o tipo, tire o CPF e crie visitas']);
    expect(first.viaAi).toBe(true);
    expect(history[0].changes[0]).toMatchObject({ kind: 'delete', key: 'visitas' });
  });
});
