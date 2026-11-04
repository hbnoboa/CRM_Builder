import { readFileSync } from 'fs';
import { APIRequestContext, Browser, BrowserContext, expect, Locator, Page, test } from '@playwright/test';
import { API, call, Session } from '../api/helpers';

// Fluxos de tela do roteiro (docs/teste-e2e-completo.md), sobre o cenario de pnpm test:seed.
// Le as contas de e2e/.dev-accounts.local.json e a senha de QA_PASSWORD. Rode com --workers=1:
// os testes seguem a ordem do arquivo e o ultimo apaga tudo o que tiver o prefixo "UI ".
const seed = JSON.parse(readFileSync(process.env.ACCOUNTS_FILE || 'e2e/.dev-accounts.local.json', 'utf8'));
const PASSWORD = process.env.QA_PASSWORD!;
const slug: string = seed.slug;
const mail = (nick: string): string => seed.accounts[nick];
const clientesId: string = seed.entityIds.clientes;

// O processo principal define o valor e os workers herdam: reinicio de worker mantem os nomes.
process.env.UI_FLOW_RUN ??= Date.now().toString(36);
const RUN = process.env.UI_FLOW_RUN;
const A1 = `UI Cliente A1 ${RUN}`;
const A2 = `UI Cliente A2 ${RUN}`;
const A3 = `UI Cliente A3 ${RUN}`;
const D1 = `UI Cliente D1 ${RUN}`;
const A1_EMAIL = `ui.a1.${RUN}@example.com`;

test.use({ actionTimeout: 20_000 });

const contexts = new Map<string, BrowserContext>();

async function login(page: Page, nick: string): Promise<void> {
  await page.goto('/pt-BR/login');
  await page.locator('#email').fill(mail(nick));
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(new RegExp(`/${slug}/home`), { timeout: 30_000 });
}

/** Reaproveita o contexto de cada pessoa: o login aceita 5 tentativas por minuto. */
async function as(browser: Browser, nick: string): Promise<Page> {
  let context = contexts.get(nick);
  if (!context) {
    context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    await login(page, nick);
    contexts.set(nick, context);
    return page;
  }
  return context.newPage();
}

const go = async (page: Page, path: string): Promise<void> => {
  await page.goto(`/pt-BR/${slug}${path}`);
  await page.waitForLoadState('networkidle');
};

/** Registra as chamadas que gravam algo na API, para provar que a tela nao salvou. */
function writes(page: Page, pattern: RegExp): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && pattern.test(new URL(request.url()).pathname)) seen.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  return seen;
}

let doraSession: Session | undefined;

async function dora(request: APIRequestContext): Promise<Session> {
  if (doraSession) return doraSession;
  const response = await request.post(`${API}/auth/login`, { data: { email: mail('dora'), password: PASSWORD } });
  expect(response.ok(), `login da Dora pela API: ${response.status()}`).toBeTruthy();
  const body = await response.json();
  doraSession = { token: body.accessToken, slug, userId: body.user?.id, email: mail('dora') };
  return doraSession;
}

const listOf = async (request: APIRequestContext, session: Session, path: string): Promise<Array<Record<string, any>>> => {
  const body = await (await call(request, 'get', path, session, { expected: 200 })).json();
  return Array.isArray(body) ? body : body.data ?? [];
};

async function createRecord(request: APIRequestContext, nome: string, extra: Record<string, unknown> = {}, parentRecordId?: string, entity = 'clientes'): Promise<string> {
  const session = await dora(request);
  const response = await call(request, 'post', `/data/${entity}`, session, {
    expected: [200, 201],
    data: { data: entity === 'clientes' ? { nome, ...extra } : extra, parentRecordId },
  });
  return (await response.json()).id;
}

const records = (page: Page, entity = 'clientes'): Promise<void> => go(page, `/data?entity=${entity}`);
const row = (page: Page, name: string): Locator => page.locator('tbody tr').filter({ hasText: name });
const toast = (page: Page, text: string | RegExp): Locator => page.locator('[data-sonner-toast]').filter({ hasText: text });

async function openCreate(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Criar', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /Novo Registro/ })).toBeVisible();
  return dialog;
}

async function pickStatus(page: Page, dialog: Locator, label: string): Promise<void> {
  await dialog.locator('div.space-y-2').filter({ has: page.getByText('Status', { exact: true }) }).getByRole('combobox').click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

async function createViaForm(page: Page, data: { nome: string; email?: string; vip?: boolean; status?: string }): Promise<void> {
  const dialog = await openCreate(page);
  await dialog.locator('#nome').fill(data.nome);
  if (data.email) await dialog.locator('#email').fill(data.email);
  if (data.status) await pickStatus(page, dialog, data.status);
  if (data.vip) await dialog.locator('#vip').click();
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(toast(page, 'Registro criado com sucesso').first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

async function rowMenu(page: Page, name: string, item: string): Promise<void> {
  await row(page, name).locator('td').last().getByRole('button').click();
  await page.getByRole('menuitem', { name: item }).click();
}

/** Seleciona numa combobox do Radix que so tem o valor atual como rotulo. */
async function radixPick(page: Page, trigger: Locator, option: string | RegExp): Promise<void> {
  await trigger.click();
  await page.getByRole('option', { name: option }).first().click();
}

test.beforeAll(({ baseURL }) => {
  // Os testes criam e apagam dados: nunca em producao.
  expect(new URL(baseURL!).hostname).not.toBe('iossystem.com.br');
  expect(PASSWORD, 'defina QA_PASSWORD').toBeTruthy();
});

test.afterEach(async () => {
  // Fecha as abas, mantem os contextos logados.
  for (const context of contexts.values()) for (const page of context.pages()) await page.close({ runBeforeUnload: false });
});

test.describe('Administracao', () => {
  test('[E-04/1] nome com 1 letra desabilita salvar', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const saved = writes(page, /\/tenants\/me$/);
    await go(page, '/gestao/organization');
    const name = page.locator('#org-name');
    await expect(name).not.toHaveValue('');
    const original = await name.inputValue();
    await expect(page.getByTestId('organization-save')).toBeEnabled();
    await name.fill('Q');
    await expect(page.getByTestId('organization-save')).toBeDisabled();
    await name.fill(original);
    await expect(page.getByTestId('organization-save')).toBeEnabled();
    expect(saved).toEqual([]);
  });

  test('[E-04/3] cor invalida e barrada antes de salvar', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const saved = writes(page, /\/tenants\/me$/);
    await go(page, '/gestao/organization');
    await page.getByTestId('color-hex').fill('#12ab34');
    await expect(page.getByTestId('color-picker')).toHaveValue('#12ab34');
    await expect(page.getByTestId('color-preview').getByText('Botão')).toHaveCSS('background-color', 'rgb(18, 171, 52)');
    await page.getByTestId('color-hex').fill('12ab');
    await page.getByTestId('organization-save').click();
    await expect(toast(page, 'Use uma cor no formato #RRGGBB.')).toBeVisible();
    expect(saved).toEqual([]);
  });

  test('[E-04/5] endereco e so leitura', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await go(page, '/gestao/organization');
    const address = page.locator('input[readonly]');
    await expect(address).toHaveCount(2);
    await expect(address.nth(0)).toHaveValue(slug);
    await expect(address.nth(1)).toHaveValue('Nenhum');
  });

  test('[E-06/9] editor no celular pede computador', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await page.setViewportSize({ width: 390, height: 800 });
    await go(page, `/gestao/entities/${clientesId}`);
    await expect(page.getByRole('heading', { name: 'Edite no computador' })).toBeVisible();
  });

  test('[E-06/10] abas do editor nao perdem campo nao salvo', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const saved = writes(page, /\/entities/);
    await go(page, `/gestao/entities/${clientesId}`);
    for (const [key, label] of [['fields', 'Campos'], ['rules', 'Regras de campo'], ['filters', 'Filtro global'], ['automations', 'Automações'], ['danger', 'Excluir']]) {
      await expect(page.getByTestId(`entity-tab-${key}`), label).toHaveText(label);
    }
    const canvas = page.locator('.rfb-grid');
    await expect(canvas.getByText('Nome').first()).toBeVisible();
    const before = await canvas.locator('.react-grid-item').count();

    await page.getByRole('button', { name: 'Campo', exact: true }).click();
    const picker = page.getByRole('dialog');
    await picker.getByPlaceholder('Buscar campos...').fill('texto');
    await picker.getByRole('button', { name: /Texto/ }).first().click();
    await expect(canvas.locator('.react-grid-item')).toHaveCount(before + 1);

    await page.getByTestId('entity-tab-rules').click();
    await expect(page.locator('.rfb-grid')).toBeHidden();
    await page.getByTestId('entity-tab-filters').click();
    await expect(page.getByTestId('global-filters')).toBeVisible();
    await expect(page.getByTestId('global-filters-save')).toBeDisabled();
    await page.getByTestId('entity-tab-automations').click();
    await page.getByTestId('entity-tab-danger').click();
    await expect(page.getByTestId('entity-delete-confirm')).toBeDisabled();
    await page.getByTestId('entity-delete-name').fill('outro nome');
    await expect(page.getByTestId('entity-delete-confirm')).toBeDisabled();
    await page.getByTestId('entity-delete-name').fill('Clientes');
    await expect(page.getByTestId('entity-delete-confirm')).toBeEnabled();
    await page.getByTestId('entity-delete-name').fill('');
    await page.getByTestId('entity-tab-fields').click();
    await expect(canvas.locator('.react-grid-item')).toHaveCount(before + 1);
    expect(saved).toEqual([]);
  });

  test('[E-06] editor de Clientes mostra os campos do cenario', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const saved = writes(page, /\/entities/);
    await go(page, `/gestao/entities/${clientesId}`);
    const canvas = page.locator('.rfb-grid');
    for (const field of ['Nome', 'Email', 'Telefone', 'Status', 'VIP', 'CPF', 'Visitas']) {
      await expect(canvas.getByText(field).first(), field).toBeVisible();
    }
    await expect(page.getByText('Selecione um campo no canvas para editar.')).toBeVisible();
    // O rotulo fica sob a camada de arrasto: o clique vale no cartao do campo.
    await canvas.locator('.react-grid-item').filter({ hasText: 'Nome' }).first().click({ position: { x: 8, y: 8 } });
    await expect(page.getByText('Selecione um campo no canvas para editar.')).toHaveCount(0);
    expect(saved).toEqual([]);
  });

  test('[E-07/1] lista de cargos e dica de ordem', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await go(page, '/gestao/roles');
    await expect(page.getByText('A ordem define quem gerencia quem', { exact: false })).toBeVisible();
    const headings = page.locator('h3');
    await expect(headings.filter({ hasText: /^Administrador$/ })).toHaveCount(1);
    const names = await headings.allInnerTexts();
    const position = (name: string) => names.indexOf(name);
    expect(position('Administrador')).toBeGreaterThanOrEqual(0);
    expect(position('Gerente')).toBeGreaterThan(position('Administrador'));
    expect(position('Operador')).toBeGreaterThan(position('Gerente'));
    expect(position('Visualizador')).toBeGreaterThan(position('Operador'));
    const operator = page.locator('div').filter({ has: page.locator('h3', { hasText: /^Operador$/ }) }).last();
    await expect(operator.getByText('Padrão')).toBeVisible();
  });

  test('[E-07/2+7] novo cargo: um clique em Ver do CPF desliga Editar, sem salvar', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const saved = writes(page, /\/custom-roles/);
    await go(page, '/gestao/roles');
    await page.getByRole('button', { name: 'Novo Cargo' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('tab', { name: 'Módulos do Sistema' })).toBeVisible();
    await dialog.getByRole('tab', { name: 'Permissões por Tabela' }).click();
    await dialog.getByRole('button', { name: /^Clientes/ }).click();
    await dialog.getByRole('button', { name: /Permissões por Campo/ }).click();
    const cpf = dialog.locator('tr').filter({ has: page.getByRole('cell', { name: 'CPF', exact: true }) });
    const view = cpf.getByRole('checkbox').nth(0);
    const edit = cpf.getByRole('checkbox').nth(1);
    await expect(view).toBeChecked();
    await expect(edit).toBeChecked();
    await view.click();
    await expect(view).not.toBeChecked();
    await expect(edit).not.toBeChecked();
    await expect(edit).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toHaveCount(0);
    expect(saved).toEqual([]);
  });

  test('[E-10/6] usuarios: selos e filtro por equipe', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await go(page, '/gestao/users');
    for (const nick of ['ana', 'bruno', 'carla', 'gil']) await expect(page.getByText(mail(nick)).first(), nick).toBeVisible();
    expect(await page.getByText('Norte', { exact: true }).count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText('Sul', { exact: true }).first()).toBeVisible();

    const filter = page.getByTestId('users-team-filter');
    await expect(filter).toContainText('Todas as equipes');
    await radixPick(page, filter, 'Norte');
    await expect(page.getByText(mail('ana')).first()).toBeVisible();
    await expect(page.getByText(mail('bruno')).first()).toBeVisible();
    await expect(page.getByText(mail('carla'))).toHaveCount(0);
    await expect(page.getByText(mail('gil'))).toHaveCount(0);
    await radixPick(page, filter, 'Sul');
    await expect(page.getByText(mail('carla')).first()).toBeVisible();
    await expect(page.getByText(mail('ana'))).toHaveCount(0);
    await radixPick(page, filter, 'Todas as equipes');
    await expect(page.getByText(mail('gil')).first()).toBeVisible();
  });

  async function fillPdfForm(page: Page, name: string, templateSlug: string): Promise<void> {
    await go(page, '/gestao/pdf-templates/new');
    await page.getByPlaceholder('Ex: Relatorio de Veiculo').fill(name);
    await page.getByPlaceholder('relatorio-veiculo').fill(templateSlug);
    await expect(page.getByRole('combobox').nth(0)).toContainText('Individual');
    await radixPick(page, page.getByRole('combobox').nth(1), 'Clientes');
    await expect(page.getByRole('combobox').nth(2)).toContainText('A4');
  }

  test('[E-11/2] slug com maiuscula e recusado', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const saved = writes(page, /\/pdf-templates/);
    await go(page, '/gestao/pdf-templates/new');
    await page.getByPlaceholder('Ex: Relatorio de Veiculo').fill(`UI Slug ${RUN}`);
    await expect(page.getByPlaceholder('relatorio-veiculo')).toHaveValue(`ui-slug-${RUN}`);
    await page.getByPlaceholder('relatorio-veiculo').fill('Slug-Com-Maiuscula');
    await page.getByRole('button', { name: 'Criar e Continuar' }).click();
    await expect(page.getByText('Slug deve conter apenas letras minusculas', { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/pdf-templates\/new$/);
    expect(saved).toEqual([]);
  });

  test('[E-11/1] modelo novo fica na lista como rascunho e o editor abre pela lista', async ({ browser, request }) => {
    const page = await as(browser, 'dora');
    const name = `UI Ficha ${RUN}`;
    await fillPdfForm(page, name, `ui-ficha-${RUN}`);
    const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/pdf-templates$/.test(new URL(r.url()).pathname));
    await page.getByRole('button', { name: 'Criar e Continuar' }).click();
    expect((await created).ok()).toBeTruthy();
    await page.waitForURL(/\/pdf-templates\/(?!new)[^/]+$/, { timeout: 30_000 });
    await go(page, '/gestao/pdf-templates');
    const card = page.locator('div.rounded-xl, div[class*="rounded"]').filter({ hasText: name }).filter({ has: page.getByRole('link', { name: 'Editar' }) }).last();
    await expect(card).toContainText('Rascunho');
    await expect(card).toContainText('Individual');
    await expect(card).toContainText('A4');
    await expect(card).toContainText('Clientes');
    await card.getByRole('link', { name: 'Editar' }).click();
    await page.waitForURL(new RegExp(`/pt-BR/${slug}/gestao/pdf-templates/[^/]+$`));
    await expect(page.getByText('Informacoes do Template')).toBeVisible();
    await expect(page.locator(`input[value="${name}"]`).first()).toBeVisible();
    // Exclui pela tela; a limpeza cobre se este passo nao chegar aqui.
    const session = await dora(request);
    const template = (await listOf(request, session, '/pdf-templates?limit=100')).find((item) => item.name === name);
    if (template) await call(request, 'delete', `/pdf-templates/${template.id}`, session, { expected: [200, 204] });
  });

  test('[E-11/1 editor] Criar e Continuar abre o editor', async ({ browser }) => {
    // BUG: gestao/pdf-templates/new/page.tsx:4 usa o useRouter de next/navigation e a linha 109 faz
    // push('/gestao/pdf-templates/:id') sem idioma e empresa. A URL vira /gestao/pdf-templates/:id
    // e a tela fica em branco. O modelo e criado; o editor abre pela lista.
    const page = await as(browser, 'dora');
    await fillPdfForm(page, `UI Ficha editor ${RUN}`, `ui-ficha-editor-${RUN}`);
    await page.getByRole('button', { name: 'Criar e Continuar' }).click();
    await page.waitForURL(/\/pdf-templates\/(?!new)[^/]+$/, { timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`/pt-BR/${slug}/gestao/pdf-templates/`));
  });

  test('[E-19 data final] filtrar ate hoje mantem os logs de hoje', async ({ browser }) => {
    // BUG: audit.service.ts:208-210 e audit.controller.ts:46 usam new Date(dateTo), meia-noite UTC do
    // dia escolhido. A data final exclui o proprio dia: tela e exportacao ficam sem os logs de hoje.
    // Medido em dev: sem data 51 logs, ate hoje 0, ate amanha 51.
    const page = await as(browser, 'dora');
    await go(page, '/gestao/audit-logs');
    await expect(page.getByText('Nenhum log encontrado')).toHaveCount(0);
    const filtered = page.waitForResponse((r) => r.url().includes('/audit-logs') && r.url().includes('dateTo=') && r.ok());
    await page.locator('input[type="date"]').nth(1).fill(new Date().toISOString().slice(0, 10));
    await filtered;
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Nenhum log encontrado')).toHaveCount(0);
  });

  test('[E-12/4] template de dashboard sem nome', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const saved = writes(page, /\/dashboard-templates/);
    await go(page, '/gestao/dashboard-templates');
    await page.getByRole('link', { name: /Novo Template/ }).click();
    await page.waitForURL(/\/dashboard-templates\/new$/);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(toast(page, 'Informe o nome do template')).toBeVisible();
    expect(saved).toEqual([]);
  });

  test('[E-13/1-2] link publico com role automatica e copiar URL', async ({ browser, request }) => {
    const page = await as(browser, 'dora');
    const session = await dora(request);
    const name = `UI Cadastro ${RUN}`;
    const roleName = 'Publico - Clientes';
    const roleExisted = (await listOf(request, session, '/custom-roles?limit=100')).some((role) => role.name === roleName);
    await go(page, '/gestao/public-links');
    await page.getByRole('button', { name: 'Novo Link' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#name').fill(name);
    await radixPick(page, dialog.getByRole('combobox'), 'Clientes');
    await expect(dialog.locator('#autoCreateRole')).toBeChecked();
    await dialog.locator('#maxUsers').fill('2');
    await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    await expect(page.getByText(name).first()).toBeVisible();
    await expect(page.getByText(/\/p\/[\w-]+/).first()).toBeVisible();

    // Copiar pelo menu do proprio cartao.
    const menuButton = page.locator('div').filter({ hasText: name }).filter({ has: page.locator('button[title="Copiar link"]') }).last().getByRole('button').last();
    await menuButton.click();
    await page.getByRole('menuitem', { name: 'Copiar URL' }).click();
    await expect(toast(page, 'Link copiado!')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/p\/[\w-]+$/);

    // Excluir nao remove o cargo criado para o link: a limpeza faz isso se ele nao existia antes.
    await menuButton.click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
    await expect(page.getByText(name)).toHaveCount(0);
    if (!roleExisted) {
      const role = (await listOf(request, session, '/custom-roles?limit=100')).find((item) => item.name === roleName);
      if (role) await call(request, 'delete', `/custom-roles/${role.id}`, session, { expected: [200, 204] });
    }
  });

  test('[E-19] auditoria: filtros e exportar com os mesmos filtros', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await go(page, '/gestao/audit-logs');
    await expect(page.getByRole('heading', { name: 'Logs de Auditoria' })).toBeVisible();
    await expect(page.getByText('Nenhum log encontrado')).toHaveCount(0);

    const filtered = page.waitForResponse((r) => r.url().includes('/audit-logs') && r.url().includes('action=create') && r.ok());
    await radixPick(page, page.getByRole('combobox').nth(0), 'Criar');
    await filtered;
    await expect(page.getByText('Deletar', { exact: true })).toHaveCount(0);

    const byResource = page.waitForResponse((r) => r.url().includes('/audit-logs') && r.url().includes('resource=entity_data') && r.ok());
    await radixPick(page, page.getByRole('combobox').nth(1), 'Registros');
    await byResource;

    const today = new Date().toISOString().slice(0, 10);
    await page.locator('input[type="date"]').nth(0).fill('2020-01-01');
    await page.waitForLoadState('networkidle');

    const exportRequest = page.waitForRequest((r) => r.url().includes('/audit-logs/export'));
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar JSON' }).click();
    const url = new URL((await exportRequest).url());
    expect(url.searchParams.get('action')).toBe('create');
    expect(url.searchParams.get('resource')).toBe('entity_data');
    expect(url.searchParams.get('dateFrom')).toBe('2020-01-01');
    const file = await download;
    expect(file.suggestedFilename()).toBe(`audit-logs-${today}.json`);
    const content = JSON.parse(readFileSync(await file.path(), 'utf8'));
    const rows: Array<{ action: string; resource: string }> = content;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((log) => log.action === 'create' && log.resource === 'entity_data')).toBeTruthy();

    await page.getByRole('button', { name: 'Limpar Filtros' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Buscar por ID do recurso...').fill('id-que-nao-existe');
    await expect(page.getByText('Nenhum log encontrado')).toBeVisible();
  });
});

test.describe('Operacao', () => {
  type Pie = { name: string; title: string };

  /** Dois templates de Clientes atribuidos ao Operador, so durante o teste (O-05). */
  async function withTemplates(request: APIRequestContext, run: (pies: Pie[]) => Promise<void>): Promise<void> {
    const session = await dora(request);
    const operatorId = (await listOf(request, session, '/custom-roles?limit=100')).find((role) => role.name === 'Operador')!.id;
    const pies: Pie[] = [{ name: `UI Painel 1 ${RUN}`, title: 'Pizza um' }, { name: `UI Painel 2 ${RUN}`, title: 'Pizza dois' }];
    const ids: string[] = [];
    try {
      for (const { name, title } of pies) {
        const created = await call(request, 'post', '/dashboard-templates', session, {
          expected: [200, 201],
          data: {
            name, entitySlug: 'clientes', isActive: true, roleIds: [operatorId], priority: 0,
            layout: [{ i: 'w-pie', x: 0, y: 0, w: 6, h: 6 }, { i: 'w-table', x: 0, y: 6, w: 12, h: 10 }],
            widgets: {
              'w-pie': { type: 'pie-chart', title, config: { groupByField: 'status' } },
              'w-table': { type: 'data-table', title: '', config: { displayFields: ['nome', 'status'], pageSize: 25, allowCreate: true, allowEdit: true } },
            },
          },
        });
        ids.push((await created.json()).id);
      }
      await run(pies);
    } finally {
      for (const id of ids) await call(request, 'delete', `/dashboard-templates/${id}`, session);
    }
  }

  test('[O-04] dashboard geral da Ana', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await go(page, '/dashboard');
    const main = page.getByTestId('dashboard-container');
    await expect(main.getByText('Registros', { exact: true }).first()).toBeVisible();
    await expect(main.getByText('Atividade', { exact: true }).first()).toBeVisible();
    await expect(main.getByText('Tabelas', { exact: true })).toHaveCount(0);
    await expect(main.getByText('Usuários', { exact: true })).toHaveCount(0);
    const reloaded = page.waitForResponse((r) => r.url().includes('/stats/dashboard'));
    await page.getByTestId('refresh-btn').click();
    expect((await reloaded).ok()).toBeTruthy();
  });

  test('[O-05] dois templates: alternar, lembrar e filtrar pela pizza', async ({ browser, request }) => {
    await withTemplates(request, async ([first, second]) => {
      const page = await as(browser, 'ana');
      await records(page);
      await expect(page.getByRole('button', { name: first.name })).toBeVisible();
      await page.getByRole('button', { name: second.name }).click();
      await expect(page.getByText(second.title)).toBeVisible();
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(second.title)).toBeVisible();
      await expect(page.getByText(first.title)).toHaveCount(0);

      const slice = page.locator('.recharts-pie-sector').first();
      await slice.click();
      await expect(page.getByText('Filtros', { exact: true })).toBeVisible();
      const chip = page.getByText(/Status\s*=/);
      await expect(chip).toBeVisible();
      await chip.click();
      await expect(chip).toHaveCount(0);
      await slice.click();
      await expect(chip).toBeVisible();
      await page.getByRole('button', { name: 'Limpar', exact: true }).click();
      await expect(chip).toHaveCount(0);
    });
  });


  test('[O-06/1] criar sem nome', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    const dialog = await openCreate(page);
    await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(dialog.getByText('Nome é obrigatório')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('[O-06/2] email invalido', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    const dialog = await openCreate(page);
    await dialog.locator('#nome').fill('UI invalido');
    await dialog.locator('#email').fill('abc@x');
    await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(dialog.getByText('Email inválido')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  });


  test('[O-06/4] Ana cria A1 e A2', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    await createViaForm(page, { nome: A1, email: A1_EMAIL, status: 'Novo' });
    await createViaForm(page, { nome: A2, email: `ui.a2.${RUN}@example.com`, vip: true });
  });

  test('[O-06/5] Ana ve A1 e nao ve A2 (VIP)', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    await expect(row(page, A1)).toHaveCount(1);
    await expect(row(page, A2)).toHaveCount(0);
  });

  test('[O-06/6] editar A1 troca o Status', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    await rowMenu(page, A1, 'Editar');
    const dialog = page.getByRole('dialog');
    await pickStatus(page, dialog, 'Em contato');
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(toast(page, 'Registro atualizado com sucesso')).toBeVisible();
    await expect(row(page, A1)).toContainText('contato');
  });

  test('[O-06/6 extra] lista mostra o rotulo da opcao, nao o valor', async ({ browser }) => {
    // BUG: data-table-widget.tsx:887 chama formatFieldValue sem as opcoes do campo, entao a celula
    // mostra o valor cru ("contato") em vez do rotulo escolhido no formulario ("Em contato").
    const page = await as(browser, 'ana');
    await records(page);
    await expect(row(page, A1)).toContainText('Em contato');
  });

  test('[O-06/7] email repetido da erro de valor unico', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    const dialog = await openCreate(page);
    await dialog.locator('#nome').fill(`UI duplicado ${RUN}`);
    await dialog.locator('#email').fill(A1_EMAIL);
    await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(page.getByText(/único|unico|já existe|ja existe|já está|ja esta|duplicad/i).first()).toBeVisible();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('[O-06/8] Dora cria D1 e Ana nao ve', async ({ browser }) => {
    const doraPage = await as(browser, 'dora');
    await records(doraPage);
    await createViaForm(doraPage, { nome: D1, email: `ui.d1.${RUN}@example.com` });
    await expect(row(doraPage, D1)).toHaveCount(1);
    const page = await as(browser, 'ana');
    await records(page);
    await expect(row(page, A1)).toHaveCount(1);
    await expect(row(page, D1)).toHaveCount(0);
  });

  test('[O-07/1] formulario novo pede para salvar antes das visitas', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    const dialog = await openCreate(page);
    await expect(dialog.getByText('Salve o registro primeiro para adicionar Visitas')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('[O-07/3] excluir visita: lixeira e Desfazer', async ({ browser, request }) => {
    const name = `UI Com visita O07 ${RUN}`;
    const id = await createRecord(request, name);
    await createRecord(request, '', { resumo: `UI visita O07 ${RUN}` }, id, 'visitas');
    const page = await as(browser, 'dora');
    await records(page);
    await rowMenu(page, name, 'Editar');
    const dialog = page.getByRole('dialog');
    await dialog.getByTitle('Tabela', { exact: true }).click(); // abre em Cards
    const visit = dialog.locator('tr').filter({ hasText: `UI visita O07 ${RUN}` });
    await expect(visit).toBeVisible();
    await visit.getByRole('button').last().click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('Ele vai para a lixeira e pode ser restaurado.');
    await confirm.getByRole('button', { name: 'Excluir' }).click();
    await expect(visit).toHaveCount(0);
    const undo = toast(page, 'Registro excluído. Ele fica na lixeira.');
    await expect(undo).toBeVisible();
    await undo.getByRole('button', { name: 'Desfazer' }).click();
    await expect(visit).toBeVisible();
  });

  test('[O-08] busca por A1', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    await expect(page.getByText('Cliente A', { exact: true })).toBeVisible();
    await page.getByPlaceholder('Buscar registros...').fill('A1');
    await expect(row(page, A1)).toHaveCount(1);
    await expect(page.getByText('Cliente A', { exact: true })).toHaveCount(0);
  });

  test('[O-08] filtro Status Igual a Novo e limpar', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    await expect(row(page, A1)).toHaveCount(1); // A1 esta "Em contato" depois da O-06/6.
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await radixPick(page, page.getByRole('combobox').filter({ hasText: 'Selecionar campo' }), 'Status');
    const combos = page.getByRole('dialog').getByRole('combobox');
    await expect(combos.nth(1)).toContainText('Igual a');
    await radixPick(page, combos.nth(2), 'Novo');
    await page.getByRole('button', { name: 'Adicionar Filtro' }).click();
    await expect(page.getByText(/Status igual a/i).first()).toBeVisible();
    await expect(page.getByText('Cliente A', { exact: true })).toBeVisible();
    await expect(row(page, A1)).toHaveCount(0);
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByText(/Status igual a/i)).toHaveCount(0);
    await expect(row(page, A1)).toHaveCount(1);
  });

  test('[O-08] colunas escondidas continuam depois de recarregar', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    const header = page.getByRole('columnheader', { name: 'Email' });
    await expect(header).toBeVisible();
    await page.getByRole('button', { name: 'Colunas' }).click();
    await page.getByRole('menuitem', { name: 'Email' }).click();
    await page.keyboard.press('Escape');
    await expect(header).toHaveCount(0);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('columnheader', { name: 'Nome' })).toBeVisible();
    await expect(header).toHaveCount(0);
    await page.getByRole('button', { name: 'Colunas' }).click();
    await page.getByRole('menuitem', { name: 'Email' }).click();
    await page.keyboard.press('Escape');
    await expect(header).toBeVisible();
  });

  test('[O-10/1-3] excluir, Desfazer e lixeira depois de 10 s', async ({ browser, request }) => {
    const name = `UI Excluir O10 ${RUN}`;
    await createRecord(request, name);
    const page = await as(browser, 'dora');
    await records(page);
    await rowMenu(page, name, 'Excluir');
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('Ele vai para a lixeira e pode ser restaurado.');
    await confirm.getByRole('button', { name: 'Excluir' }).click();
    const done = toast(page, 'Registro excluído. Ele fica na lixeira.');
    await expect(done).toBeVisible();
    await expect(row(page, name)).toHaveCount(0);
    await done.getByRole('button', { name: 'Desfazer' }).click();
    await expect(row(page, name)).toHaveCount(1);

    await rowMenu(page, name, 'Excluir');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
    await expect(done).toBeVisible();
    await expect(done).toHaveCount(0, { timeout: 15_000 });
    await go(page, '/trash');
    await page.getByTestId('trash-search').fill(name);
    await expect(page.getByTestId('trash-list').getByText(name)).toBeVisible();
  });

  test('[O-11/1-3] lixeira: autor, sub-registros, busca, filtro e restaurar', async ({ browser, request }) => {
    const session = await dora(request);
    const name = `UI Lixeira O11 ${RUN}`;
    const id = await createRecord(request, name);
    await createRecord(request, '', { resumo: `UI visita O11 ${RUN}` }, id, 'visitas');
    await call(request, 'delete', `/data/clientes/${id}`, session, { expected: [200, 204] });

    const page = await as(browser, 'dora');
    await go(page, '/trash');
    const list = page.getByTestId('trash-list');
    const item = page.getByTestId(`trash-item-${id}`);
    await expect(item).toBeVisible();
    await expect(item).toContainText(/Excluído por Dora em/);
    await expect(item).toContainText('+ 1 sub-registro');

    await page.getByTestId('trash-search').fill(`O11 ${RUN}`);
    await expect(item).toBeVisible();
    await page.getByTestId('trash-search').fill(`nao-existe-${RUN}`);
    await expect(page.getByTestId('trash-empty-state')).toContainText('Nada encontrado');
    await page.getByTestId('trash-search').fill('');
    await expect(list).toBeVisible();

    await radixPick(page, page.getByTestId('trash-table-filter'), /^Visitas/).catch(() => undefined);
    await page.waitForLoadState('networkidle');
    await expect(item).toHaveCount(0);
    await radixPick(page, page.getByTestId('trash-table-filter'), /^Clientes/);
    await expect(item).toBeVisible();

    await item.getByTestId('trash-restore').click();
    await expect(toast(page, '2 registros restaurados (com sub-registros)')).toBeVisible();
    await expect(item).toHaveCount(0);
    await records(page);
    await expect(row(page, name)).toHaveCount(1);
  });

  test('[O-11/8] Ana abre a lixeira: lista vazia', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await go(page, '/trash');
    await expect(page).toHaveURL(/\/trash/);
    await expect(page.getByTestId('trash-empty-state')).toContainText('A lixeira está vazia');
    await expect(page.getByTestId('trash-list')).toHaveCount(0);
  });

  test('[O-12/1] Dora abre o canal da tabela', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await go(page, '/chat');
    const opened = page.waitForResponse((r) => r.url().includes('/chat/channels/group/clientes') && r.ok());
    await page.getByRole('button', { name: 'Clientes', exact: true }).click();
    await opened;
    await expect(page.locator('header').getByText('Clientes', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Escreva uma mensagem… ou /comando')).toBeVisible();
  });

  test('[O-12/2-3] Ana ve o canal e a mensagem chega para a Dora', async ({ browser }) => {
    const doraPage = await as(browser, 'dora');
    await go(doraPage, '/chat');
    await doraPage.getByRole('button', { name: 'Clientes', exact: true }).click();
    await expect(doraPage.getByPlaceholder('Escreva uma mensagem… ou /comando')).toBeVisible();

    const page = await as(browser, 'ana');
    await go(page, '/chat');
    await page.getByRole('button', { name: 'Clientes', exact: true }).click();
    const text = `UI oi time ${RUN}`;
    await page.getByPlaceholder('Escreva uma mensagem… ou /comando').fill(text);
    await page.keyboard.press('Enter');
    await expect(page.getByText(text)).toBeVisible();
    await expect(doraPage.getByText(text)).toBeVisible({ timeout: 6_000 });
  });

  test('[O-12/4] Abrir chat pelo menu da linha', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    await rowMenu(page, A1, 'Abrir chat');
    await page.waitForURL(/\/chat\?thread=clientes:/);
    await expect(page.getByRole('button', { name: A1 })).toBeVisible();
    await expect(page.getByRole('main').getByText('Registros', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Escreva uma mensagem… ou /comando')).toBeVisible();
  });

  test('[O-12/5] Novo chat: tabela e registro', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await records(page);
    await createViaForm(page, { nome: A3, email: `ui.a3.${RUN}@example.com` });
    await go(page, '/chat');
    await page.getByRole('button', { name: 'Novo chat' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('select').selectOption('clientes');
    await dialog.getByPlaceholder('Buscar em Clientes…').fill(A3);
    await dialog.getByRole('button', { name: A3 }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: A3 })).toBeVisible();
    await expect(page.getByPlaceholder('Escreva uma mensagem… ou /comando')).toBeVisible();
  });

  test('[O-12/9] conversa direta Ana e Gil', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await go(page, '/chat');
    await page.getByTestId('new-dm').click();
    await page.getByTestId('dm-search').fill('gil');
    await page.getByRole('dialog').getByRole('button', { name: /Gil/ }).click();
    await expect(page.locator('aside').getByRole('button', { name: 'Gil', exact: true })).toBeVisible();
    const text = `UI direta ${RUN}`;
    await page.getByPlaceholder('Escreva uma mensagem… ou /comando').fill(text);
    await page.keyboard.press('Enter');
    await expect(page.getByText(text)).toBeVisible();

    const gil = await as(browser, 'gil');
    await go(gil, '/chat');
    await expect(gil.locator('aside').getByText('Diretas', { exact: true })).toBeVisible();
    await gil.locator('aside').getByRole('button', { name: 'Ana', exact: true }).click();
    await expect(gil.getByText(text)).toBeVisible();
    // Terceiro nao ve a conversa.
    const vera = await as(browser, 'vera');
    await go(vera, '/chat');
    await expect(vera.locator('aside').getByRole('button', { name: /^(Ana|Gil)$/ })).toHaveCount(0);
  });

  test('[O-14/8-9] sino sobrevive ao recarregar; marcar todas e limpar', async ({ browser, request }) => {
    const page = await as(browser, 'gil');
    await go(page, '/home');
    const bell = page.getByRole('button').filter({ has: page.locator('svg.lucide-bell') });
    const unread = bell.locator('span.bg-red-500');
    const name = `UI Aviso O14 ${RUN}`;
    await createRecord(request, name);
    await expect(toast(page, new RegExp(name)).or(unread).first()).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(unread).toBeVisible();
    await bell.click();
    const panel = page.locator('[data-radix-popper-content-wrapper]');
    await expect(panel.getByText(/O14/).first()).toBeVisible();

    await panel.getByRole('button', { name: 'Marcar todas' }).click();
    await expect(unread).toHaveCount(0);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(unread).toHaveCount(0);

    await bell.click();
    await expect(panel.getByText(/O14/).first()).toBeVisible();
    await panel.getByRole('button').filter({ has: page.locator('svg.lucide-trash-2') }).click();
    await expect(panel.getByText('Nenhuma notificacao')).toBeVisible();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await bell.click();
    await expect(panel.getByText('Nenhuma notificacao')).toBeVisible();
  });

  test('[O-15/1-3] chamado: validacao, abrir e Dora ve', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await go(page, '/support');
    await page.getByTestId('ticket-new').click();
    await page.locator('#ticket-subject').fill('ab');
    await page.locator('#ticket-body').fill('UI Erro ao exportar');
    await expect(page.getByTestId('ticket-submit')).toBeDisabled();
    const subject = `UI Não consigo exportar ${RUN}`;
    await page.locator('#ticket-subject').fill(subject);
    await radixPick(page, page.getByTestId('ticket-category'), 'Problema');
    await radixPick(page, page.getByTestId('ticket-priority'), 'Alta');
    await page.getByTestId('ticket-submit').click();
    await expect(toast(page, /Chamado #\d+ aberto/)).toBeVisible();
    await page.waitForURL(/\/support\//, { timeout: 15_000 }).catch(() => undefined);

    const doraPage = await as(browser, 'dora');
    await go(doraPage, '/support');
    const ticket = doraPage.getByTestId('tickets-list').locator('a').filter({ hasText: subject });
    await expect(ticket).toBeVisible();
    await expect(ticket).toContainText('Ana');

    // Chamado nao tem exclusao: fica resolvido para sair da fila.
    await ticket.click();
    await doraPage.waitForURL(/\/support\/[^/]+$/);
    await doraPage.getByTestId('ticket-resolve').click();
    await expect(toast(doraPage, 'Chamado marcado como resolvido')).toBeVisible();
  });

  test('[O-16] perfil: alterar nome e restaurar', async ({ browser }) => {
    const page = await as(browser, 'vera');
    await go(page, '/settings');
    const save = page.getByRole('button', { name: 'Salvar', exact: true });
    const nameInput = page.locator('#name');
    await expect(nameInput).not.toHaveValue('');
    try {
      await nameInput.fill(`Vera UI ${RUN}`);
      await save.click();
      // O roteiro nao pede mensagem: esta tela salva sem toast. O nome muda no resumo da conta.
      await expect(page.getByText(`Vera UI ${RUN}`).first()).toBeVisible();
      await expect(save).toBeDisabled();
    } finally {
      await nameInput.fill('Vera');
      if (await save.isEnabled()) await save.click();
      await expect(save).toBeDisabled();
    }
    await page.reload();
    await expect(nameInput).toHaveValue('Vera');
  });

  test('[O-16] senha: confirmacao diferente, sem enviar', async ({ browser }) => {
    const page = await as(browser, 'vera');
    const saved = writes(page, /password/i);
    await go(page, '/settings');
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(1).fill('nao-e-a-senha-1');
    await passwords.nth(2).fill('nao-e-a-senha-2');
    await expect(page.getByText('As senhas não coincidem')).toBeVisible();
    expect(saved).toEqual([]);
  });

  test('[O-16 idioma] escolher English abre a interface em ingles', async ({ browser }) => {
    // BUG: settings/page.tsx:101 monta /{idioma}{pathname} com o usePathname de tenant-navigation,
    // que tira a empresa da URL. O destino vira /en/settings e a tela fica em branco.
    const page = await as(browser, 'vera');
    try {
      await go(page, '/settings');
      await page.getByRole('button', { name: 'Idioma' }).click();
      await page.getByRole('button', { name: /English/ }).click();
      await page.waitForURL(/\/en\//, { timeout: 15_000 });
      await expect(page).toHaveURL(new RegExp(`/en/${slug}/settings`));
    } finally {
      await go(page, '/settings'); // devolve o idioma para pt-BR
    }
  });

  test('[O-16] idioma pela URL com empresa funciona e volta', async ({ browser }) => {
    const page = await as(browser, 'vera');
    try {
      await page.goto(`/en/${slug}/settings`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    } finally {
      await go(page, '/settings');
    }
    await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
  });

  test('[O-16] tema claro, escuro e sistema', async ({ browser }) => {
    const page = await as(browser, 'vera');
    await go(page, '/settings');
    await page.getByRole('button', { name: 'Tema', exact: true }).click();
    const html = page.locator('html');
    try {
      await page.getByRole('button', { name: /^Escuro/ }).click();
      await expect(html).toHaveClass(/dark/);
      await page.getByRole('button', { name: /^Claro/ }).click();
      await expect(html).not.toHaveClass(/dark/);
    } finally {
      await page.getByRole('button', { name: /^Sistema/ }).click();
    }
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('system');
  });

  test('[S-03/1] aparelhos conectados marcam este aparelho', async ({ browser }) => {
    const page = await as(browser, 'gil');
    const second = await (await browser.newContext()).newPage();
    try {
      await login(second, 'gil');
      await go(second, '/settings?tab=security');
      const card = second.getByTestId('sessions-card');
      await expect(card).toBeVisible();
      await expect(second.getByTestId('session-current')).toHaveCount(1);
      await expect(second.getByTestId('session-current')).toContainText('Este aparelho');
      expect(await second.getByTestId('session-other').count()).toBeGreaterThanOrEqual(1);
      await go(page, '/settings?tab=security');
      await expect(page.getByTestId('session-current')).toHaveCount(1);
    } finally {
      await second.context().close();
    }
  });
});

test.describe('Limpeza', () => {
  test('[LIMPEZA] apaga o que tem prefixo UI', async ({ request }) => {
    test.setTimeout(240_000);
    const session = await dora(request);
    const channels = await listOf(request, session, '/chat/channels');
    for (const channel of channels.filter((c) => String(c.name ?? '').startsWith('UI '))) {
      await call(request, 'delete', `/chat/channels/${channel.id}`, session, { expected: [200, 204] });
    }
    for (const entity of ['visitas', 'clientes']) {
      const list = await listOf(request, session, `/data/${entity}?limit=100&search=UI`);
      for (const record of list) {
        const label = String(record.data?.nome ?? record.data?.resumo ?? '');
        if (label.startsWith('UI ')) await call(request, 'delete', `/data/${entity}/${record.id}`, session, { expected: [200, 204, 404] });
      }
    }
    const trash = await listOf(request, session, '/trash?limit=100&search=UI');
    for (const item of trash.filter((i) => String(i.title ?? '').startsWith('UI '))) {
      await call(request, 'delete', `/trash/${item.entity.slug}/${item.id}`, session, { expected: [200, 204, 404] });
    }
    for (const path of ['/dashboard-templates', '/pdf-templates', '/public-links']) {
      for (const item of await listOf(request, session, `${path}?limit=100`)) {
        if (String(item.name ?? '').startsWith('UI ')) await call(request, 'delete', `${path}/${item.id}`, session, { expected: [200, 204] });
      }
    }
    const left = await listOf(request, session, '/data/clientes?limit=100&search=UI');
    expect(left.filter((record) => String(record.data?.nome ?? '').startsWith('UI ')).map((r) => r.data?.nome)).toEqual([]);
    expect((await listOf(request, session, '/trash?limit=100&search=UI')).filter((i) => String(i.title ?? '').startsWith('UI '))).toEqual([]);
    expect((await listOf(request, session, '/chat/channels')).filter((c) => String(c.name ?? '').startsWith('UI ')).map((c) => c.name)).toEqual([]);
    for (const path of ['/dashboard-templates', '/pdf-templates', '/public-links']) {
      expect((await listOf(request, session, `${path}?limit=100`)).filter((item) => String(item.name ?? '').startsWith('UI ')).map((item) => item.name), path).toEqual([]);
    }
    const roles = await listOf(request, session, '/custom-roles?limit=100');
    expect(roles.filter((role) => role.name === 'Publico - Clientes').map((role) => role.name)).toEqual([]);
  });
});
