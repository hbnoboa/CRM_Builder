import { inflateRawSync } from 'zlib';
import { test, expect, APIRequestContext, APIResponse } from '@playwright/test';
import {
  API, call, createClientsTable, createPerson, createRecord, createTenant, listRoles, loginStaff, loginUser,
  ownerStaff, PASSWORD, Session, suffix, Tenant, totp,
} from './helpers';

// Parte HTTP do roteiro manual (docs/teste-e2e-completo.md). O ID do roteiro fica no título.
// Mensagens literais são as do texto atual da API (sem acento). Quando o roteiro cita um texto de
// tela, o teste confere o status/campo que a tela usa e isso fica anotado no comentário.
// Só toca em empresas, planos e equipe criados aqui ("QA API ...").
//
// Os testes de um bloco não dependem da ordem: o estado é montado sob demanda (ensure...), porque
// uma falha reinicia o worker e zera as variáveis do arquivo. Os limites do servidor são respeitados
// com espaçamento: aceite de convite 5/min, cadastro em link 3/min, login 5/min por e-mail.

type Req = APIRequestContext;
type StaffSession = Session & { id: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const DAY = 86_400_000;
const THROTTLED = 'Muitas tentativas. Aguarde um minuto e tente novamente.';

async function expectError(response: APIResponse, status: number, message: string | RegExp) {
  const text = await response.text();
  expect(response.status(), text).toBe(status);
  const body = JSON.parse(text);
  if (typeof message === 'string') expect(body.message).toBe(message);
  else expect(body.message).toMatch(message);
  return body;
}

const lastCall = new Map<string, number>();

/** Espaça chamadas de uma rota limitada e espera se o limite ainda assim bater. */
async function limited(key: string, gapMs: number, send: () => Promise<APIResponse>): Promise<APIResponse> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = (lastCall.get(key) ?? 0) + gapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall.set(key, Date.now());
    const response = await send();
    if (response.status() !== 429) return response;
    await sleep(20_000);
  }
  throw new Error(`Limite de tentativas: ${key}`);
}

const rawLogin = (request: Req, email: string, password = PASSWORD) =>
  limited(`login:${email}`, 13_000, () => request.post(`${API}/auth/login`, { data: { email, password } }));

const rawStaffLogin = (request: Req, email: string, password = PASSWORD) =>
  limited(`staff:${email}`, 13_000, () => request.post(`${API}/platform/auth/login`, { data: { email, password } }));

const mfaStep = (request: Req, mfaToken: string, code: string) =>
  limited('login-mfa', 13_000, () => request.post(`${API}/auth/login/mfa`, { data: { mfaToken, code } }));

const acceptInvite = (request: Req, token: string, data: Record<string, unknown>) =>
  limited('accept', 13_000, () => request.post(`${API}/invitations/public/${token}/accept`, { data }));

const linkRegister = (request: Req, slug: string, data: Record<string, unknown>) =>
  limited('link-register', 21_000, () => request.post(`${API}/p/${slug}/register`, { data }));

const roleId = (roles: Array<{ id: string; name: string }>, name: string) => roles.find((r) => r.name === name)!.id;
const qaEmail = (nick: string) => `qa-${nick}-${suffix()}@example.com`;
const sessionFrom = (body: { accessToken: string; user?: { id?: string } }, slug: string, email: string): Session => ({
  token: body.accessToken, slug, userId: body.user?.id, email,
});

type Invite = { id: string; email: string; token: string };

async function invite(request: Req, owner: Session, customRoleId: string, nick = 'convidado'): Promise<Invite> {
  const email = qaEmail(nick);
  const body = await (await call(request, 'post', '/invitations', owner, {
    expected: [200, 201], data: { email, customRoleId },
  })).json();
  return { id: body.id, email, token: body.link.split('/invite/')[1] };
}

const planIds: string[] = [];

async function createPlan(
  request: Req,
  staff: Session,
  nick: string,
  limits: Record<string, number>,
  features: Record<string, boolean> = {},
) {
  const id = suffix();
  const plan = await (await call(request, 'post', '/platform/plans', staff, {
    expected: [200, 201],
    data: { name: `QA API ${nick} ${id}`, slug: `qa-api-${nick}-${id}`, isActive: true, limits, features },
  })).json();
  planIds.push(plan.id);
  return plan as { id: string; slug: string; name: string; limits: Record<string, number>; features: Record<string, boolean>; isDefault: boolean; isActive: boolean };
}

async function consoleTenant(request: Req, staff: Session, options: { planId?: string; lifecycle?: string } = {}): Promise<Tenant> {
  const id = suffix();
  const slug = `qa-api-${id}`;
  const ownerEmail = `qa-api-${id}@example.com`;
  const lifecycle = options.lifecycle ?? 'ACTIVE';
  const tenant = await (await call(request, 'post', '/platform/tenants', staff, {
    expected: [200, 201],
    data: {
      name: `QA API ${id}`, slug, adminName: 'Dono QA', adminEmail: ownerEmail, adminPassword: PASSWORD, lifecycle,
      ...(options.planId ? { planId: options.planId } : {}),
      ...(lifecycle === 'TRIAL' ? { trialEndsAt: new Date(Date.now() + 14 * DAY).toISOString() } : {}),
    },
  })).json();
  return { id: tenant.id, slug, name: tenant.name, ownerEmail, owner: await loginUser(request, ownerEmail, slug) };
}

const setPlan = (request: Req, staff: Session, tenantId: string, planId: string) =>
  call(request, 'patch', `/platform/tenants/${tenantId}/plan`, staff, { expected: 200, data: { planId } });

const setLifecycle = (request: Req, staff: Session, tenantId: string, lifecycle: string, trialEndsAt?: string) =>
  call(request, 'patch', `/platform/tenants/${tenantId}/lifecycle`, staff, { data: { lifecycle, ...(trialEndsAt ? { trialEndsAt } : {}) } });

async function enableMfa(request: Req, session: Session) {
  const setup = await (await call(request, 'post', '/auth/mfa/setup', session, { expected: [200, 201] })).json();
  const enabled = await (await call(request, 'post', '/auth/mfa/enable', session, {
    expected: [200, 201], data: { code: totp(setup.secret) },
  })).json();
  return { secret: setup.secret as string, recoveryCodes: enabled.recoveryCodes as string[] };
}

// Equipe do console, criada uma vez por worker e removida no fim.
let staffTeam: { sergio: StaffSession; fabio: StaffSession; lia: StaffSession } | undefined;
const staffIds: string[] = [];

async function addStaff(request: Req, nick: string, role: string): Promise<StaffSession> {
  const email = qaEmail(`staff-${nick}`);
  const created = await (await call(request, 'post', '/platform/staff', await ownerStaff(request), {
    expected: [200, 201], data: { email, name: `QA API ${nick}`, role, password: PASSWORD },
  })).json();
  staffIds.push(created.id);
  return { ...(await loginStaff(request, email, PASSWORD)), id: created.id };
}

async function team(request: Req) {
  staffTeam ??= {
    sergio: await addStaff(request, 'sergio', 'SUPPORT'),
    fabio: await addStaff(request, 'fabio', 'FINANCE'),
    lia: await addStaff(request, 'lia', 'READONLY'),
  };
  return staffTeam;
}

test.afterAll(async ({ request }) => {
  if (!staffIds.length && !planIds.length) return;
  const paula = await ownerStaff(request);
  for (const id of staffIds.splice(0)) await call(request, 'delete', `/platform/staff/${id}`, paula);
  for (const id of planIds.splice(0)) await call(request, 'patch', `/platform/plans/${id}`, paula, { data: { isActive: false } });
});

// ── Plataforma ──────────────────────────────────────────────────────────────

test.describe('P-05 equipe do console', () => {
  let paula: Session;
  let sergioEmail: string;
  const people: Record<string, { id: string; email: string; role: string }> = {};

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    paula = await ownerStaff(request);
    for (const [nick, role] of [['sergio', 'SUPPORT'], ['fabio', 'FINANCE'], ['lia', 'READONLY']]) {
      const email = qaEmail(`p05-${nick}`);
      const created = await (await call(request, 'post', '/platform/staff', paula, {
        expected: [200, 201], data: { email, name: `QA API ${nick}`, role, password: PASSWORD },
      })).json();
      staffIds.push(created.id);
      people[nick] = { id: created.id, email, role };
    }
    sergioEmail = people.sergio.email;
  });

  test('[P-05/1-2] adiciona Suporte, Financeiro e Somente leitura', async ({ request }) => {
    const list = await (await call(request, 'get', '/platform/staff', paula, { expected: 200 })).json();
    for (const person of Object.values(people)) {
      expect(list.find((s: { id: string }) => s.id === person.id)).toMatchObject({ email: person.email, role: person.role, status: 'ACTIVE' });
    }
  });

  test('[P-05/3] e-mail repetido', async ({ request }) => {
    const response = await call(request, 'post', '/platform/staff', paula, {
      data: { email: sergioEmail, name: 'QA API dup', role: 'SUPPORT', password: PASSWORD },
    });
    await expectError(response, 409, 'Email ja cadastrado na equipe');
  });

  // Tela: a própria linha não tem botões. Na API, a recusa que sustenta isso.
  test('[P-05/4] dono não muda o próprio cargo', async ({ request }) => {
    const me = await (await call(request, 'get', '/platform/auth/me', paula, { expected: 200 })).json();
    const response = await call(request, 'patch', `/platform/staff/${me.id}`, paula, { data: { role: 'OWNER' } });
    await expectError(response, 400, 'Voce nao pode mudar o proprio cargo ou status');
  });

  test('[P-05/5] muda o cargo e volta', async ({ request }) => {
    const path = `/platform/staff/${people.lia.id}`;
    expect((await (await call(request, 'patch', path, paula, { expected: 200, data: { role: 'SUPPORT' } })).json()).role).toBe('SUPPORT');
    expect((await (await call(request, 'patch', path, paula, { expected: 200, data: { role: 'READONLY' } })).json()).role).toBe('READONLY');
  });

  test('[P-05/6] nova senha vale no login', async ({ request }) => {
    const next = 'Outra@2026qa';
    await call(request, 'patch', `/platform/staff/${people.fabio.id}`, paula, { expected: 200, data: { password: next } });
    await expectError(await rawStaffLogin(request, people.fabio.email), 401, 'Credenciais invalidas');
    expect((await rawStaffLogin(request, people.fabio.email, next)).status()).toBe(200);
  });

  test('[P-05/7] desativar barra o login e ativar devolve', async ({ request }) => {
    const path = `/platform/staff/${people.lia.id}`;
    await call(request, 'patch', path, paula, { expected: 200, data: { status: 'INACTIVE' } });
    await expectError(await rawStaffLogin(request, people.lia.email), 401, 'Credenciais invalidas');
    await call(request, 'patch', path, paula, { expected: 200, data: { status: 'ACTIVE' } });
    expect((await rawStaffLogin(request, people.lia.email)).status()).toBe(200);
  });

  test('[P-05/8-9] desativar derruba a sessão aberta e reativar devolve o login', async ({ request }) => {
    const path = `/platform/staff/${people.lia.id}`;
    const lia = await loginStaff(request, people.lia.email, PASSWORD);
    await call(request, 'get', '/platform/auth/me', lia, { expected: 200 });
    await call(request, 'patch', path, paula, { expected: 200, data: { status: 'INACTIVE' } });
    await call(request, 'get', '/platform/auth/me', lia, { expected: 401 });
    await call(request, 'patch', path, paula, { expected: 200, data: { status: 'ACTIVE' } });
    expect((await rawStaffLogin(request, people.lia.email)).status()).toBe(200);
  });
});

test.describe('P-07 planos', () => {
  let paula: Session;
  let basic: Awaited<ReturnType<typeof createPlan>>;
  let minimal: Awaited<ReturnType<typeof createPlan>>;

  test.beforeAll(async ({ request }) => {
    paula = await ownerStaff(request);
    basic = await createPlan(request, paula, 'basico', { maxUsers: 8, maxRecords: 60, maxStorageMb: 50 }, {
      chat: true, pdf: true, automations: true, webhooks: true, publicLinks: true, mobile: true,
    });
    minimal = await createPlan(request, paula, 'minimo', { maxUsers: 2, maxRecords: 5 }, {
      chat: false, pdf: false, publicLinks: false, mobile: true,
    });
  });

  test('[P-07/1] plano básico com limites e funções', async () => {
    expect(basic.limits).toMatchObject({ maxUsers: 8, maxRecords: 60, maxStorageMb: 50 });
    expect(basic.features).toMatchObject({ chat: true, pdf: true, automations: true, webhooks: true, publicLinks: true, mobile: true });
    expect(basic.isActive).toBe(true);
  });

  test('[P-07/2] slug repetido', async ({ request }) => {
    const response = await call(request, 'post', '/platform/plans', paula, { data: { name: 'QA API dup', slug: basic.slug } });
    await expectError(response, 409, 'Ja existe um plano com esse slug');
  });

  test('[P-07/3] plano mínimo com funções desligadas', async () => {
    expect(minimal.limits).toMatchObject({ maxUsers: 2, maxRecords: 5 });
    expect(minimal.features).toMatchObject({ chat: false, pdf: false, publicLinks: false, mobile: true });
  });

  // Tela: o campo fica desabilitado. Na API, o slug enviado é ignorado.
  test('[P-07/4] editar não troca o slug', async ({ request }) => {
    const updated = await (await call(request, 'patch', `/platform/plans/${basic.id}`, paula, {
      expected: 200, data: { name: `${basic.name} editado`, slug: `qa-api-outro-${suffix()}` },
    })).json();
    expect(updated.slug).toBe(basic.slug);
    expect(updated.name).toBe(`${basic.name} editado`);
  });

  test('[P-07/5] nenhum vira padrão do cadastro', async ({ request }) => {
    const plans = await (await call(request, 'get', '/platform/plans', paula, { expected: 200 })).json();
    for (const id of [basic.id, minimal.id]) {
      expect(plans.find((p: { id: string }) => p.id === id).isDefault).toBe(false);
    }
  });
});

test.describe('P-08 cliente pelo console', () => {
  let paula: Session;
  let plan: Awaited<ReturnType<typeof createPlan>>;
  let tenant: Tenant;

  test.beforeAll(async ({ request }) => {
    paula = await ownerStaff(request);
    plan = await createPlan(request, paula, 'p08', { maxUsers: 2, maxRecords: 5 });
    tenant = await consoleTenant(request, paula, { planId: plan.id, lifecycle: 'TRIAL' });
  });

  const newTenant = (slug: string, adminEmail: string) => ({
    name: 'QA API tentativa', slug, adminName: 'Dono QA', adminEmail, adminPassword: PASSWORD,
  });

  test('[P-08/1] cria em teste com o plano escolhido', async ({ request }) => {
    const detail = await (await call(request, 'get', `/platform/tenants/${tenant.id}`, paula, { expected: 200 })).json();
    expect(detail.lifecycle).toBe('TRIAL');
    expect(detail.plan.id).toBe(plan.id);
    expect(new Date(detail.trialEndsAt).getTime()).toBeGreaterThan(Date.now());
  });

  test('[P-08/2] slug reservado', async ({ request }) => {
    const response = await call(request, 'post', '/platform/tenants', paula, { data: newTenant('admin', qaEmail('p08-slug')) });
    await expectError(response, 400, 'Slug reservado: admin');
  });

  test('[P-08/3] slug em uso', async ({ request }) => {
    const response = await call(request, 'post', '/platform/tenants', paula, { data: newTenant(tenant.slug, qaEmail('p08-slug')) });
    await expectError(response, 409, 'Slug já está em uso');
  });

  test('[P-08/4] e-mail do admin em uso', async ({ request }) => {
    const response = await call(request, 'post', '/platform/tenants', paula, { data: newTenant(`qa-api-${suffix()}`, tenant.ownerEmail) });
    await expectError(response, 400, 'Email do administrador ja esta em uso');
  });

  test('[P-08/5] cargos do modelo padrão', async ({ request }) => {
    const roles = await (await call(request, 'get', `/platform/tenants/${tenant.id}/roles`, paula, { expected: 200 })).json();
    expect(roles.map((r: { name: string; rank: number }) => [r.name, r.rank])).toEqual([
      ['Administrador', 10], ['Gerente', 30], ['Operador', 50], ['Visualizador', 70],
    ]);
    expect(roles.filter((r: { isDefault: boolean }) => r.isDefault).map((r: { name: string }) => r.name)).toEqual(['Operador']);
  });

  test('[P-08/6] admin é o dono', async ({ request }) => {
    const members = await (await call(request, 'get', `/platform/tenants/${tenant.id}/members`, paula, { expected: 200 })).json();
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ email: tenant.ownerEmail, isOwner: true });
  });
});

test.describe('P-12 e O-15 chamados', () => {
  let tenant: Tenant;
  let ana: Session;
  let vera: Session;
  const tickets: string[] = [];

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    tenant = await createTenant(request, await ownerStaff(request));
    const roles = await listRoles(request, tenant.owner);
    ana = await createPerson(request, tenant.owner, tenant.slug, 'Ana', roleId(roles, 'Operador'));
    vera = await createPerson(request, tenant.owner, tenant.slug, 'Vera', roleId(roles, 'Visualizador'));
    await team(request);
  });

  test.afterAll(async ({ request }) => {
    const paula = await ownerStaff(request);
    for (const id of tickets.splice(0)) await call(request, 'patch', `/platform/support/tickets/${id}`, paula, { data: { status: 'CLOSED' } });
  });

  const openTicket = async (request: Req) => {
    const data = { subject: 'Não consigo exportar', category: 'problem', priority: 'HIGH', body: 'Erro ao exportar' };
    // A abertura aceita 10 chamados por minuto por pessoa.
    let response = await call(request, 'post', '/support/tickets', ana, { data });
    while (response.status() === 429) {
      await new Promise((resolve) => setTimeout(resolve, 15_000));
      response = await call(request, 'post', '/support/tickets', ana, { data });
    }
    expect(response.ok(), await response.text()).toBeTruthy();
    const ticket = await response.json();
    tickets.push(ticket.id);
    return ticket as { id: string; number: number; status: string; priority: string; category: string };
  };

  const notificationTitles = async (request: Req, session: Session): Promise<string[]> => {
    const body = await (await call(request, 'get', '/notifications?limit=50', session, { expected: 200 })).json();
    return body.data.map((n: { title: string }) => n.title);
  };

  test('[O-15/1] Ana abre chamado', async ({ request }) => {
    const ticket = await openTicket(request);
    expect(ticket.number).toBeGreaterThan(0);
    expect(ticket).toMatchObject({ status: 'OPEN', priority: 'HIGH', category: 'problem' });
  });

  // Tela: "Enviar" desabilitado. Na API, a validação recusa.
  test('[O-15/2] assunto com 2 letras', async ({ request }) => {
    const response = await call(request, 'post', '/support/tickets', ana, { data: { subject: 'ab', category: 'problem', body: 'Erro ao exportar' } });
    await expectError(response, 400, 'Erro de validacao');
  });

  test('[O-15/3] dono vê todos os chamados, com quem abriu', async ({ request }) => {
    const ticket = await openTicket(request);
    const asOwner = await (await call(request, 'get', '/support/tickets', tenant.owner, { expected: 200 })).json();
    expect(asOwner.seesAll).toBe(true);
    expect(asOwner.data.find((t: { id: string }) => t.id === ticket.id).createdByName).toBe('Ana');
    expect((await (await call(request, 'get', '/support/tickets', ana, { expected: 200 })).json()).seesAll).toBe(false);
  });

  test('[O-15/4] Vera não abre o chamado da Ana', async ({ request }) => {
    const ticket = await openTicket(request);
    await expectError(await call(request, 'get', `/support/tickets/${ticket.id}`, vera), 404, 'Chamado nao encontrado');
  });

  test('[O-15/5] Ana vê a resposta e o aguardando', async ({ request }) => {
    const ticket = await openTicket(request);
    const { sergio } = await team(request);
    await call(request, 'post', `/platform/support/tickets/${ticket.id}/messages`, sergio, { expected: [200, 201], data: { body: 'Pode detalhar?' } });
    const seen = await (await call(request, 'get', `/support/tickets/${ticket.id}`, ana, { expected: 200 })).json();
    expect(seen).toMatchObject({ status: 'WAITING_CUSTOMER', lastMessageBy: 'staff' });
  });

  test('[O-15/6-7] Ana resolve e responder reabre', async ({ request }) => {
    const ticket = await openTicket(request);
    const resolved = await (await call(request, 'post', `/support/tickets/${ticket.id}/resolve`, ana, { expected: 200 })).json();
    expect(resolved.status).toBe('RESOLVED');
    const reopened = await (await call(request, 'post', `/support/tickets/${ticket.id}/messages`, ana, { expected: [200, 201], data: { body: 'Voltou a dar erro' } })).json();
    expect(reopened.status).toBe('OPEN');
  });

  // Tela: sem caixa de resposta e "Chamado encerrado. Se precisar, abra um novo.". Na API, a recusa.
  test('[O-15/8] chamado encerrado não aceita resposta', async ({ request }) => {
    const ticket = await openTicket(request);
    const { sergio } = await team(request);
    await call(request, 'patch', `/platform/support/tickets/${ticket.id}`, sergio, { expected: 200, data: { status: 'CLOSED' } });
    const response = await call(request, 'post', `/support/tickets/${ticket.id}/messages`, ana, { data: { body: 'Oi?' } });
    await expectError(response, 400, 'Chamado encerrado. Abra um novo chamado.');
  });

  test('[P-12/1] contadores da fila', async ({ request }) => {
    await openTicket(request);
    const { sergio } = await team(request);
    const counts = await (await call(request, 'get', '/platform/support/counts', sergio, { expected: 200 })).json();
    expect(counts.open).toBeGreaterThanOrEqual(1);
    expect(counts.unassigned).toBeGreaterThanOrEqual(1);
  });

  test('[P-12/2] filtros da fila', async ({ request }) => {
    const ticket = await openTicket(request);
    const { sergio } = await team(request);
    const ids = async (query: string) => {
      const body = await (await call(request, 'get', `/platform/support/tickets?tenantId=${tenant.id}&${query}`, sergio, { expected: 200 })).json();
      return body.data.map((t: { id: string }) => t.id);
    };
    expect(await ids(`search=%23${ticket.number}`)).toContain(ticket.id);
    expect(await ids('status=OPEN')).toContain(ticket.id);
    expect(await ids('status=CLOSED')).not.toContain(ticket.id);
    expect(await ids('priority=HIGH')).toContain(ticket.id);
    expect(await ids('priority=LOW')).not.toContain(ticket.id);
    expect(await ids('assigned=none')).toContain(ticket.id);
    expect(await ids('assigned=me')).not.toContain(ticket.id);
    await call(request, 'post', `/platform/support/tickets/${ticket.id}/messages`, sergio, { expected: [200, 201], data: { body: 'Olhando' } });
    expect(await ids('assigned=me')).toContain(ticket.id);
  });

  test('[P-12/3] nota interna não chega à Ana', async ({ request }) => {
    const ticket = await openTicket(request);
    const { sergio } = await team(request);
    const note = 'verificar export';
    const staffView = await (await call(request, 'post', `/platform/support/tickets/${ticket.id}/messages`, sergio, {
      expected: [200, 201], data: { body: note, internal: true },
    })).json();
    expect(staffView.messages.find((m: { body: string }) => m.body === note).internal).toBe(true);
    expect(staffView.status).toBe('OPEN');
    const seen = await (await call(request, 'get', `/support/tickets/${ticket.id}`, ana, { expected: 200 })).json();
    expect(JSON.stringify(seen.messages)).not.toContain(note);
  });

  test('[P-12/4] resposta pública muda a situação, atribui e avisa', async ({ request }) => {
    const ticket = await openTicket(request);
    const { sergio } = await team(request);
    const view = await (await call(request, 'post', `/platform/support/tickets/${ticket.id}/messages`, sergio, {
      expected: [200, 201], data: { body: 'Resposta pública' },
    })).json();
    expect(view.status).toBe('WAITING_CUSTOMER');
    expect(view.assignedStaffId).toBe(sergio.id);
    await expect.poll(() => notificationTitles(request, ana), { timeout: 15_000 }).toContain(`Resposta do suporte — chamado #${ticket.number}`);
  });

  test('[P-12/5] prioridade urgente', async ({ request }) => {
    const ticket = await openTicket(request);
    const { sergio } = await team(request);
    const view = await (await call(request, 'patch', `/platform/support/tickets/${ticket.id}`, sergio, { expected: 200, data: { priority: 'URGENT' } })).json();
    expect(view.priority).toBe('URGENT');
  });

  test('[P-12/6] resolvido mostra mensagem de sistema e avisa', async ({ request }) => {
    const ticket = await openTicket(request);
    const { sergio } = await team(request);
    await call(request, 'patch', `/platform/support/tickets/${ticket.id}`, sergio, { expected: 200, data: { status: 'RESOLVED' } });
    const seen = await (await call(request, 'get', `/support/tickets/${ticket.id}`, ana, { expected: 200 })).json();
    expect(seen.status).toBe('RESOLVED');
    expect(seen.messages.some((m: { authorType: string; body: string }) => m.authorType === 'system' && m.body === 'status:RESOLVED')).toBe(true);
    await expect.poll(() => notificationTitles(request, ana), { timeout: 15_000 }).toContain(`Chamado #${ticket.number} resolvido`);
  });

  test('[P-12/7] somente leitura vê e não responde', async ({ request }) => {
    const ticket = await openTicket(request);
    const { lia } = await team(request);
    await call(request, 'get', `/platform/support/tickets/${ticket.id}`, lia, { expected: 200 });
    await call(request, 'post', `/platform/support/tickets/${ticket.id}/messages`, lia, { expected: 403, data: { body: 'x' } });
  });

  test('[P-12/8] financeiro responde', async ({ request }) => {
    const ticket = await openTicket(request);
    const { fabio } = await team(request);
    await call(request, 'post', `/platform/support/tickets/${ticket.id}/messages`, fabio, { expected: [200, 201], data: { body: 'Do financeiro' } });
  });
});

test.describe('P-13 comunicados', () => {
  let tenant: Tenant;
  let other: Tenant;
  let ana: Session;
  const created: string[] = [];

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    const paula = await ownerStaff(request);
    tenant = await createTenant(request, paula);
    other = await createTenant(request, paula);
    const roles = await listRoles(request, tenant.owner);
    ana = await createPerson(request, tenant.owner, tenant.slug, 'Ana', roleId(roles, 'Operador'));
    await team(request);
  });

  test.afterAll(async ({ request }) => {
    const paula = await ownerStaff(request);
    for (const id of created.splice(0)) await call(request, 'delete', `/platform/announcements/${id}`, paula);
  });

  const audience = () => ({ type: 'tenants', ids: [tenant.id] });

  const draft = async (request: Req, extra: Record<string, unknown> = {}) => {
    const { sergio } = await team(request);
    const body = await (await call(request, 'post', '/platform/announcements', sergio, {
      expected: [200, 201],
      data: {
        title: `Manutenção sábado ${suffix()}`, body: 'Um texto de aviso', severity: 'WARNING', audience: audience(),
        linkUrl: 'https://exemplo.com', dismissible: true, ...extra,
      },
    })).json();
    created.push(body.id);
    return body as { id: string; publishedAt: string | null };
  };

  const publish = async (request: Req, id: string, published = true) => {
    const { sergio } = await team(request);
    await call(request, 'post', `/platform/announcements/${id}/publish`, sergio, { expected: 200, data: { published } });
  };

  const activeIds = async (request: Req, session: Session): Promise<string[]> =>
    (await (await call(request, 'get', '/announcements/active', session, { expected: 200 })).json()).map((a: { id: string }) => a.id);

  test('[P-13/1] rascunho com alcance de 1 empresa', async ({ request }) => {
    const { sergio } = await team(request);
    const reach = await (await call(request, 'post', '/platform/announcements/reach', sergio, { expected: 200, data: audience() })).json();
    expect(reach.tenants).toBe(1);
    const announcement = await draft(request);
    expect(announcement.publishedAt).toBeNull();
    expect(await activeIds(request, tenant.owner)).not.toContain(announcement.id);
  });

  test('[P-13/2] link sem http', async ({ request }) => {
    const { sergio } = await team(request);
    const response = await call(request, 'post', '/platform/announcements', sergio, {
      data: { title: 'Manutenção', body: 'Um texto', audience: audience(), linkUrl: 'exemplo.com' },
    });
    await expectError(response, 400, 'O link precisa comecar com http:// ou https://');
  });

  test('[P-13/3] fim antes do início', async ({ request }) => {
    const { sergio } = await team(request);
    const response = await call(request, 'post', '/platform/announcements', sergio, {
      data: {
        title: 'Manutenção', body: 'Um texto', audience: audience(),
        startsAt: new Date(Date.now() + 2 * DAY).toISOString(), endsAt: new Date(Date.now() + DAY).toISOString(),
      },
    });
    await expectError(response, 400, 'O fim precisa ser depois do inicio');
  });

  test('[P-13/4] publicado aparece só para a empresa do público', async ({ request }) => {
    const announcement = await draft(request);
    await publish(request, announcement.id);
    expect(await activeIds(request, tenant.owner)).toContain(announcement.id);
    expect(await activeIds(request, ana)).toContain(announcement.id);
    expect(await activeIds(request, other.owner)).not.toContain(announcement.id);
  });

  test('[P-13/5] Ana fecha: some para ela, fica para o dono e conta', async ({ request }) => {
    const announcement = await draft(request);
    await publish(request, announcement.id);
    await call(request, 'post', `/announcements/${announcement.id}/dismiss`, ana, { expected: 200 });
    expect(await activeIds(request, ana)).not.toContain(announcement.id);
    expect(await activeIds(request, tenant.owner)).toContain(announcement.id);
    const { sergio } = await team(request);
    const list = await (await call(request, 'get', '/platform/announcements', sergio, { expected: 200 })).json();
    expect(list.find((a: { id: string }) => a.id === announcement.id).dismissals).toBe(1);
  });

  test('[P-13/6] crítico só para quem administra e sem fechar', async ({ request }) => {
    const announcement = await draft(request, { severity: 'CRITICAL', dismissible: false, adminsOnly: true });
    await publish(request, announcement.id);
    expect(await activeIds(request, tenant.owner)).toContain(announcement.id);
    expect(await activeIds(request, ana)).not.toContain(announcement.id);
    const response = await call(request, 'post', `/announcements/${announcement.id}/dismiss`, tenant.owner);
    await expectError(response, 400, 'Este comunicado nao pode ser fechado');
  });

  test('[P-13/7] tirar do ar e excluir', async ({ request }) => {
    const announcement = await draft(request);
    await publish(request, announcement.id);
    await publish(request, announcement.id, false);
    expect(await activeIds(request, tenant.owner)).not.toContain(announcement.id);
    const { sergio } = await team(request);
    await call(request, 'delete', `/platform/announcements/${announcement.id}`, sergio, { expected: 200 });
    const list = await (await call(request, 'get', '/platform/announcements', sergio, { expected: 200 })).json();
    expect(list.map((a: { id: string }) => a.id)).not.toContain(announcement.id);
  });
});

test('[P-14/3] desconectar de tudo derruba token e refresh', async ({ request }) => {
  const tenant = await createTenant(request, await ownerStaff(request));
  const roles = await listRoles(request, tenant.owner);
  const email = qaEmail('p14-bruno');
  await call(request, 'post', '/users', tenant.owner, { expected: [200, 201], data: { email, name: 'Bruno', password: PASSWORD, customRoleId: roleId(roles, 'Gerente') } });
  const login = await (await rawLogin(request, email)).json();
  const bruno = sessionFrom(login, tenant.slug, email);
  await call(request, 'get', '/auth/me', bruno, { expected: 200 });

  const { sergio } = await team(request);
  const result = await (await call(request, 'post', `/platform/users/${bruno.userId}/logout`, sergio, { expected: 200 })).json();
  expect(result.revoked).toBeGreaterThanOrEqual(1);

  await expect.poll(async () => (await call(request, 'get', '/auth/me', bruno)).status(), { timeout: 15_000 }).toBe(401);
  const refresh = await request.post(`${API}/auth/refresh`, { data: { refreshToken: login.refreshToken } });
  await expectError(refresh, 401, 'SESSION_REVOKED');
});

test.describe('P-15 ações em massa', () => {
  let paula: Session;
  let planA: Awaited<ReturnType<typeof createPlan>>;
  let planB: Awaited<ReturnType<typeof createPlan>>;
  let a: Tenant;
  let b: Tenant;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    paula = await ownerStaff(request);
    planA = await createPlan(request, paula, 'p15a', { maxUsers: 50 });
    planB = await createPlan(request, paula, 'p15b', { maxUsers: 50 });
    a = await consoleTenant(request, paula, { planId: planA.id, lifecycle: 'TRIAL' });
    b = await consoleTenant(request, paula, { planId: planB.id, lifecycle: 'TRIAL' });
    await team(request);
  });

  const bulk = async (request: Req, data: Record<string, unknown>) => {
    const { fabio } = await team(request);
    return (await call(request, 'post', '/platform/tenants/bulk', fabio, { expected: 200, data })).json();
  };
  const trialEnd = async (request: Req, id: string) =>
    new Date((await (await call(request, 'get', `/platform/tenants/${id}`, paula, { expected: 200 })).json()).trialEndsAt).getTime();

  test('[P-15/1-2] prévia mostra de-para e não grava', async ({ request }) => {
    const before = await trialEnd(request, a.id);
    const preview = await bulk(request, { action: 'trial', tenantIds: [a.id, b.id], days: 7, dryRun: true });
    expect(preview.dryRun).toBe(true);
    expect(preview.change).toHaveLength(2);
    const item = preview.change.find((c: { id: string }) => c.id === a.id);
    expect(new Date(item.to).getTime() - new Date(item.from).getTime()).toBe(7 * DAY);
    const other = await bulk(request, { action: 'trial', tenantIds: [a.id, b.id], days: 3, dryRun: true });
    const otherItem = other.change.find((c: { id: string }) => c.id === a.id);
    expect(new Date(otherItem.to).getTime() - new Date(otherItem.from).getTime()).toBe(3 * DAY);
    expect(await trialEnd(request, a.id)).toBe(before);
  });

  test('[P-15/3] aplicar soma 7 dias nas 2 empresas', async ({ request }) => {
    const [beforeA, beforeB] = [await trialEnd(request, a.id), await trialEnd(request, b.id)];
    const result = await bulk(request, { action: 'trial', tenantIds: [a.id, b.id], days: 7 });
    expect(result.dryRun).toBe(false);
    expect(result.change).toHaveLength(2);
    expect(result.failed).toEqual([]);
    expect(await trialEnd(request, a.id) - beforeA).toBe(7 * DAY);
    expect(await trialEnd(request, b.id) - beforeB).toBe(7 * DAY);
  });

  test('[P-15/4] trocar plano deixa de fora quem já está nele', async ({ request }) => {
    await setPlan(request, paula, a.id, planA.id);
    await setPlan(request, paula, b.id, planB.id);
    const preview = await bulk(request, { action: 'plan', tenantIds: [a.id, b.id], planId: planA.id, dryRun: true });
    expect(preview.skipped).toEqual([expect.objectContaining({ id: a.id, reason: 'same_plan' })]);
    expect(preview.change).toEqual([expect.objectContaining({ id: b.id, to: planA.name })]);
    const result = await bulk(request, { action: 'plan', tenantIds: [a.id, b.id], planId: planA.id });
    expect(result.change.map((c: { id: string }) => c.id)).toEqual([b.id]);
    const detail = await (await call(request, 'get', `/platform/tenants/${b.id}`, paula, { expected: 200 })).json();
    expect(detail.plan.id).toBe(planA.id);
  });

  test('[P-15/5] mover todos os clientes de um plano', async ({ request }) => {
    const from = await createPlan(request, paula, 'p15de', { maxUsers: 50 });
    const to = await createPlan(request, paula, 'p15para', { maxUsers: 50 });
    const tenant = await consoleTenant(request, paula, { planId: from.id });
    const preview = await bulk(request, { action: 'plan', fromPlanId: from.id, planId: to.id, dryRun: true });
    expect(preview.total).toBe(1);
    expect(preview.change.map((c: { id: string }) => c.id)).toEqual([tenant.id]);
    const result = await bulk(request, { action: 'plan', fromPlanId: from.id, planId: to.id });
    expect(result.change).toHaveLength(1);
    const detail = await (await call(request, 'get', `/platform/tenants/${tenant.id}`, paula, { expected: 200 })).json();
    expect(detail.plan.id).toBe(to.id);
  });

  test('[P-15/6] data passada recusada já na prévia', async ({ request }) => {
    const { fabio } = await team(request);
    const tenant = await consoleTenant(request, paula);
    const response = await call(request, 'post', '/platform/tenants/bulk', fabio, {
      data: { action: 'lifecycle', tenantIds: [tenant.id], lifecycle: 'TRIAL', trialEndsAt: new Date(Date.now() - DAY).toISOString(), dryRun: true },
    });
    await expectError(response, 400, 'Fim do trial precisa ser no futuro');
  });

  test('[P-15/7] suporte não usa massa', async ({ request }) => {
    const { sergio } = await team(request);
    const response = await call(request, 'post', '/platform/tenants/bulk', sergio, {
      data: { action: 'trial', tenantIds: [a.id], days: 7, dryRun: true },
    });
    await expectError(response, 403, 'Sem permissao para esta acao');
  });
});

test.describe('P-16 situação do cliente', () => {
  let tenant: Tenant;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    tenant = await consoleTenant(request, await ownerStaff(request), { lifecycle: 'TRIAL' });
    await createClientsTable(request, tenant.owner);
    await createRecord(request, tenant.owner, 'Dado intacto');
    await team(request);
  });

  const lifecycle = async (request: Req, value: string) => {
    const { fabio } = await team(request);
    const response = await setLifecycle(request, fabio, tenant.id, value);
    expect(response.status(), await response.text()).toBe(200);
  };

  test('[P-16/2] pagamento pendente mantém o acesso', async ({ request }) => {
    await lifecycle(request, 'PAST_DUE');
    const body = await (await call(request, 'get', '/subscription', tenant.owner, { expected: 200 })).json();
    expect(body.lifecycle).toBe('PAST_DUE');
  });

  test('[P-16/3] suspenso corta a sessão aberta', async ({ request }) => {
    await lifecycle(request, 'SUSPENDED');
    const body = await expectError(await call(request, 'get', '/subscription', tenant.owner), 403, 'Tenant suspenso ou inativo');
    expect(body.code).toBe('TENANT_SUSPENDED');
  });

  test('[P-16/4] login com a empresa suspensa', async ({ request }) => {
    await lifecycle(request, 'SUSPENDED');
    await expectError(await rawLogin(request, tenant.ownerEmail), 401, 'Tenant suspenso ou inativo');
  });

  test('[P-16/5] entrar como com a empresa suspensa', async ({ request }) => {
    await lifecycle(request, 'SUSPENDED');
    const { sergio } = await team(request);
    const response = await call(request, 'post', `/platform/tenants/${tenant.id}/users/${tenant.owner.userId}/impersonate`, sergio);
    await expectError(response, 400, 'Tenant suspenso ou cancelado: reative antes de entrar como usuario');
  });

  test('[P-16/6] em teste com data passada', async ({ request }) => {
    const { fabio } = await team(request);
    const response = await setLifecycle(request, fabio, tenant.id, 'TRIAL', new Date(Date.now() - DAY).toISOString());
    await expectError(response, 400, 'Fim do trial precisa ser no futuro');
  });

  test('[P-16/7-8] ativo volta a entrar, dados intactos, conversão sobe', async ({ request }) => {
    const { fabio } = await team(request);
    const conversions = async () => (await (await call(request, 'get', '/platform/metrics', fabio, { expected: 200 })).json()).last30.current.conversions as number;
    const before = await conversions();
    await lifecycle(request, 'ACTIVE');
    const session = await loginUser(request, tenant.ownerEmail, tenant.slug);
    const records = await (await call(request, 'get', '/data/clientes?limit=10', session, { expected: 200 })).json();
    expect(records.data.map((r: { data: { nome: string } }) => r.data.nome)).toContain('Dado intacto');
    expect(await conversions()).toBe(before + 1);
  });
});

test.describe('P-17 limites do plano', () => {
  let paula: Session;
  let tenant: Tenant;
  let operatorId: string;
  let pending: Invite;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000);
    paula = await ownerStaff(request);
    tenant = await createTenant(request, paula);
    await createClientsTable(request, tenant.owner);
    for (let i = 1; i <= 5; i++) await createRecord(request, tenant.owner, `Registro ${i}`);
    operatorId = roleId(await listRoles(request, tenant.owner), 'Operador');
    const second = await invite(request, tenant.owner, operatorId, 'p17-segunda');
    const accepted = await acceptInvite(request, second.token, { name: 'Segunda', password: PASSWORD });
    expect(accepted.status(), await accepted.text()).toBe(200);
    pending = await invite(request, tenant.owner, operatorId, 'p17-pendente');
    const plan = await createPlan(request, paula, 'p17', { maxUsers: 2, maxRecords: 5 }, {
      chat: false, pdf: false, publicLinks: false, automations: true, webhooks: true, mobile: true,
    });
    await setPlan(request, paula, tenant.id, plan.id);
  });

  test('[P-17] 6º registro', async ({ request }) => {
    const response = await call(request, 'post', '/data/clientes', tenant.owner, { data: { data: { nome: 'Registro 6' } } });
    const body = await expectError(response, 403, 'Limite de registros do plano atingido (5)');
    expect(body.code).toBe('PLAN_LIMIT');
  });


  test('[P-17] convite com o plano cheio é recusado', async ({ request }) => {
    const response = await call(request, 'post', '/invitations', tenant.owner, { data: { email: qaEmail('p17-terceira'), customRoleId: operatorId } });
    await expectError(response, 403, 'Limite de usuarios do plano atingido (2)');
  });

  test('[P-17] convite feito antes de lotar: aceite barrado pelo limite', async ({ request }) => {
    const response = await acceptInvite(request, pending.token, { name: 'Terceira', password: PASSWORD });
    const body = await expectError(response, 403, 'Limite de usuarios do plano atingido (2)');
    expect(body.code).toBe('PLAN_LIMIT');
  });

  // Tela: menus somem. Na API, as funções desligadas e o bloqueio das rotas.
  test('[P-17] chat, PDF e links públicos fora do plano', async ({ request }) => {
    const subscription = await (await call(request, 'get', '/subscription', tenant.owner, { expected: 200 })).json();
    expect(subscription.features).toMatchObject({ chat: false, pdf: false, publicLinks: false, mobile: true });
    for (const path of ['/chat/channels', '/pdf-templates', '/public-links']) {
      const body = await expectError(await call(request, 'get', path, tenant.owner), 403, /.+/);
      expect(body.code, path).toBe('FEATURE_DISABLED');
    }
  });
});

// ── Administração da empresa ────────────────────────────────────────────────

test.describe('E-05 política de segurança', () => {
  let tenant: Tenant;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
  });

  test('[E-05/1] salva tamanho mínimo e símbolo', async ({ request }) => {
    const saved = await (await call(request, 'patch', '/security/policy', tenant.owner, { expected: 200, data: { passwordMinLength: 10, passwordRequireSymbol: true } })).json();
    expect(saved).toMatchObject({ passwordMinLength: 10, passwordRequireSymbol: true, requireMfa: false });
    const read = await (await call(request, 'get', '/security/policy', tenant.owner, { expected: 200 })).json();
    expect(read).toMatchObject({ passwordMinLength: 10, passwordRequireSymbol: true });
  });

  test('[E-05/2] exigir duas etapas sem ter ativado', async ({ request }) => {
    const response = await call(request, 'patch', '/security/policy', tenant.owner, { data: { requireMfa: true } });
    await expectError(response, 400, 'Ative a verificacao em duas etapas na sua conta antes de exigir da equipe');
  });
});

test.describe('E-07 cargos', () => {
  let tenant: Tenant;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
  });

  test('[E-07/3] nome repetido', async ({ request }) => {
    const response = await call(request, 'post', '/custom-roles', tenant.owner, { data: { name: 'Gerente', modulePermissions: {}, permissions: [] } });
    await expectError(response, 409, 'Já existe uma role com este nome');
  });

  test('[E-08/19] excluir cargo com usuários', async ({ request }) => {
    const role = await (await call(request, 'post', '/custom-roles', tenant.owner, {
      expected: [200, 201], data: { name: `QA Com Gente ${suffix()}`, modulePermissions: {}, permissions: [] },
    })).json();
    await createPerson(request, tenant.owner, tenant.slug, 'Membro', role.id);
    const response = await call(request, 'delete', `/custom-roles/${role.id}`, tenant.owner);
    await expectError(response, 409, 'Esta role esta atribuida a 1 usuario(s). Reassine-os antes de excluir.');
  });
});

test.describe('E-08 convites', () => {
  let tenant: Tenant;
  let adminId: string;
  let operatorId: string;
  let member: { email: string } | undefined;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    tenant = await createTenant(request, await ownerStaff(request));
    const roles = await listRoles(request, tenant.owner);
    adminId = roleId(roles, 'Administrador');
    operatorId = roleId(roles, 'Operador');
  });

  const publicInfo = async (request: Req, token: string) => request.get(`${API}/invitations/public/${token}`);

  test('[E-08/6] convite já usado', async ({ request }) => {
    const alex = await invite(request, tenant.owner, adminId, 'e08-alex');
    const accepted = await acceptInvite(request, alex.token, { name: 'Alex', password: PASSWORD });
    expect(accepted.status(), await accepted.text()).toBe(200);
    expect((await accepted.json()).user.email).toBe(alex.email);
    member = alex;
    // A tela escolhe "Este convite já foi usado..." pelo status do convite.
    const info = await publicInfo(request, alex.token);
    expect((await info.json()).status).toBe('accepted');
    await expectError(await acceptInvite(request, alex.token, { name: 'Alex', password: PASSWORD }), 409, 'Este convite ja foi usado');
  });

  test('[E-08/8] convidar quem já é da empresa', async ({ request }) => {
    const email = member?.email ?? tenant.ownerEmail;
    const response = await call(request, 'post', '/invitations', tenant.owner, { data: { email, customRoleId: adminId } });
    await expectError(response, 409, 'Esta pessoa ja faz parte da empresa');
  });

  test('[E-08/9] reenviar invalida o link antigo', async ({ request }) => {
    const first = await invite(request, tenant.owner, operatorId, 'e08-resend');
    const resent = await (await call(request, 'post', `/invitations/${first.id}/resend`, tenant.owner, { expected: 200 })).json();
    const token = resent.link.split('/invite/')[1];
    expect(token).not.toBe(first.token);
    await expectError(await publicInfo(request, first.token), 404, 'Convite invalido');
    expect((await (await publicInfo(request, token)).json()).status).toBe('pending');
  });

  test('[E-08/10] cancelar invalida o link', async ({ request }) => {
    const pending = await invite(request, tenant.owner, operatorId, 'e08-cancel');
    await call(request, 'delete', `/invitations/${pending.id}`, tenant.owner, { expected: 200 });
    // A tela escolhe "Este convite foi cancelado." pelo status do convite.
    expect((await (await publicInfo(request, pending.token)).json()).status).toBe('revoked');
    const response = await acceptInvite(request, pending.token, { name: 'Cancelado', password: PASSWORD });
    await expectError(response, 410, 'Este convite expirou ou foi cancelado. Peca um novo ao administrador.');
  });

  test('[E-08/13] novo usuário sem senha', async ({ request }) => {
    const response = await call(request, 'post', '/users', tenant.owner, { data: { email: qaEmail('e08-sem-senha'), name: 'Sem Senha', customRoleId: operatorId } });
    const body = await expectError(response, 400, 'Erro de validacao');
    expect(body.errors.join(' ')).toContain('Senha');
  });
});

test.describe('E-08 limite de usuários do plano', () => {
  let tenant: Tenant;
  let vera: Session;
  let operatorId: string;
  let pending: Invite;
  let accepted: string | undefined;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    const paula = await ownerStaff(request);
    const plan = await createPlan(request, paula, 'e08', { maxUsers: 3 });
    tenant = await consoleTenant(request, paula, { planId: plan.id });
    const roles = await listRoles(request, tenant.owner);
    operatorId = roleId(roles, 'Operador');
    vera = await createPerson(request, tenant.owner, tenant.slug, 'Vera', roleId(roles, 'Visualizador'));
    pending = await invite(request, tenant.owner, operatorId, 'e08-limite');
    await createPerson(request, tenant.owner, tenant.slug, 'Gil', roleId(roles, 'Gerente'));
  });

  const setVera = (request: Req, status: string) => call(request, 'patch', `/users/${vera.userId}`, tenant.owner, { data: { status } });


  test('[E-08/16] convite com o plano cheio é recusado', async ({ request }) => {
    const response = await call(request, 'post', '/invitations', tenant.owner, { data: { email: qaEmail('e08-cheio'), customRoleId: operatorId } });
    await expectError(response, 403, 'Limite de usuarios do plano atingido (3)');
  });

  test('[E-08/16] convite feito antes de lotar: aceite barrado pelo limite', async ({ request }) => {
    const response = await acceptInvite(request, pending.token, { name: 'Excedente', password: PASSWORD });
    await expectError(response, 403, 'Limite de usuarios do plano atingido (3)');
  });

  const fillVacancyAndBlockVera = async (request: Req) => {
    const off = await setVera(request, 'INACTIVE');
    expect(off.status(), await off.text()).toBe(200);
    const response = await acceptInvite(request, pending.token, { name: 'Excedente', password: PASSWORD });
    expect(response.status(), await response.text()).toBe(200);
    accepted = (await response.json()).user.id;
    await expectError(await setVera(request, 'ACTIVE'), 403, 'Limite de usuarios do plano atingido (3)');
  };

  test('[E-08/17] desativar libera a vaga e reativar acusa o limite', async ({ request }) => {
    await fillVacancyAndBlockVera(request);
  });

  test('[E-08/18] excluir libera a vaga e a Vera volta', async ({ request }) => {
    if (!accepted) await fillVacancyAndBlockVera(request);
    await call(request, 'delete', `/users/${accepted}`, tenant.owner, { expected: 200 });
    const on = await setVera(request, 'ACTIVE');
    expect(on.status(), await on.text()).toBe(200);
    await call(request, 'get', '/auth/me', await loginUser(request, vera.email!, tenant.slug), { expected: 200 });
  });
});

test.describe('E-09 proteções do dono', () => {
  let tenant: Tenant;
  let alex: Session;
  let otherAdmin: Session;
  let adminRoleId: string;
  const RANK_DENIED = 'Acesso negado: voce so age sobre cargos de rank inferior (numero maior) ao seu (10)';

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    tenant = await createTenant(request, await ownerStaff(request));
    const roles = await listRoles(request, tenant.owner);
    adminRoleId = roleId(roles, 'Administrador');
    alex = await createPerson(request, tenant.owner, tenant.slug, 'Alex', adminRoleId);
    otherAdmin = await createPerson(request, tenant.owner, tenant.slug, 'Temporario', adminRoleId);
  });

  test.afterAll(async ({ request }) => {
    await call(request, 'delete', `/users/${otherAdmin.userId}`, tenant.owner);
  });

  test('[E-09] Alex não edita nem exclui o dono', async ({ request }) => {
    const message = 'O dono da empresa so pode ser alterado por ele mesmo';
    await expectError(await call(request, 'patch', `/users/${tenant.owner.userId}`, alex, { data: { name: 'Trocado' } }), 403, message);
    await expectError(await call(request, 'delete', `/users/${tenant.owner.userId}`, alex), 403, message);
  });

  test('[E-09] Alex não gere outro administrador', async ({ request }) => {
    await expectError(await call(request, 'patch', `/users/${otherAdmin.userId}`, alex, { data: { name: 'Trocado' } }), 403, RANK_DENIED);
    await expectError(await call(request, 'delete', `/users/${otherAdmin.userId}`, alex), 403, RANK_DENIED);
  });

  test('[E-09] Alex não salva o cargo Administrador', async ({ request }) => {
    const response = await call(request, 'patch', `/custom-roles/${adminRoleId}`, alex, { data: { description: 'editado' } });
    await expectError(response, 403, RANK_DENIED);
  });

  test('[E-09] Alex não transfere a propriedade', async ({ request }) => {
    const status = await (await call(request, 'get', '/privacy/company', alex, { expected: 200 })).json();
    expect(status.isOwner).toBe(false);
    const response = await call(request, 'patch', '/tenants/me/owner', alex, { data: { userId: alex.userId } });
    await expectError(response, 403, 'So o dono da empresa pode transferir a propriedade');
  });

  // Tela: "Somente o dono da empresa pode encerrar a conta." vem do i18n da web quando isOwner=false.
  test('[E-09] Alex exporta, mas não encerra', async ({ request }) => {
    const status = await (await call(request, 'get', '/privacy/company', alex, { expected: 200 })).json();
    expect(status.canExport).toBe(true);
    const exported = await call(request, 'get', '/privacy/company/export', alex, { expected: 200 });
    expect(exported.headers()['content-type']).toContain('application/zip');
    const response = await call(request, 'post', '/privacy/company/close', alex, { data: { password: PASSWORD, confirmName: tenant.name } });
    await expectError(response, 403, 'Somente o dono pode encerrar a conta da empresa');
  });
});

test.describe('E-10 equipes', () => {
  let tenant: Tenant;
  let ana: Session;
  let bruno: Session;
  let carla: Session;
  const teams: Record<string, string> = {};

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    tenant = await createTenant(request, await ownerStaff(request));
    const operatorId = roleId(await listRoles(request, tenant.owner), 'Operador');
    ana = await createPerson(request, tenant.owner, tenant.slug, 'Ana', operatorId);
    bruno = await createPerson(request, tenant.owner, tenant.slug, 'Bruno', operatorId);
    carla = await createPerson(request, tenant.owner, tenant.slug, 'Carla', operatorId);
  });

  const ensureTeam = async (request: Req, name: string, color?: string) => {
    teams[name] ??= (await (await call(request, 'post', '/teams', tenant.owner, { expected: [200, 201], data: { name, ...(color ? { color } : {}) } })).json()).id;
    return teams[name];
  };
  const setMembers = (request: Req, id: string, members: Array<{ userId?: string; isLeader?: boolean }>) =>
    call(request, 'put', `/teams/${id}/members`, tenant.owner, { expected: 200, data: { members } });

  test('[E-10/1] nova equipe', async ({ request }) => {
    expect(await ensureTeam(request, 'Norte', '#2563eb')).toBeTruthy();
  });

  test('[E-10/2] nome repetido', async ({ request }) => {
    await ensureTeam(request, 'Norte', '#2563eb');
    await expectError(await call(request, 'post', '/teams', tenant.owner, { data: { name: 'Norte' } }), 409, 'Ja existe uma equipe com esse nome');
  });

  test('[E-10/3] segunda equipe', async ({ request }) => {
    expect(await ensureTeam(request, 'Sul')).toBeTruthy();
  });

  test('[E-10/4] membros com líder', async ({ request }) => {
    const id = await ensureTeam(request, 'Norte', '#2563eb');
    const body = await (await setMembers(request, id, [{ userId: ana.userId }, { userId: bruno.userId, isLeader: true }])).json();
    expect(JSON.stringify(body)).toContain(bruno.userId!);
    const users = await (await call(request, 'get', `/users?teamId=${id}`, tenant.owner, { expected: 200 })).json();
    const brunoRow = users.data.find((u: { id: string }) => u.id === bruno.userId);
    expect(brunoRow.teams.find((t: { id: string }) => t.id === id).isLeader).toBe(true);
    const anaRow = users.data.find((u: { id: string }) => u.id === ana.userId);
    expect(anaRow.teams.find((t: { id: string }) => t.id === id).isLeader).toBe(false);
  });

  test('[E-10/5] Sul com a Carla', async ({ request }) => {
    const id = await ensureTeam(request, 'Sul');
    await setMembers(request, id, [{ userId: carla.userId }]);
    const users = await (await call(request, 'get', `/users?teamId=${id}`, tenant.owner, { expected: 200 })).json();
    expect(users.data.map((u: { id: string }) => u.id)).toEqual([carla.userId]);
  });

  test('[E-10/6] selos e filtro por equipe na lista', async ({ request }) => {
    const north = await ensureTeam(request, 'Norte', '#2563eb');
    const south = await ensureTeam(request, 'Sul');
    await setMembers(request, north, [{ userId: ana.userId }, { userId: bruno.userId, isLeader: true }]);
    await setMembers(request, south, [{ userId: carla.userId }]);
    const ids = async (query: string) => {
      const body = await (await call(request, 'get', `/users?limit=100${query}`, tenant.owner, { expected: 200 })).json();
      return body;
    };
    const all = await ids('');
    expect(all.data.find((u: { id: string }) => u.id === carla.userId).teams.map((t: { name: string }) => t.name)).toEqual(['Sul']);
    const northIds = (await ids(`&teamId=${north}`)).data.map((u: { id: string }) => u.id).sort();
    expect(northIds).toEqual([ana.userId, bruno.userId].sort());
    expect((await ids(`&teamId=${south}`)).data.map((u: { id: string }) => u.id)).toEqual([carla.userId]);
  });
});

test.describe('E-14 chaves de API', () => {
  let tenant: Tenant;
  let managerId: string;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    await createClientsTable(request, tenant.owner);
    await createRecord(request, tenant.owner, 'Cliente Chave');
    managerId = roleId(await listRoles(request, tenant.owner), 'Gerente');
  });

  const createKey = async (request: Req) =>
    (await call(request, 'post', '/api-keys', tenant.owner, { expected: [200, 201], data: { name: 'ERP QA', customRoleId: managerId, expiresInDays: 30 } })).json();
  const withKey = (request: Req, key: string, path: string) => request.get(`${API}${path}`, { headers: { 'X-API-Key': key } });

  test('[E-14/1] chave criada com validade', async ({ request }) => {
    const created = await createKey(request);
    expect(created.key.startsWith('crm_')).toBe(true);
    const days = (new Date(created.expiresAt).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(29);
    // Margem para a diferença de relógio entre esta máquina e o servidor.
    expect(days).toBeLessThan(30.01);
  });

  test('[E-14/2] chave lista registros', async ({ request }) => {
    const created = await createKey(request);
    const response = await withKey(request, created.key, '/data/clientes');
    expect(response.status()).toBe(200);
    expect((await response.json()).data.map((r: { data: { nome: string } }) => r.data.nome)).toContain('Cliente Chave');
  });

  test('[E-14/3] chave não acessa usuários', async ({ request }) => {
    const created = await createKey(request);
    await expectError(await withKey(request, created.key, '/users'), 403, 'Chave de API so acessa registros, tabelas e upload');
  });

  test('[E-14/4] chave revogada', async ({ request }) => {
    const created = await createKey(request);
    await call(request, 'delete', `/api-keys/${created.id}`, tenant.owner, { expected: 200 });
    await expectError(await withKey(request, created.key, '/data/clientes'), 401, 'Chave de API invalida ou revogada');
  });
});

test.describe('E-15 webhooks', () => {
  let tenant: Tenant;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
  });

  const tryUrl = (request: Req, url: string) =>
    call(request, 'post', '/webhooks', tenant.owner, { data: { name: 'QA', url, events: ['created'] } });

  test('[E-15/1] localhost bloqueado', async ({ request }) => {
    await expectError(await tryUrl(request, 'http://localhost:8080/x'), 400, 'A URL aponta para um endereco interno');
  });

  test('[E-15/2] endereço de metadados bloqueado', async ({ request }) => {
    await expectError(await tryUrl(request, 'http://169.254.169.254/latest'), 400, 'A URL aponta para um endereco interno');
  });

  test('[E-15/3] protocolo ftp', async ({ request }) => {
    await expectError(await tryUrl(request, 'ftp://exemplo.com'), 400, 'A URL precisa comecar com http:// ou https://');
  });
});

test.describe('E-18 transferência de dono', () => {
  let tenant: Tenant;
  let alex: Session;
  let gil: Session;
  let current: Session;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    tenant = await createTenant(request, await ownerStaff(request));
    const roles = await listRoles(request, tenant.owner);
    alex = await createPerson(request, tenant.owner, tenant.slug, 'Alex', roleId(roles, 'Administrador'));
    gil = await createPerson(request, tenant.owner, tenant.slug, 'Gil', roleId(roles, 'Gerente'));
    current = tenant.owner;
  });

  const ownerIs = async (request: Req, userId: string) => {
    const detail = await (await call(request, 'get', `/platform/tenants/${tenant.id}`, await ownerStaff(request), { expected: 200 })).json();
    expect(detail.owner.id).toBe(userId);
  };
  const transfer = async (request: Req, to: Session) => {
    if (current.userId === to.userId) return;
    const body = await (await call(request, 'patch', '/tenants/me/owner', current, { expected: 200, data: { userId: to.userId } })).json();
    expect(body.ownerId).toBe(to.userId);
    current = to;
  };

  test('[E-18/1] novo dono sem acesso total', async ({ request }) => {
    const response = await call(request, 'patch', '/tenants/me/owner', current, { data: { userId: gil.userId } });
    await expectError(response, 400, 'O novo dono precisa estar num cargo com acesso total (ex.: Administrador)');
  });

  test('[E-18/2] transfere para o Alex', async ({ request }) => {
    await transfer(request, alex);
    await ownerIs(request, alex.userId!);
  });

  test('[E-18/3] ex-dona não exclui o novo dono', async ({ request }) => {
    await transfer(request, alex);
    const response = await call(request, 'delete', `/users/${alex.userId}`, tenant.owner);
    await expectError(response, 403, 'O dono da empresa so pode ser alterado por ele mesmo');
  });

  test('[E-18/4] Alex devolve', async ({ request }) => {
    await transfer(request, alex);
    await transfer(request, tenant.owner);
    await ownerIs(request, tenant.owner.userId!);
  });
});

// ── Operação ────────────────────────────────────────────────────────────────

test.describe('O-11 lixeira', () => {
  let tenant: Tenant;
  let ana: Session;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    tenant = await createTenant(request, await ownerStaff(request));
    await call(request, 'post', '/entities', tenant.owner, {
      expected: [200, 201],
      data: { name: 'Visitas', slug: 'visitas', fields: [{ slug: 'resumo', name: 'Resumo', type: 'text' }] },
    });
    await call(request, 'post', '/entities', tenant.owner, {
      expected: [200, 201],
      data: {
        name: 'Clientes', slug: 'clientes',
        fields: [{ slug: 'nome', name: 'Nome', type: 'text' }, { slug: 'visitas', name: 'Visitas', type: 'sub-entity', subEntitySlug: 'visitas' }],
      },
    });
    ana = await createPerson(request, tenant.owner, tenant.slug, 'Ana', roleId(await listRoles(request, tenant.owner), 'Operador'));
  });

  const client = async (request: Req, nome: string): Promise<string> =>
    (await (await call(request, 'post', '/data/clientes', tenant.owner, { expected: [200, 201], data: { data: { nome } } })).json()).id;
  const visit = async (request: Req, parentRecordId: string, resumo: string): Promise<string> =>
    (await (await call(request, 'post', '/data/visitas', tenant.owner, { expected: [200, 201], data: { data: { resumo }, parentRecordId } })).json()).id;
  const remove = (request: Req, slug: string, id: string) => call(request, 'delete', `/data/${slug}/${id}`, tenant.owner, { expected: 200 });
  const trash = async (request: Req, query = '', session: Session = tenant.owner) =>
    (await call(request, 'get', `/trash?limit=100${query}`, session, { expected: 200 })).json();
  const inTrash = (body: { data: Array<{ id: string }> }, id: string) => body.data.find((item) => item.id === id);

  test('[O-11/1] item mostra quem excluiu e os sub-registros', async ({ request }) => {
    const id = await client(request, `Cliente Um ${suffix()}`);
    await visit(request, id, 'Visita um');
    await remove(request, 'clientes', id);
    const item = inTrash(await trash(request), id) as unknown as { deletedBy: { name: string }; subRecords: number; entity: { slug: string } };
    expect(item.deletedBy.name).toBe('Dono QA');
    expect(item.subRecords).toBe(1);
    expect(item.entity.slug).toBe('clientes');
  });

  test('[O-11/2] busca e filtro por tabela', async ({ request }) => {
    const marker = `Procurado${suffix()}`;
    const id = await client(request, marker);
    await remove(request, 'clientes', id);
    expect(inTrash(await trash(request, `&search=${marker}`), id)).toBeTruthy();
    expect((await trash(request, `&search=naoexiste${suffix()}`)).data).toEqual([]);
    expect(inTrash(await trash(request, '&entitySlug=clientes'), id)).toBeTruthy();
    expect(inTrash(await trash(request, '&entitySlug=visitas'), id)).toBeFalsy();
    const tables = await (await call(request, 'get', '/trash/tables', tenant.owner, { expected: 200 })).json();
    expect(tables.find((t: { slug: string }) => t.slug === 'clientes').count).toBeGreaterThanOrEqual(1);
  });

  test('[O-11/3] restaurar traz os sub-registros', async ({ request }) => {
    const id = await client(request, `Cliente Tres ${suffix()}`);
    await visit(request, id, 'Visita tres');
    await remove(request, 'clientes', id);
    const body = await (await call(request, 'post', `/trash/clientes/${id}/restore`, tenant.owner, { expected: 200 })).json();
    expect(body.restored).toBe(2);
    expect(inTrash(await trash(request), id)).toBeFalsy();
    await call(request, 'get', `/data/clientes/${id}`, tenant.owner, { expected: 200 });
  });

  test('[O-11/4] visita excluída antes fica separada e não restaura antes do pai', async ({ request }) => {
    const id = await client(request, `Cliente Quatro ${suffix()}`);
    const visitId = await visit(request, id, 'Visita quatro');
    await remove(request, 'visitas', visitId);
    await sleep(50);
    await remove(request, 'clientes', id);
    const early = await call(request, 'post', `/trash/visitas/${visitId}/restore`, tenant.owner);
    const body = await expectError(early, 400, 'O registro principal tambem esta na lixeira: restaure ele primeiro');
    expect(body.code).toBe('PARENT_DELETED');
    const restored = await (await call(request, 'post', `/trash/clientes/${id}/restore`, tenant.owner, { expected: 200 })).json();
    expect(restored.restored).toBe(1);
    const item = inTrash(await trash(request), visitId) as unknown as { isSubRecord: boolean };
    expect(item.isSubRecord).toBe(true);
  });

  test('[O-11/5] apagar de vez', async ({ request }) => {
    const id = await client(request, `Cliente Cinco ${suffix()}`);
    await remove(request, 'clientes', id);
    await call(request, 'delete', `/trash/clientes/${id}`, tenant.owner, { expected: 200 });
    expect(inTrash(await trash(request), id)).toBeFalsy();
    await expectError(await call(request, 'post', `/trash/clientes/${id}/restore`, tenant.owner), 404, 'Registro soft-deletado nao encontrado');
  });

  test('[O-11/6] prazo de 30 dias', async ({ request }) => {
    const saved = await (await call(request, 'patch', '/trash/settings', tenant.owner, { expected: 200, data: { retentionDays: 30 } })).json();
    expect(saved.retentionDays).toBe(30);
    expect((await trash(request)).retentionDays).toBe(30);
    await call(request, 'patch', '/trash/settings', tenant.owner, { expected: 200, data: { retentionDays: null } });
  });

  test('[O-11/8] Ana (sem excluir) vê a lixeira vazia', async ({ request }) => {
    const id = await client(request, `Cliente Oito ${suffix()}`);
    await remove(request, 'clientes', id);
    const body = await trash(request, '', ana);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  test('[O-11/7] esvaziar', async ({ request }) => {
    const id = await client(request, `Cliente Sete ${suffix()}`);
    await remove(request, 'clientes', id);
    const body = await (await call(request, 'post', '/trash/empty', tenant.owner, { expected: 200, data: {} })).json();
    expect(body.purged).toBeGreaterThanOrEqual(1);
    expect((await trash(request)).data).toEqual([]);
  });

  test('[O-11/9] restaurar com o plano no limite', async ({ request }) => {
    const paula = await ownerStaff(request);
    const plan = await createPlan(request, paula, 'o11', { maxRecords: 2 });
    const limited = await consoleTenant(request, paula, { planId: plan.id });
    await createClientsTable(request, limited.owner);
    const first = await createRecord(request, limited.owner, 'Primeiro');
    await createRecord(request, limited.owner, 'Segundo');
    await call(request, 'delete', `/data/clientes/${first}`, limited.owner, { expected: 200 });
    await createRecord(request, limited.owner, 'Terceiro');
    const response = await call(request, 'post', `/trash/clientes/${first}/restore`, limited.owner);
    await expectError(response, 403, 'Limite de registros do plano atingido (2)');
  });
});

test.describe('O-18 link público', () => {
  let tenant: Tenant;
  let link: { id: string; slug: string };
  let usersBefore: number;
  const visitors: Session[] = [];

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    await createClientsTable(request, tenant.owner);
    link = await (await call(request, 'post', '/public-links', tenant.owner, {
      expected: [200, 201], data: { name: 'Cadastro de visitantes', entitySlug: 'clientes', maxUsers: 2 },
    })).json();
    usersBefore = (await (await call(request, 'get', '/subscription', tenant.owner, { expected: 200 })).json()).usage.users;
  });

  const register = (request: Req, extra: Record<string, unknown> = {}) =>
    linkRegister(request, link.slug, { name: 'Visitante', email: qaEmail('o18'), password: PASSWORD, ...extra });

  const ensureVisitors = async (request: Req, count: number) => {
    while (visitors.length < count) {
      const response = await register(request);
      expect(response.status(), await response.text()).toBe(201);
      visitors.push({ token: (await response.json()).accessToken, slug: tenant.slug });
    }
    return visitors;
  };

  test('[O-18/1] dados públicos do link', async ({ request }) => {
    const response = await request.get(`${API}/p/${link.slug}`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'Cadastro de visitantes', entitySlug: 'clientes', tenantName: tenant.name });
  });

  test('[O-18/2] CPF inválido', async ({ request }) => {
    await expectError(await register(request, { cpf: '12345678900' }), 400, 'CPF invalido');
  });

  test('[O-18/3] cadastro válido entra sem registros', async ({ request }) => {
    const [visitor] = await ensureVisitors(request, 1);
    const body = await (await call(request, 'get', '/data/clientes', visitor, { expected: 200 })).json();
    expect(body.data).toEqual([]);
  });

  test('[O-18/4] registro aparece no link e para o dono', async ({ request }) => {
    const [visitor] = await ensureVisitors(request, 1);
    const created = await (await call(request, 'post', '/data/clientes', visitor, { expected: [200, 201], data: { data: { nome: 'Do visitante' } } })).json();
    const own = await (await call(request, 'get', '/data/clientes', visitor, { expected: 200 })).json();
    expect(own.data.map((r: { id: string }) => r.id)).toContain(created.id);
    const all = await (await call(request, 'get', '/data/clientes', tenant.owner, { expected: 200 })).json();
    expect(all.data.map((r: { id: string }) => r.id)).toContain(created.id);
  });

  test('[O-18/5] segundo cadastro passa e o terceiro não', async ({ request }) => {
    await ensureVisitors(request, 2);
    await expectError(await register(request), 400, 'Limite de registros atingido para este link');
  });

  test('[O-18/7] cadastros do link não contam no plano', async ({ request }) => {
    await ensureVisitors(request, 1);
    const body = await (await call(request, 'get', '/subscription', tenant.owner, { expected: 200 })).json();
    expect(body.usage.users).toBe(usersBefore);
  });

  test('[O-18/6] link desativado', async ({ request }) => {
    await call(request, 'patch', `/public-links/${link.id}`, tenant.owner, { expected: 200, data: { isActive: false } });
    await expectError(await request.get(`${API}/p/${link.slug}`), 400, 'Este link esta desativado');
  });
});

// ── Segurança da conta ──────────────────────────────────────────────────────

test.describe('S-01 duas etapas', () => {
  let tenant: Tenant;
  let mfa: { secret: string; recoveryCodes: string[] } | undefined;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
  });

  const ensureMfa = async (request: Req) => {
    mfa ??= await enableMfa(request, tenant.owner);
    return mfa;
  };
  const firstStep = async (request: Req): Promise<string> => {
    const response = await rawLogin(request, tenant.ownerEmail);
    expect(response.status(), 'primeira etapa do login').toBe(200);
    const body = await response.json();
    expect(body.mfaRequired).toBe(true);
    expect(body.accessToken).toBeUndefined();
    return body.mfaToken;
  };

  // Precisa vir antes de ativar: depois, /mfa/setup recusa.
  test('[S-01/1-2] QR, chave manual e código errado', async ({ request }) => {
    const setup = await (await call(request, 'post', '/auth/mfa/setup', tenant.owner, { expected: 200 })).json();
    expect(setup.secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(setup.otpauthUrl).toContain('otpauth://totp/');
    expect(setup.qrDataUrl).toContain('data:image/png');
    const response = await call(request, 'post', '/auth/mfa/enable', tenant.owner, { data: { code: '000000' } });
    await expectError(response, 400, 'Codigo invalido. Confira o horario do celular e tente de novo.');
  });

  test('[S-01/3] código certo ativa e entrega 10 códigos', async ({ request }) => {
    const enabled = await ensureMfa(request);
    expect(enabled.recoveryCodes).toHaveLength(10);
    const status = await (await call(request, 'get', '/auth/mfa', tenant.owner, { expected: 200 })).json();
    expect(status).toMatchObject({ enabled: true, recoveryCodesLeft: 10 });
  });

  test('[S-01/4] login pede o código de 6 dígitos', async ({ request }) => {
    const { secret } = await ensureMfa(request);
    const token = await firstStep(request);
    const response = await mfaStep(request, token, totp(secret));
    expect(response.status(), 'segunda etapa com TOTP').toBe(200);
    expect((await response.json()).accessToken).toBeTruthy();
  });

  test('[S-01/5] código de recuperação vale uma vez', async ({ request }) => {
    const { recoveryCodes } = await ensureMfa(request);
    const code = recoveryCodes[0];
    const first = await mfaStep(request, await firstStep(request), code);
    expect(first.status(), 'recuperação no primeiro uso').toBe(200);
    await expectError(await mfaStep(request, await firstStep(request), code), 401, 'Codigo invalido');
  });

  test('[S-01/7] gerar novos códigos invalida os antigos', async ({ request }) => {
    const current = await ensureMfa(request);
    const old = current.recoveryCodes[1];
    const renewed = await (await call(request, 'post', '/auth/mfa/recovery-codes', tenant.owner, { expected: 200, data: { code: totp(current.secret) } })).json();
    expect(renewed.recoveryCodes).toHaveLength(10);
    await expectError(await mfaStep(request, await firstStep(request), old), 401, 'Codigo invalido');
    const fresh = await mfaStep(request, await firstStep(request), renewed.recoveryCodes[0]);
    expect(fresh.status(), 'código novo').toBe(200);
  });

  // Espera os 5 minutos de verdade.
  test('[S-01/6] etapa de verificação expira em 5 minutos', async ({ request }) => {
    test.setTimeout(400_000);
    const { secret } = await ensureMfa(request);
    const token = await firstStep(request);
    await sleep(5 * 60_000 + 5_000);
    await expectError(await mfaStep(request, token, totp(secret)), 401, 'Etapa de verificacao expirada. Entre de novo.');
  });
});

test.describe('S-02 exigir duas etapas', () => {
  let tenant: Tenant;
  let vera: Session;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    vera = await createPerson(request, tenant.owner, tenant.slug, 'Vera', roleId(await listRoles(request, tenant.owner), 'Visualizador'));
    await enableMfa(request, tenant.owner);
  });

  test.afterAll(async ({ request }) => {
    await call(request, 'patch', '/security/policy', tenant.owner, { data: { requireMfa: false } });
  });

  test('[S-02/1-3] exigência barra quem não ativou, menos em /auth', async ({ request }) => {
    const saved = await (await call(request, 'patch', '/security/policy', tenant.owner, { expected: 200, data: { requireMfa: true } })).json();
    expect(saved.requireMfa).toBe(true);
    const response = await call(request, 'get', '/notifications', vera);
    const body = await expectError(response, 403, 'Esta empresa exige verificacao em duas etapas. Ative para continuar.');
    expect(body.code).toBe('MFA_SETUP_REQUIRED');
    await call(request, 'get', '/auth/me', vera, { expected: 200 });
    await call(request, 'get', '/notifications', tenant.owner, { expected: 200 });
  });

  test('[S-02/4-5] Vera ativa e segue; desligar libera', async ({ request }) => {
    await call(request, 'patch', '/security/policy', tenant.owner, { expected: 200, data: { requireMfa: true } });
    await enableMfa(request, vera);
    await call(request, 'get', '/notifications', vera, { expected: 200 });
    const saved = await (await call(request, 'patch', '/security/policy', tenant.owner, { expected: 200, data: { requireMfa: false } })).json();
    expect(saved.requireMfa).toBe(false);
  });
});

test.describe('S-03 aparelhos conectados', () => {
  let tenant: Tenant;
  let managerId: string;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    managerId = roleId(await listRoles(request, tenant.owner), 'Gerente');
  });

  const gil = (request: Req) => createPerson(request, tenant.owner, tenant.slug, 'Gil', managerId);
  const again = (request: Req, session: Session) => loginUser(request, session.email!, tenant.slug);
  const sessions = async (request: Req, session: Session) =>
    (await call(request, 'get', '/auth/sessions', session, { expected: 200 })).json() as Promise<Array<{ id: string; current: boolean }>>;
  const dropped = (request: Req, session: Session) =>
    expect.poll(async () => (await call(request, 'get', '/auth/me', session)).status(), { timeout: 15_000, intervals: [500, 1_000, 2_000] }).toBe(401);

  test('[S-03/1] lista os aparelhos e marca o atual', async ({ request }) => {
    const first = await gil(request);
    const second = await again(request, first);
    await again(request, first);
    const list = await sessions(request, second);
    expect(list).toHaveLength(3);
    expect(list.filter((s) => s.current)).toHaveLength(1);
  });

  test('[S-03/2] encerrar o outro aparelho', async ({ request }) => {
    const first = await gil(request);
    const second = await again(request, first);
    const otherId = (await sessions(request, second)).find((s) => s.current)!.id;
    await call(request, 'delete', `/auth/sessions/${otherId}`, first, { expected: 200 });
    await dropped(request, second);
    await call(request, 'get', '/auth/me', first, { expected: 200 });
  });

  test('[S-03/3] sair de todos os outros', async ({ request }) => {
    const first = await gil(request);
    const second = await again(request, first);
    const third = await again(request, first);
    const body = await (await call(request, 'post', '/auth/sessions/revoke-others', first, { expected: 200 })).json();
    expect(body.revoked).toBe(2);
    await dropped(request, second);
    await dropped(request, third);
    await call(request, 'get', '/auth/me', first, { expected: 200 });
  });

  test('[S-03/4] dono desconecta o Gil', async ({ request }) => {
    const first = await gil(request);
    const second = await again(request, first);
    const body = await (await call(request, 'post', `/security/members/${first.userId}/logout`, tenant.owner, { expected: 200 })).json();
    expect(body.revoked).toBe(2);
    await dropped(request, first);
    await dropped(request, second);
  });

  test('[S-03/5] trocar a senha derruba os outros e mantém o atual', async ({ request }) => {
    const first = await gil(request);
    const second = await again(request, first);
    await call(request, 'post', '/auth/change-password', first, { expected: 200, data: { currentPassword: PASSWORD, newPassword: 'Outra@2026qa' } });
    await dropped(request, second);
    await call(request, 'get', '/auth/me', first, { expected: 200 });
  });
});

test.describe('S-04 política de senha aplicada', () => {
  let tenant: Tenant;
  let operatorId: string;
  const POLICY_ERROR = 'A senha precisa ter um simbolo (ex.: ! @ #).';

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    operatorId = roleId(await listRoles(request, tenant.owner), 'Operador');
    await call(request, 'patch', '/security/policy', tenant.owner, { expected: 200, data: { passwordMinLength: 10, passwordRequireSymbol: true } });
  });

  test('[S-04] trocar senha respeita a política', async ({ request }) => {
    const person = await createPerson(request, tenant.owner, tenant.slug, 'Politica', operatorId);
    const refused = await call(request, 'post', '/auth/change-password', person, { data: { currentPassword: PASSWORD, newPassword: 'Abcdefgh12' } });
    const body = await expectError(refused, 400, POLICY_ERROR);
    expect(body.code).toBe('PASSWORD_POLICY');
    await call(request, 'post', '/auth/change-password', person, { expected: 200, data: { currentPassword: PASSWORD, newPassword: 'Abcdefgh1!' } });
  });

  test('[S-04] aceite de convite respeita a política', async ({ request }) => {
    const pending = await invite(request, tenant.owner, operatorId, 's04');
    await expectError(await acceptInvite(request, pending.token, { name: 'Nova', password: 'Abcdefgh12' }), 400, POLICY_ERROR);
    const accepted = await acceptInvite(request, pending.token, { name: 'Nova', password: 'Abcdefgh1!' });
    expect(accepted.status(), 'aceite com senha válida').toBe(200);
  });
});

test.describe('S-06 limites de tentativas', () => {
  test('[S-06] 6 logins errados', async ({ request }) => {
    const email = qaEmail('s06');
    const responses: APIResponse[] = [];
    for (let i = 0; i < 6; i++) responses.push(await request.post(`${API}/auth/login`, { data: { email, password: 'errada-123' } }));
    expect(responses.slice(0, 5).map((r) => r.status())).toEqual([401, 401, 401, 401, 401]);
    await expectError(responses[5], 429, THROTTLED);
  });

  // Corpo inválido: o limite vem antes da validação e nada é criado.
  test('[S-06] 4 cadastros', async ({ request }) => {
    const responses: APIResponse[] = [];
    for (let i = 0; i < 4; i++) responses.push(await request.post(`${API}/auth/register`, { data: {} }));
    expect(responses.slice(0, 3).map((r) => r.status())).toEqual([400, 400, 400]);
    await expectError(responses[3], 429, THROTTLED);
  });
});

// ── LGPD ────────────────────────────────────────────────────────────────────

function unzip(zip: Buffer): Map<string, string> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(offset + 10);
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const raw = zip.subarray(start, start + size);
    files.set(name, (method === 8 ? inflateRawSync(raw) : raw).toString('utf8'));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

test('[L-01] baixar os meus dados', async ({ request }) => {
  const tenant = await createTenant(request, await ownerStaff(request));
  const ana = await createPerson(request, tenant.owner, tenant.slug, 'Ana', roleId(await listRoles(request, tenant.owner), 'Operador'));
  const response = await call(request, 'get', '/privacy/me/export', ana, { expected: 200 });
  expect(response.headers()['content-disposition']).toMatch(/meus-dados.*\.json/);
  const text = await response.text();
  const body = JSON.parse(text);
  expect(body.conta.email).toBe(ana.email);
  expect(body.empresas.map((e: { endereco: string }) => e.endereco)).toContain(tenant.slug);
  expect(text).not.toContain('"password"');
  expect(text).not.toContain('mfaSecret');
});

test.describe('L-02 excluir minha conta', () => {
  let tenant: Tenant;
  let operatorId: string;

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, await ownerStaff(request));
    await createClientsTable(request, tenant.owner);
    operatorId = roleId(await listRoles(request, tenant.owner), 'Operador');
  });

  const person = (request: Req, name: string) => createPerson(request, tenant.owner, tenant.slug, name, operatorId);
  const deleteMe = (request: Req, session: Session, password = PASSWORD) =>
    call(request, 'post', '/privacy/me/delete', session, { data: { password, confirm: 'EXCLUIR' } });

  test('[L-02/1] dono não exclui a própria conta', async ({ request }) => {
    const body = await expectError(await deleteMe(request, tenant.owner), 400, `Voce e dono de ${tenant.name}. Passe a propriedade para outra pessoa ou encerre a conta da empresa antes.`);
    expect(body.code).toBe('OWNS_TENANT');
  });

  test('[L-02/2] senha errada', async ({ request }) => {
    await expectError(await deleteMe(request, await person(request, 'Errada'), 'errada-123'), 401, 'Senha incorreta');
  });

  test('[L-02/3] duas etapas sem o código', async ({ request }) => {
    const session = await person(request, 'ComMfa');
    await enableMfa(request, session);
    const body = await expectError(await deleteMe(request, session), 401, 'Informe o codigo de verificacao em duas etapas');
    expect(body.code).toBe('MFA_CODE_REQUIRED');
  });

  test('[L-02/4] exclui, sai e os registros ficam anonimizados', async ({ request }) => {
    const session = await person(request, 'Descartavel');
    const recordId = await createRecord(request, session, 'Registro dela');
    const response = await deleteMe(request, session);
    expect(response.status(), await response.text()).toBe(200);
    await call(request, 'get', '/auth/me', session, { expected: 401 });
    await expectError(await rawLogin(request, session.email!), 401, 'Credenciais invalidas');
    const record = await (await call(request, 'get', `/data/clientes/${recordId}`, tenant.owner, { expected: 200 })).json();
    expect(record.data.nome).toBe('Registro dela');
    expect(record.createdBy.name).toBe('Conta excluída');
    expect(JSON.stringify(record)).not.toContain(session.email!);
  });
});

test.describe('L-03 exportar a empresa', () => {
  let tenant: Tenant;
  let gil: Session;
  const webhookSecret = `segredo-webhook-${suffix()}`;
  let apiKey: string;
  let exported: Map<string, string> | undefined;

  test.beforeAll(async ({ request }) => {
    test.setTimeout(120_000);
    tenant = await createTenant(request, await ownerStaff(request));
    const entityId = await createClientsTable(request, tenant.owner);
    const roles = await listRoles(request, tenant.owner);
    gil = await createPerson(request, tenant.owner, tenant.slug, 'Gil', roleId(roles, 'Gerente'));
    await createRecord(request, tenant.owner, 'QA-Ativo');
    const trashed = await createRecord(request, tenant.owner, 'QA-Lixeira');
    await call(request, 'delete', `/data/clientes/${trashed}`, tenant.owner, { expected: 200 });
    await call(request, 'post', '/webhooks', tenant.owner, {
      expected: [200, 201], data: { name: 'QA', url: 'https://example.com/hook', events: ['created'], entityId, secret: webhookSecret },
    });
    apiKey = (await (await call(request, 'post', '/api-keys', tenant.owner, {
      expected: [200, 201], data: { name: 'ERP QA', customRoleId: roleId(roles, 'Gerente') },
    })).json()).key;
  });

  const firstExport = async (request: Req) => {
    if (!exported) {
      const response = await call(request, 'get', '/privacy/company/export', tenant.owner, { expected: 200 });
      expect(response.headers()['content-type']).toContain('application/zip');
      exported = unzip(await response.body());
    }
    return exported;
  };

  test('[L-03/1] ZIP com registros ativos e da lixeira, sem segredos', async ({ request }) => {
    const files = await firstExport(request);
    for (const name of [
      'LEIA-ME.txt', 'empresa.json', 'pessoas.json', 'pessoas.csv', 'estrutura/tabelas.json', 'tabelas/clientes.csv', 'tabelas/clientes.json',
      'configuracoes/cargos.json', 'configuracoes/webhooks.json', 'configuracoes/chaves-de-api.json', 'arquivos.csv', 'auditoria.csv',
    ]) expect([...files.keys()], name).toContain(name);
    const csv = files.get('tabelas/clientes.csv')!;
    expect(csv).toContain('QA-Ativo');
    expect(csv).toContain('QA-Lixeira');
    const everything = [...files.values()].join('\n');
    expect(files.get('pessoas.json')).toContain(gil.email!);
    expect(everything.includes(PASSWORD), 'senha em claro').toBe(false);
    expect(/\$2[aby]\$\d\d\$/.test(everything), 'hash de senha').toBe(false);
    expect(everything.includes(webhookSecret), 'segredo do webhook').toBe(false);
    expect(everything.includes(apiKey), 'chave de API').toBe(false);
    expect(everything.includes('keyHash'), 'hash da chave').toBe(false);
  });

  test('[L-03/2] de novo em menos de 2 minutos', async ({ request }) => {
    await firstExport(request);
    await expectError(await call(request, 'get', '/privacy/company/export', tenant.owner), 429, 'Uma exportacao acabou de ser gerada. Aguarde alguns minutos.');
  });

  test('[L-03/3] Gerente não exporta', async ({ request }) => {
    await expectError(await call(request, 'get', '/privacy/company/export', gil), 403, 'Somente o dono ou quem tem acesso total pode exportar todos os dados da empresa');
  });
});

test.describe('L-04 encerrar a empresa', () => {
  let paula: Session;
  let tenant: Tenant;
  let alex: Session;
  const REASON = 'Teste do roteiro';

  test.beforeAll(async ({ request }) => {
    paula = await ownerStaff(request);
    tenant = await createTenant(request, paula);
    alex = await createPerson(request, tenant.owner, tenant.slug, 'Alex', roleId(await listRoles(request, tenant.owner), 'Administrador'));
  });

  const close = (request: Req, session: Session, extra: Record<string, unknown> = {}) =>
    call(request, 'post', '/privacy/company/close', session, { data: { password: PASSWORD, confirmName: tenant.name, reason: REASON, ...extra } });
  const detail = async (request: Req) => (await call(request, 'get', `/platform/tenants/${tenant.id}`, paula, { expected: 200 })).json();
  const ensureClosed = async (request: Req) => {
    if ((await detail(request)).closure) return;
    const response = await close(request, tenant.owner);
    expect(response.status(), await response.text()).toBe(200);
  };

  // Tela: "Somente o dono da empresa pode encerrar a conta." vem do i18n da web quando isOwner=false.
  test('[L-04/1] admin não-dono', async ({ request }) => {
    await expectError(await close(request, alex), 403, 'Somente o dono pode encerrar a conta da empresa');
  });

  test('[L-04/2] nome errado', async ({ request }) => {
    const body = await expectError(await close(request, tenant.owner, { confirmName: 'Outro nome' }), 400, 'Digite o nome da empresa exatamente como aparece');
    expect(body.code).toBe('CONFIRM_NAME');
  });

  test('[L-04/3] senha errada', async ({ request }) => {
    await expectError(await close(request, tenant.owner, { password: 'errada-123' }), 401, 'Senha incorreta');
  });

  test('[L-04/4] encerrar agenda a exclusão', async ({ request }) => {
    const response = await close(request, tenant.owner);
    expect(response.status(), await response.text()).toBe(200);
    const { closure } = await response.json();
    expect(new Date(closure.deleteAfter).getTime()).toBeGreaterThan(Date.now());
  });

  test('[L-04/5] membro não entra', async ({ request }) => {
    await ensureClosed(request);
    await expectError(await rawLogin(request, alex.email!), 401, 'Tenant suspenso ou inativo');
  });

  test('[L-04/6] console mostra o encerramento', async ({ request }) => {
    await ensureClosed(request);
    const body = await detail(request);
    expect(body.lifecycle).toBe('CANCELED');
    expect(body.closure.reason).toBe(REASON);
    expect(new Date(body.closure.deleteAfter).getTime()).toBeGreaterThan(Date.now());
  });

  test('[L-04/7] reativar desiste do encerramento', async ({ request }) => {
    await ensureClosed(request);
    const response = await setLifecycle(request, paula, tenant.id, 'ACTIVE');
    expect(response.status(), await response.text()).toBe(200);
    const body = await detail(request);
    expect(body.closure ?? null).toBeNull();
    const session = await loginUser(request, tenant.ownerEmail, tenant.slug);
    await call(request, 'get', '/subscription', session, { expected: 200 });
  });
});
