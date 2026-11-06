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
    await call(request, 'post', '/ai-builder/dashboards/apply', person, { expected: 403, data: { proposal: { tabs: [] } } });
    await call(request, 'post', '/ai-builder/pdfs/apply', person, { expected: 403, data: { proposal: { table: 'ordens' } } });
  });

  test('painel: blocos sao conferidos contra os campos e o painel e criado', async ({ request }) => {
    const proposal = {
      reply: 'ok', name: 'Painel da oficina', description: 'OS', mainTable: 'ordens', roles: ['Cargo que nao existe'],
      tabs: [{
        label: 'Visão geral',
        rows: [
          [
            { type: 'kpi-card', title: 'OS', table: 'ordens', width: 6, aggregation: 'count' },
            { type: 'kpi-card', title: 'Soma inválida', table: 'ordens', width: 6, aggregation: 'sum', field: 'situacao' },
            { type: 'donut-chart', title: 'Por situação', table: 'ordens', width: 6, groupBy: 'campo_inexistente' },
          ],
          [{ type: 'grafico-magico', title: 'Não existe', table: 'ordens' }],
          [{ type: 'kanban-board', title: 'Quadro', table: 'tabela-fantasma', columns: ['numero', 'prazo', 'xyz'] }],
        ],
      }],
    };
    const res = await call(request, 'post', '/ai-builder/dashboards/apply', tenant.owner, { expected: [200, 201], data: { proposal } });
    const body = await res.json();
    expect(body.warnings.join(' ')).toMatch(/tipo desconhecido/);
    expect(body.warnings.join(' ')).toMatch(/não foi encontrada/);
    const dash = await (await call(request, 'get', `/dashboard-templates/${body.id}`, tenant.owner)).json();
    expect(dash.entitySlug).toBe('ordens');
    expect(dash.roleIds).toEqual([]);
    const widgets = Object.values(dash.widgets) as Array<{ type: string; config: Record<string, unknown> }>;
    expect(widgets.map((w) => w.type)).toEqual(['kpi-card', 'kpi-card', 'donut-chart', 'kanban-board']);
    // Soma de campo que nao e numero vira contagem; agrupamento invalido cai na situacao
    expect(widgets[1].config).toMatchObject({ aggregation: 'count', entitySlugOverride: 'ordens' });
    expect(widgets[2].config).toMatchObject({ dataSource: 'field-distribution', groupByField: 'situacao' });
    expect(widgets[3].config).toMatchObject({ groupByField: 'situacao', columnOrder: ['aberta', 'entregue'], cardTitleField: 'numero' });
    // 6 + 6 nao cabe com o terceiro: quebra a linha
    const donut = dash.layout.find((l: { i: string }) => l.i.startsWith('donut-chart'));
    expect(donut).toMatchObject({ x: 0, y: 3, w: 6 });
  });

  test('PDF: campos conferidos, previa gera PDF e o modelo e criado', async ({ request }) => {
    const proposal = {
      reply: 'ok', name: 'Ordem de serviço', description: 'Para o cliente', table: 'ordens',
      title: 'OS {{numero}} {{campo_fantasma}}', fileName: 'OS-{numero}',
      sections: [
        { kind: 'heading', title: 'Dados' },
        { kind: 'fields', fields: ['numero', 'situacao', 'prazo', 'inexistente'], columns: 2 },
        { kind: 'items', field: 'pecas', fields: ['descricao', 'qtd'], title: 'Peças' },
        { kind: 'text', text: 'Recebi o serviço da OS {{numero}}. {{nao_existe}}' },
        { kind: 'photos', fields: ['foto'] },
        { kind: 'divider' },
      ],
    };
    const preview = await call(request, 'post', '/ai-builder/pdfs/preview', tenant.owner, { expected: 200, data: { proposal } });
    expect(preview.headers()['content-type']).toContain('application/pdf');
    expect((await preview.body()).subarray(0, 4).toString()).toBe('%PDF');

    const res = await call(request, 'post', '/ai-builder/pdfs/apply', tenant.owner, { expected: [200, 201], data: { proposal } });
    const body = await res.json();
    expect(body.warnings.join(' ')).toMatch(/não existe/);
    expect(body.warnings.join(' ')).toMatch(/foto/);
    const tpl = await (await call(request, 'get', `/pdf-templates/${body.id}`, tenant.owner)).json();
    expect(tpl.slug).toBe('ordem-de-servico');
    expect(tpl.content.header.title.text).toBe('OS {{numero}} ');
    const types = tpl.content.body.map((e: { type: string }) => e.type);
    expect(types).toEqual(['text', 'field-group', 'text', 'table', 'text', 'divider']);
    const group = tpl.content.body[1];
    expect(group.fields.map((f: { binding: string }) => f.binding)).toEqual(['{{numero}}', '{{situacao}}', '{{prazo}}']);
    expect(tpl.content.body[3]).toMatchObject({ type: 'table', dataSource: 'pecas' });
    expect(tpl.content.body[4].content).toBe('Recebi o serviço da OS {{numero}}. ');
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

    // Painel e PDF pelo provedor de teste
    const dash = await (await call(request, 'post', '/ai-builder/dashboards/propose', tenant.owner, {
      expected: 200, data: { messages: [{ role: 'user', content: 'painel das OS' }] },
    })).json();
    expect(Object.values(dash.dashboard.widgets).length).toBeGreaterThan(1);
    await call(request, 'post', '/ai-builder/pdfs/propose', tenant.owner, {
      expected: 400, data: { messages: [{ role: 'user', content: 'um PDF' }] },
    });
    const pdf = await (await call(request, 'post', '/ai-builder/pdfs/propose', tenant.owner, {
      expected: 200, data: { messages: [{ role: 'user', content: 'uma OS' }], table: 'ordens' },
    })).json();
    expect(pdf.proposal.table).toBe('ordens');
    expect(pdf.proposal.sections.length).toBeGreaterThan(0);
  });
});
