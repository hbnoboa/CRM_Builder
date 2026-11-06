import { test, expect } from '@playwright/test';
import { call, createTenant, ownerStaff, type Tenant } from './helpers';

// Construtor de tabelas: datas de sistema nao viram campo, equipe para "Pessoa da
// equipe" e pendencias da tela inicial a partir dos Ajustes (prazo/situacao/responsavel).
test.describe.serial('construtores', () => {
  let tenant: Tenant;
  let entityId: string;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
  });

  test('datas de criacao/atualizacao nao sao gravadas como campos', async ({ request }) => {
    const created = await call(request, 'post', '/entities', tenant.owner, {
      expected: [200, 201],
      data: {
        name: 'Tarefa',
        slug: 'tarefas',
        fields: [
          { slug: 'titulo', name: 'Título', type: 'text' },
          { slug: 'prazo', name: 'Prazo', type: 'date' },
          { slug: 'status', name: 'Situação', type: 'select', options: [{ value: 'aberta', label: 'Aberta' }, { value: 'feita', label: 'Feita' }] },
          { slug: 'responsavel', name: 'Responsável', type: 'user-select' },
          { slug: 'createdAt', name: 'Data de Criação', type: 'datetime' },
        ],
      },
    });
    entityId = (await created.json()).id;

    // A leitura injeta as datas (marcadas como sistema)...
    const read = await (await call(request, 'get', `/entities/${entityId}`, tenant.owner, { expected: 200 })).json();
    const system = read.fields.filter((f: { slug: string }) => ['createdAt', 'updatedAt'].includes(f.slug));
    expect(system).toHaveLength(2);
    expect(system.every((f: { system?: boolean }) => f.system)).toBe(true);

    // ...e salvar o que foi lido (como o editor faz) nao as grava.
    const patched = await (await call(request, 'patch', `/entities/${entityId}`, tenant.owner, {
      expected: 200, data: { fields: read.fields },
    })).json();
    expect(patched.fields.map((f: { slug: string }) => f.slug)).toEqual(['titulo', 'prazo', 'status', 'responsavel']);
  });

  test('equipe da empresa: so id e nome', async ({ request }) => {
    const members = await (await call(request, 'get', '/team-directory', tenant.owner, { expected: 200 })).json();
    expect(members.length).toBeGreaterThan(0);
    expect(Object.keys(members[0]).sort()).toEqual(['id', 'name']);
  });

  test('pendencias: com prazo, sem as encerradas, do responsavel', async ({ request }) => {
    const me = (await (await call(request, 'get', '/team-directory', tenant.owner, { expected: 200 })).json())[0].name;
    const rec = (data: Record<string, unknown>) =>
      call(request, 'post', '/data/tarefas', tenant.owner, { expected: [200, 201], data: { data } });
    await rec({ titulo: 'Atrasada', prazo: '2020-01-10', status: 'aberta', responsavel: me });
    await rec({ titulo: 'Futura', prazo: '2099-01-10', status: 'aberta', responsavel: me });
    await rec({ titulo: 'Feita', prazo: '2020-01-05', status: 'feita', responsavel: me });
    await rec({ titulo: 'Sem prazo', status: 'aberta', responsavel: me });
    await rec({ titulo: 'De outro', prazo: '2020-01-01', status: 'aberta', responsavel: 'Outra pessoa' });

    // Sem prazo configurado: nada de pendencias
    let home = await (await call(request, 'get', '/stats/my-home', tenant.owner, { expected: 200 })).json();
    expect(home.pending).toEqual([]);

    await call(request, 'patch', `/entities/${entityId}`, tenant.owner, {
      expected: 200,
      data: { settings: { titleField: 'titulo', statusField: 'status', doneValues: ['feita'], deadlineField: 'prazo', assigneeField: 'responsavel' } },
    });
    home = await (await call(request, 'get', '/stats/my-home', tenant.owner, { expected: 200 })).json();
    expect(home.pending.map((p: { title: string }) => p.title)).toEqual(['Atrasada', 'Futura']);
    expect(home.pending[0].status).toEqual({ label: 'Aberta', color: null });
  });

  test('pendencias: campo Sim/Nao encerra quando marcado', async ({ request }) => {
    await call(request, 'post', '/entities', tenant.owner, {
      expected: [200, 201],
      data: {
        name: 'Correção', slug: 'correcoes',
        fields: [
          { slug: 'descricao', name: 'Descrição', type: 'text' },
          { slug: 'prazo', name: 'Prazo', type: 'date' },
          { slug: 'resolvida', name: 'Resolvida', type: 'boolean' },
        ],
        settings: { titleField: 'descricao', statusField: 'resolvida', doneValues: ['true'], deadlineField: 'prazo' },
      },
    });
    for (const [descricao, resolvida] of [['Pneu', false], ['Farol', true]] as const) {
      await call(request, 'post', '/data/correcoes', tenant.owner, { expected: [200, 201], data: { data: { descricao, prazo: '2020-02-01', resolvida } } });
    }
    const home = await (await call(request, 'get', '/stats/my-home', tenant.owner, { expected: 200 })).json();
    const titles = home.pending.map((p: { title: string }) => p.title);
    expect(titles).toContain('Pneu');
    expect(titles).not.toContain('Farol');
  });
});
