import { test, expect, type APIRequestContext } from '@playwright/test';
import { call, createPerson, createRole, ownerStaff, createTenant, type Session, type Tenant } from './helpers';

/**
 * IA no chat (provedor "mock" na API de teste): a IA so decide a acao; contar, listar
 * e gravar sao do sistema, com as permissoes de quem pediu. Ler o conteudo de um
 * registro (resumir/escrever) so com "Permitir que a IA leia registros" ligado.
 */

type BotMessage = { id: string; type: string; content: string; meta: Record<string, unknown> };

const SINISTROS = {
  name: 'Sinistro', namePlural: 'Sinistros', slug: 'sinistros',
  settings: { titleField: 'numero', statusField: 'situacao' },
  fields: [
    { slug: 'numero', name: 'Número', label: 'Número', type: 'text' },
    {
      slug: 'situacao', name: 'Situação', label: 'Situação', type: 'select',
      options: [{ value: 'aberto', label: 'Aberto' }, { value: 'fechado', label: 'Fechado' }],
    },
    { slug: 'relato', name: 'Relato', label: 'Relato', type: 'textarea' },
  ],
};

async function ask(ctx: APIRequestContext, session: Session, channelId: string, message: string): Promise<BotMessage> {
  const res = await call(ctx, 'post', `/chat/channels/${channelId}/bot`, session, { expected: [200, 201], data: { message: `@bot ${message}` } });
  return ((await res.json()) as { reply: BotMessage }).reply;
}

async function records(ctx: APIRequestContext, session: Session) {
  const body = await (await call(ctx, 'get', '/data/sinistros?limit=100', session, { expected: 200 })).json();
  return (body.data as Array<{ id: string; data: { numero: string; situacao: string } }>);
}

test.describe.serial('IA no chat', () => {
  let tenant: Tenant;
  let channelId: string;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    await call(request, 'post', '/entities', tenant.owner, { expected: [200, 201], data: SINISTROS });
    for (const [numero, situacao] of [['SIN-100', 'aberto'], ['SIN-101', 'aberto'], ['SIN-102', 'fechado']]) {
      await call(request, 'post', '/data/sinistros', tenant.owner, {
        expected: [200, 201], data: { data: { numero, situacao, relato: `Batida leve ${numero}` } },
      });
    }
    const ch = await call(request, 'post', '/chat/channels/group/sinistros', tenant.owner, { expected: [200, 201] });
    channelId = ((await ch.json()) as { id: string }).id;
  });

  test('conta e lista com filtro, sem a IA ver os registros', async ({ request }) => {
    const count = await ask(request, tenant.owner, channelId, 'quantos sinistros temos?');
    expect(count.content).toMatch(/3/);

    const list = await ask(request, tenant.owner, channelId, 'liste os sinistros abertos');
    expect(list.type).toBe('query_result');
    expect(list.meta.total).toBe(2);
    const rows = list.meta.rows as Array<Record<string, unknown>>;
    expect(JSON.stringify(rows)).toContain('SIN-100');
    expect(JSON.stringify(rows)).not.toContain('SIN-102');
    // Opcao aparece pelo rotulo, nao pelo valor gravado
    expect(JSON.stringify(rows)).toContain('Aberto');
  });

  test('criar pede confirmacao; cancelar nao grava; confirmar grava uma vez', async ({ request }) => {
    const proposal = await ask(request, tenant.owner, channelId, 'crie sinistro: SIN-900');
    expect(proposal.content).toMatch(/Confirma\?/);
    expect((proposal.meta.pendingAction as { kind: string }).kind).toBe('ai-create');
    expect((await records(request, tenant.owner)).some((r) => r.data.numero === 'SIN-900')).toBe(false);

    const cancel = await ask(request, tenant.owner, channelId, 'não');
    expect(cancel.content).toMatch(/não fiz nada/);
    expect((await records(request, tenant.owner)).some((r) => r.data.numero === 'SIN-900')).toBe(false);

    await ask(request, tenant.owner, channelId, 'crie sinistro: SIN-900');
    const done = await ask(request, tenant.owner, channelId, 'sim');
    expect(done.content).toMatch(/Pronto/);
    const again = await ask(request, tenant.owner, channelId, 'sim');
    expect(again.content).toMatch(/Não há ação pendente/);
    expect((await records(request, tenant.owner)).filter((r) => r.data.numero === 'SIN-900')).toHaveLength(1);
  });

  test('pergunta que comeca com "pode" nao e confirmacao', async ({ request }) => {
    const res = await ask(request, tenant.owner, channelId, 'pode listar os sinistros?');
    expect(res.content).not.toMatch(/Não há ação pendente/);
  });

  test('alterar acha o registro pelo texto e muda so depois do sim', async ({ request }) => {
    const proposal = await ask(request, tenant.owner, channelId, 'mude SIN-900 para Fechado');
    expect((proposal.meta.pendingAction as { kind: string } | undefined)?.kind, proposal.content).toBe('ai-update');
    expect((await records(request, tenant.owner)).find((r) => r.data.numero === 'SIN-900')?.data.situacao).not.toBe('fechado');
    await ask(request, tenant.owner, channelId, 'sim');
    expect((await records(request, tenant.owner)).find((r) => r.data.numero === 'SIN-900')?.data.situacao).toBe('fechado');
  });

  test('quem so pode ver nao recebe proposta de criacao', async ({ request }) => {
    const roleId = await createRole(request, tenant.owner, {
      name: `Leitor ${Date.now()}`,
      permissions: [{ entitySlug: 'sinistros', canRead: true, canCreate: false, canUpdate: false, canDelete: false, scope: 'all' }],
      modulePermissions: { data: { canRead: true, canCreate: false, canUpdate: false, canDelete: false }, chat: { canRead: true } },
    });
    const viewer = await createPerson(request, tenant.owner, tenant.slug, 'Leitor', roleId);
    const ch = await call(request, 'post', '/chat/channels/group/sinistros', viewer, { expected: [200, 201] });
    const id = ((await ch.json()) as { id: string }).id;
    const res = await ask(request, viewer, id, 'crie sinistro: SIN-777');
    expect(res.meta.pendingAction).toBeUndefined();
    expect(res.content).toMatch(/permiss/i);
  });

  test('resumir so com a opcao ligada, e fica no registro de auditoria', async ({ request }) => {
    const blocked = await ask(request, tenant.owner, channelId, 'resuma o sinistro SIN-100');
    expect(blocked.content).toMatch(/Permitir que a IA leia registros/);

    await call(request, 'patch', '/tenants/me', tenant.owner, { expected: 200, data: { aiReadRecords: true } });
    const summary = await ask(request, tenant.owner, channelId, 'resuma o sinistro SIN-100');
    expect(summary.content).toMatch(/Resumo de teste/);
    expect(summary.content).not.toMatch(/Permitir que a IA/);

    const logs = await (await call(request, 'get', '/audit-logs?action=export&resource=entity_data&limit=20', tenant.owner, { expected: 200 })).json();
    const list = (logs.data ?? logs) as Array<{ metadata?: { source?: string; purpose?: string } }>;
    expect(list.some((l) => l.metadata?.source === 'ai' && l.metadata?.purpose === 'summarize')).toBe(true);

    await call(request, 'patch', '/tenants/me', tenant.owner, { expected: 200, data: { aiReadRecords: false } });
  });
});
