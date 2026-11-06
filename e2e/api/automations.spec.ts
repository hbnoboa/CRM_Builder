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
});
