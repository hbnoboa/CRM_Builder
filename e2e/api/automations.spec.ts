import { test, expect } from '@playwright/test';
import { call, createTenant, ownerStaff, type Tenant } from './helpers';

// Automacoes: as acoes sao gravadas como enviadas (antes viravam [[]]) e
// "quando o campo X mudar para Y" dispara de verdade numa alteracao.
test.describe.serial('automacoes', () => {
  let tenant: Tenant;
  let entityId: string;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    const created = await call(request, 'post', '/entities', tenant.owner, {
      expected: [200, 201],
      data: {
        name: 'Pedido', slug: 'pedidos',
        fields: [
          { slug: 'numero', name: 'Número', type: 'text' },
          { slug: 'status', name: 'Situação', type: 'select', options: [{ value: 'aberto', label: 'Aberto' }, { value: 'entregue', label: 'Entregue' }] },
          { slug: 'entregue_em', name: 'Entregue em', type: 'date' },
        ],
      },
    });
    entityId = (await created.json()).id;
  });

  test('acoes e condicoes sao gravadas como enviadas', async ({ request }) => {
    const actions = [{ order: 0, type: 'update_field', config: { fieldSlug: 'entregue_em', value: '{{today}}' } }];
    const conditions = [{ field: 'numero', operator: 'is_not_empty', value: '' }];
    const res = await call(request, 'post', `/entities/${entityId}/automations`, tenant.owner, {
      expected: [200, 201],
      data: { name: 'Data de entrega', trigger: 'ON_FIELD_CHANGE', triggerConfig: { fieldSlug: 'status', toValue: 'entregue' }, actions, conditions },
    });
    const body = await res.json();
    expect(body.actions).toEqual(actions);
    expect(body.conditions).toEqual(conditions);
  });

  test('mudar a situacao dispara a automacao e preenche a data', async ({ request }) => {
    const rec = await (await call(request, 'post', '/data/pedidos', tenant.owner, {
      expected: [200, 201], data: { data: { numero: 'P-1', status: 'aberto' } },
    })).json();
    // Mudar outro campo nao dispara
    await call(request, 'patch', `/data/pedidos/${rec.id}`, tenant.owner, { expected: 200, data: { data: { numero: 'P-1', status: 'aberto' } } });
    await call(request, 'patch', `/data/pedidos/${rec.id}`, tenant.owner, { expected: 200, data: { data: { numero: 'P-1', status: 'entregue' } } });

    const today = new Date().toISOString().slice(0, 10);
    await expect.poll(async () => {
      const r = await (await call(request, 'get', `/data/pedidos/${rec.id}`, tenant.owner, { expected: 200 })).json();
      return (r.data ?? r).entregue_em ?? r.data?.data?.entregue_em ?? null;
    }, { timeout: 15_000, intervals: [500] }).toBe(today);
  });

  test('formato dos modelos de tabela: operador equals e {{campo}} sem record.', async ({ request }) => {
    const fields = await (await call(request, 'get', `/entities/${entityId}`, tenant.owner, { expected: 200 })).json();
    await call(request, 'patch', `/entities/${entityId}`, tenant.owner, {
      expected: 200,
      data: { fields: [...fields.fields, { slug: 'resumo', name: 'Resumo', type: 'text' }] },
    });
    await call(request, 'post', `/entities/${entityId}/automations`, tenant.owner, {
      expected: [200, 201],
      data: {
        name: 'Resumo do pedido', trigger: 'ON_CREATE',
        conditions: [{ field: 'status', operator: 'equals', value: 'aberto' }],
        actions: [{ order: 1, type: 'update_field', config: { fieldSlug: 'resumo', value: 'Pedido {{numero}}' } }],
      },
    });
    const aberto = await (await call(request, 'post', '/data/pedidos', tenant.owner, { expected: [200, 201], data: { data: { numero: 'P-2', status: 'aberto' } } })).json();
    const entregue = await (await call(request, 'post', '/data/pedidos', tenant.owner, { expected: [200, 201], data: { data: { numero: 'P-3', status: 'entregue' } } })).json();
    const resumo = async (id: string) => {
      const r = await (await call(request, 'get', `/data/pedidos/${id}`, tenant.owner, { expected: 200 })).json();
      return (r.data ?? r).resumo ?? null;
    };
    await expect.poll(() => resumo(aberto.id), { timeout: 15_000, intervals: [500] }).toBe('Pedido P-2');
    expect(await resumo(entregue.id)).toBeNull();
  });

  test('e-mail de automacao: no maximo 20 destinatarios e teto diario por empresa', async ({ request }) => {
    const emails = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `qa-${tag}-${i}@example.com`).join(',');
    const executions = async (automationId: string) => {
      const body = await (await call(request, 'get', `/entities/${entityId}/automations/${automationId}/executions?limit=100`, tenant.owner, { expected: 200 })).json();
      return (body.data ?? body) as Array<{ status: string; errorMessage: string | null }>;
    };
    const create = async (name: string, to: string) => (await (await call(request, 'post', `/entities/${entityId}/automations`, tenant.owner, {
      expected: [200, 201],
      data: { name, trigger: 'ON_CREATE', conditions: [{ field: 'numero', operator: 'equals', value: name }], actions: [{ order: 0, type: 'send_email', config: { to, subject: 'Aviso', body: 'Pedido {{numero}}' } }] },
    })).json()).id as string;

    // Destinatarios demais numa vez: a execucao falha com o motivo
    const muitos = await create('MUITOS', emails(21, 'muitos'));
    await call(request, 'post', '/data/pedidos', tenant.owner, { expected: [200, 201], data: { data: { numero: 'MUITOS', status: 'aberto' } } });
    await expect.poll(async () => (await executions(muitos)).map((e) => e.errorMessage ?? '').join(' '), { timeout: 15_000, intervals: [500] })
      .toContain('no máximo 20');

    // 20 por registro: o 16o registro passa dos 300 do dia
    const lote = await create('LOTE', emails(20, 'lote'));
    for (let i = 0; i < 16; i++) {
      await call(request, 'post', '/data/pedidos', tenant.owner, { expected: [200, 201], data: { data: { numero: 'LOTE', status: 'aberto' } } });
    }
    await expect.poll(async () => (await executions(lote)).filter((e) => (e.errorMessage ?? '').includes('Limite diário')).length, { timeout: 30_000, intervals: [1000] })
      .toBeGreaterThan(0);
  });
});
