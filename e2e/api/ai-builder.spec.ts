import { test, expect } from '@playwright/test';
import { call, createClientsTable, createPerson, createRole, ownerStaff, createTenant, type Tenant } from './helpers';

type Field = {
  slug: string; label: string; type: string; options?: Array<{ value: string; label: string; color?: string }>;
  relatedEntitySlug?: string; relatedEntityId?: string; relatedDisplayField?: string; subEntitySlug?: string; subEntityId?: string;
};
type EntityBody = { id: string; slug: string; name: string; category?: string; fields: Field[]; settings: Record<string, unknown> };

/** Proposta "suja", como uma IA poderia devolver: o servidor corrige antes de criar. */
const PROPOSAL = {
  reply: 'ok',
  group: 'Oficina',
  tables: [
    {
      key: 'ordens', name: 'Ordem', namePlural: 'Ordens', description: 'OS', icon: 'NaoExiste', color: 'pink',
      titleField: 'numero', statusField: 'situacao', doneOptions: ['Entregue'], deadlineField: 'prazo', assigneeField: 'mecanico',
      fields: [
        { key: 'numero', label: 'Número', type: 'text', required: true },
        { key: 'situacao', label: 'Situação', type: 'select', options: [{ label: 'Aberta', color: 'blue' }, { label: 'Entregue', color: 'green' }] },
        { key: 'prazo', label: 'Prazo', type: 'date' },
        { key: 'mecanico', label: 'Mecânico', type: 'user-select' },
        { key: 'veiculo', label: 'Veículo', type: 'relation', relatedTable: 'veiculos' },
        { key: 'cliente', label: 'Cliente', type: 'relation', relatedTable: 'clientes' },
        { key: 'fantasma', label: 'Fantasma', type: 'relation', relatedTable: 'nao-existe' },
        { key: 'vazia', label: 'Lista vazia', type: 'select', options: [] },
        { key: 'script', label: 'Script', type: '<script>' },
        { key: 'createdAt', label: 'Criado em', type: 'date' },
      ],
    },
    {
      key: 'pecas', name: 'Peça', namePlural: 'Peças', description: 'Itens da OS', parentKey: 'ordens',
      fields: [{ key: 'descricao', label: 'Descrição', type: 'text' }, { key: 'qtd', label: 'Quantidade', type: 'number' }],
    },
    {
      // Liga de volta para Ordens: ciclo de relacoes que precisa ser desfeito
      key: 'veiculos', name: 'Veículo', namePlural: 'Veículos', description: 'Carros',
      fields: [{ key: 'placa', label: 'Placa', type: 'text' }, { key: 'ultima_os', label: 'Última OS', type: 'relation', relatedTable: 'ordens' }],
    },
  ],
};

test.describe.serial('assistente de criacao (IA)', () => {
  let tenant: Tenant;
  let clientesId: string;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    clientesId = await createClientsTable(request, tenant.owner);
  });

  test('aplicar valida a proposta e cria as tabelas ligadas', async ({ request }) => {
    const res = await call(request, 'post', '/ai-builder/apply', tenant.owner, { expected: [200, 201], data: { proposal: PROPOSAL } });
    const body = (await res.json()) as { rootId: string; warnings: string[]; tables: Array<{ key: string; id: string; slug: string }> };
    expect(body.tables.map((t) => t.key)).toEqual(['ordens', 'pecas', 'veiculos']);
    const ids = Object.fromEntries(body.tables.map((t) => [t.key, t.id]));
    expect(body.rootId).toBe(ids.ordens);
    expect(body.warnings.join(' ')).toMatch(/circular/);

    const get = async (id: string) => (await (await call(request, 'get', `/entities/${id}`, tenant.owner)).json()) as EntityBody;
    const ordens = await get(ids.ordens);
    const pecas = await get(ids.pecas);
    const veiculos = await get(ids.veiculos);
    const by = (e: EntityBody, slug: string) => e.fields.find((f) => f.slug === slug);

    expect(ordens.category).toBe('Oficina');
    expect(ordens.settings).toMatchObject({
      titleField: 'numero', statusField: 'situacao', doneValues: ['entregue'], deadlineField: 'prazo', assigneeField: 'mecanico',
    });
    expect(by(ordens, 'situacao')?.options).toEqual([
      { value: 'aberta', label: 'Aberta', color: '#2563eb' },
      { value: 'entregue', label: 'Entregue', color: '#16a34a' },
    ]);
    // Ligacoes: tabela nova e tabela que ja existia
    expect(by(ordens, 'veiculo')).toMatchObject({ type: 'relation', relatedEntitySlug: 'veiculos', relatedEntityId: ids.veiculos, relatedDisplayField: 'placa' });
    expect(by(ordens, 'cliente')).toMatchObject({ type: 'relation', relatedEntitySlug: 'clientes', relatedEntityId: clientesId });
    // Lista dentro da OS criada sozinha
    expect(by(ordens, 'pecas')).toMatchObject({ type: 'sub-entity', subEntitySlug: 'pecas', subEntityId: ids.pecas });
    // Corrigidos: ligacao sem destino, lista sem opcoes e tipo desconhecido viram texto; data de sistema nao entra
    expect(by(ordens, 'fantasma')?.type).toBe('text');
    expect(by(ordens, 'vazia')?.type).toBe('text');
    expect(by(ordens, 'script')?.type).toBe('text');
    expect(ordens.fields.some((f) => f.label === 'Criado em')).toBe(false);
    // Ciclo Ordens <-> Veiculos desfeito na volta
    expect(by(veiculos, 'ultima_os')?.type).toBe('text');
    expect(pecas.settings).toMatchObject({ titleField: 'descricao' });
  });

  test('aplicar de novo nao colide com as tabelas que ja existem', async ({ request }) => {
    const res = await call(request, 'post', '/ai-builder/apply', tenant.owner, {
      expected: [200, 201],
      data: { proposal: { reply: '', tables: [{ key: 'veiculos', name: 'Veículo', namePlural: 'Veículos', description: '', fields: [{ key: 'placa', label: 'Placa', type: 'text' }] }] } },
    });
    expect((await res.json()).tables[0].slug).toBe('veiculos-2');
  });

  test('quem nao cria tabelas nao usa o assistente', async ({ request }) => {
    const roleId = await createRole(request, tenant.owner, {
      name: 'Só registros', permissions: [{ entitySlug: '*', canRead: true, canCreate: true, canUpdate: true, canDelete: false, scope: 'all' }],
      modulePermissions: {},
    });
    const person = await createPerson(request, tenant.owner, tenant.slug, 'Operador', roleId);
    await call(request, 'post', '/ai-builder/apply', person, { expected: 403, data: { proposal: PROPOSAL } });
    await call(request, 'post', '/ai-builder/propose', person, { expected: 403, data: { messages: [{ role: 'user', content: 'oi' }] } });
  });

  test('conversa com o provedor de teste devolve proposta e ajusta', async ({ request }) => {
    const status = await (await call(request, 'get', '/ai-builder/status', tenant.owner)).json();
    test.skip(status.provider !== 'mock', 'API sem AI_BUILDER_PROVIDER=mock');

    const first = await (await call(request, 'post', '/ai-builder/propose', tenant.owner, {
      expected: 200, data: { messages: [{ role: 'user', content: 'Quero controlar visitas aos clientes' }] },
    })).json();
    expect(first.tables.map((t: { key: string }) => t.key)).toEqual(['clientes', 'visitas', 'servicos']);
    // A lista de visitas aparece dentro de Clientes; nada foi criado ainda
    expect(first.tables[0].fields.some((f: Field) => f.type === 'sub-entity' && f.subEntitySlug === 'visitas')).toBe(true);
    const list = await (await call(request, 'get', '/entities?limit=100', tenant.owner)).json();
    expect(list.data.some((e: { slug: string }) => e.slug === 'visitas')).toBe(false);

    const second = await (await call(request, 'post', '/ai-builder/propose', tenant.owner, {
      expected: 200,
      data: {
        messages: [
          { role: 'user', content: 'Quero controlar visitas aos clientes' },
          { role: 'assistant', content: first.reply },
          { role: 'user', content: 'Coloque observações' },
        ],
        currentProposal: first.proposal,
      },
    })).json();
    expect(second.tables[0].fields.map((f: Field) => f.slug)).toContain('observacoes');

    await call(request, 'post', '/ai-builder/propose', tenant.owner, {
      expected: 400, data: { messages: [{ role: 'assistant', content: 'sem pergunta' }] },
    });
  });
});
