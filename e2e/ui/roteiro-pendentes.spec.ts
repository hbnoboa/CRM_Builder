import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { APIRequestContext, Browser, BrowserContext, expect, Locator, Page, test } from '@playwright/test';
import { API, call, loginStaff, Session } from '../api/helpers';

// Telas do roteiro (docs/teste-e2e-completo.md) que ainda nao tinham teste, sobre o cenario de
// pnpm test:seed. Le as contas de e2e/.dev-accounts.local.json e as senhas do ambiente. Rode com
// --workers=1: os testes seguem a ordem do arquivo. Tudo o que e criado leva o prefixo "UI PEND " e o
// ultimo teste apaga. O que muda configuracao (organizacao, plano, preferencias) restaura num finally.
const seed = JSON.parse(readFileSync(process.env.ACCOUNTS_FILE || 'e2e/.dev-accounts.local.json', 'utf8'));
const PASSWORD = process.env.QA_PASSWORD!;
const slug: string = seed.slug;
const tenantId: string = seed.tenantId;
const mail = (nick: string): string => seed.accounts[nick];

// O processo principal define o valor e os workers herdam: reinicio de worker mantem os nomes.
process.env.UI_PEND_RUN ??= Date.now().toString(36);
const RUN = process.env.UI_PEND_RUN;
const PREFIX = 'UI PEND ';
const named = (what: string): string => `${PREFIX}${what} ${RUN}`;

test.use({ actionTimeout: 20_000 });

const contexts = new Map<string, BrowserContext>();

/** O limite de login e por IP + e-mail: reaproveita o contexto e, se bater no limite, espera. */
async function submitLogin(page: Page, loginPath: string, email: string, password: string, success: () => Promise<unknown>): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto(loginPath);
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('button[type="submit"]').click();
    const limited = page.getByText('Muitas tentativas').first();
    const outcome = await Promise.race([
      success().then(() => 'ok' as const),
      limited.waitFor({ timeout: 30_000 }).then(() => 'limited' as const),
    ]);
    if (outcome === 'ok') return;
    await page.waitForTimeout(20_000);
  }
  throw new Error('Login limitado por tempo demais');
}

async function login(page: Page, nick: string): Promise<void> {
  await submitLogin(page, '/pt-BR/login', mail(nick), PASSWORD, () => page.waitForURL(new RegExp(`/${slug}/home`), { timeout: 30_000 }));
}

async function loginConsole(page: Page, email: string, password: string): Promise<void> {
  await submitLogin(page, '/pt-BR/admin/login', email, password, () => page.getByRole('link', { name: 'Clientes' }).first().waitFor({ timeout: 30_000 }));
}

async function as(browser: Browser, nick: string): Promise<Page> {
  let context = contexts.get(nick);
  if (!context) {
    context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
    const page = await context.newPage();
    await login(page, nick);
    contexts.set(nick, context);
    return page;
  }
  return context.newPage();
}

async function asStaff(browser: Browser, nick: 'paula' | 'sergio' | 'fabio' | 'lia'): Promise<Page> {
  const key = `staff:${nick}`;
  let context = contexts.get(key);
  if (!context) {
    context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    if (nick === 'paula') await loginConsole(page, process.env.PLATFORM_EMAIL!, process.env.PLATFORM_PASSWORD!);
    else await loginConsole(page, mail(nick), PASSWORD);
    contexts.set(key, context);
    return page;
  }
  return context.newPage();
}

const go = async (page: Page, path: string): Promise<void> => {
  await page.goto(`/pt-BR/${slug}${path}`);
  await page.waitForLoadState('networkidle');
};
const goConsole = async (page: Page, path: string): Promise<void> => {
  await page.goto(`/pt-BR/admin${path}`);
  await page.waitForLoadState('networkidle');
};

const toast = (page: Page, text: string | RegExp): Locator => page.locator('[data-sonner-toast]').filter({ hasText: text });
const row = (page: Page, name: string): Locator => page.locator('tbody tr').filter({ hasText: name });
const records = (page: Page, entity = 'clientes'): Promise<void> => go(page, `/data?entity=${entity}`);

async function radixPick(page: Page, trigger: Locator, option: string | RegExp): Promise<void> {
  await trigger.click();
  await page.getByRole('option', { name: option }).first().click();
}

const sessions = new Map<string, Session>();

async function apiUser(request: APIRequestContext, nick: string): Promise<Session> {
  const known = sessions.get(nick);
  if (known) return known;
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await request.post(`${API}/auth/login`, { data: { email: mail(nick), password: PASSWORD } });
    if (response.status() === 429 || response.status() === 503) {
      await new Promise((done) => setTimeout(done, 20_000));
      continue;
    }
    expect(response.ok(), `login de ${nick} pela API: ${response.status()}`).toBeTruthy();
    const body = await response.json();
    const session: Session = { token: body.accessToken, slug, userId: body.user?.id, email: mail(nick) };
    sessions.set(nick, session);
    return session;
  }
  throw new Error(`Login limitado: ${nick}`);
}

const dora = (request: APIRequestContext): Promise<Session> => apiUser(request, 'dora');

async function paulaApi(request: APIRequestContext): Promise<Session> {
  const known = sessions.get('staff:paula');
  if (known) return known;
  const session = await loginStaff(request, process.env.PLATFORM_EMAIL!, process.env.PLATFORM_PASSWORD!);
  sessions.set('staff:paula', session);
  return session;
}

/**
 * Visitantes de link publico nao aparecem em /users da empresa: a busca do console acha pelo e-mail.
 * Remove so os criados por estes testes, e so na QA Total. Depois disso o cargo do link pode sair.
 */
async function removeVisitors(request: APIRequestContext, session: Session): Promise<void> {
  const paula = await paulaApi(request);
  const people = await listOf(request, paula, '/platform/users?q=ui.pend.pub');
  for (const person of people.filter((item) => String(item.email).startsWith('ui.pend.pub') && item.memberships?.every((m: { tenant: { id: string } }) => m.tenant.id === tenantId))) {
    await call(request, 'delete', `/users/${person.id}`, session, { expected: [200, 204, 404] });
  }
}

/**
 * Tira de cena o cargo que o link publico cria. Pessoa excluida continua contando no cargo (ver
 * [E-08 cargo sem ninguem]), entao o DELETE responde 409: o cargo fica com o prefixo, sem ninguem ativo.
 */
async function retireLinkRole(request: APIRequestContext, session: Session): Promise<void> {
  for (const role of (await listOf(request, session, '/custom-roles?limit=100')).filter((item) => item.name === 'Publico - Clientes')) {
    const removed = await call(request, 'delete', `/custom-roles/${role.id}`, session);
    if (removed.status() === 409) await call(request, 'patch', `/custom-roles/${role.id}`, session, { expected: 200, data: { name: named('residuo Publico - Clientes') } });
    else expect([200, 204]).toContain(removed.status());
  }
}

const listOf = async (request: APIRequestContext, session: Session, path: string): Promise<Array<Record<string, any>>> => {
  const body = await (await call(request, 'get', path, session, { expected: 200 })).json();
  return Array.isArray(body) ? body : body.data ?? [];
};

test.beforeAll(({ baseURL }) => {
  // Os testes criam e apagam dados: so rodam em dev.
  expect(new URL(baseURL!).hostname).not.toBe('iossystem.com.br');
  expect(PASSWORD, 'defina QA_PASSWORD').toBeTruthy();
});

test.afterEach(async () => {
  // Fecha as abas, mantem os contextos logados.
  for (const context of contexts.values()) for (const page of context.pages()) await page.close({ runBeforeUnload: false });
});

test.describe('Plataforma', () => {
  test('[P-02] console e empresa convivem no mesmo navegador', async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const consolePage = await context.newPage();
      await loginConsole(consolePage, process.env.PLATFORM_EMAIL!, process.env.PLATFORM_PASSWORD!);
      const tenantPage = await context.newPage();
      await login(tenantPage, 'vera');

      await consolePage.reload();
      await expect(consolePage.getByRole('link', { name: 'Clientes' }).first()).toBeVisible();
      await tenantPage.reload();
      await expect(tenantPage).toHaveURL(new RegExp(`/${slug}/home`));

      // Sair do console nao derruba a empresa.
      await consolePage.getByTestId('platform-logout').click();
      await consolePage.waitForURL(/\/admin\/login/);
      await tenantPage.reload();
      await tenantPage.waitForLoadState('networkidle');
      await expect(tenantPage).toHaveURL(new RegExp(`/${slug}/home`));

      // Sair da empresa nao derruba o console.
      await loginConsole(consolePage, process.env.PLATFORM_EMAIL!, process.env.PLATFORM_PASSWORD!);
      await tenantPage.evaluate(() => localStorage.removeItem('accessToken'));
      await tenantPage.evaluate(() => localStorage.removeItem('refreshToken'));
      await tenantPage.goto('/pt-BR/login');
      await consolePage.reload();
      await expect(consolePage.getByRole('link', { name: 'Clientes' }).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('[P-03] trocar a propria senha do console', async ({ browser, request }) => {
    // Usa a Lia e devolve a senha no finally. Se a troca de volta falhar, a Paula redefine.
    const temporary = `UiPend${RUN}Aa9x`;
    const page = await asStaff(browser, 'lia');
    let changed = false;
    const posted: number[] = [];
    page.on('response', (r) => { if (r.url().endsWith('/change-password')) posted.push(r.status()); });
    const open = async (): Promise<Locator> => {
      await page.getByTitle('Trocar senha').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      return dialog;
    };
    const submit = (dialog: Locator) => dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    try {
      await goConsole(page, '');
      let dialog = await open();
      await dialog.locator('#current-password').fill('senha-atual-errada-1');
      await dialog.locator('#new-password').fill(temporary);
      await submit(dialog);
      await expect(toast(page, 'Senha atual incorreta')).toBeVisible();
      expect(posted.pop()).toBeGreaterThanOrEqual(400);

      // 9 caracteres: o navegador barra no campo, nada vai para a API.
      await dialog.locator('#current-password').fill(PASSWORD);
      await dialog.locator('#new-password').fill('Abcdefg12');
      const before = posted.length;
      await submit(dialog);
      expect(await dialog.locator('#new-password').evaluate((el) => (el as HTMLInputElement).validity.tooShort)).toBeTruthy();
      await page.waitForTimeout(500);
      expect(posted.length).toBe(before);

      await dialog.locator('#new-password').fill('somenteminusculas');
      await submit(dialog);
      await expect(toast(page, 'Erro de validacao')).toBeVisible();

      await dialog.locator('#new-password').fill(temporary);
      await submit(dialog);
      await expect(toast(page, 'Senha alterada')).toBeVisible();
      changed = true;
      await expect(dialog).toHaveCount(0);

      dialog = await open();
      await dialog.locator('#current-password').fill(temporary);
      await dialog.locator('#new-password').fill(PASSWORD);
      await submit(dialog);
      await expect(toast(page, 'Senha alterada').last()).toBeVisible();
      changed = false;
    } finally {
      if (changed) {
        const paula = await paulaApi(request);
        const staff = await listOf(request, paula, '/platform/staff');
        const lia = staff.find((item) => item.email === mail('lia'))!;
        await call(request, 'patch', `/platform/staff/${lia.id}`, paula, { expected: 200, data: { password: PASSWORD } });
      }
    }
    // A senha original voltou e a Auditoria registrou a troca.
    await loginStaff(request, mail('lia'), PASSWORD);
    const audit = await asStaff(browser, 'paula');
    await goConsole(audit, '/audit');
    await expect(audit.locator('tr').filter({ hasText: 'trocou a própria senha' }).filter({ hasText: 'Lia' }).first()).toBeVisible();
  });

  test('[P-04] visao geral', async ({ browser }) => {
    const page = await asStaff(browser, 'paula');
    await goConsole(page, '');
    const stats = page.getByTestId('platform-stats');
    for (const label of ['Clientes', 'Ativo', 'Em teste', 'Usuários ativos']) await expect(stats.getByText(label, { exact: true }), label).toBeVisible();
    await expect(page.getByText('Testes terminando nos próximos 7 dias')).toBeVisible();
    await expect(page.getByText('Novos clientes (30 dias)')).toBeVisible();
    await page.getByRole('link').filter({ hasText: 'Em teste' }).first().click();
    await page.waitForURL(/\/admin\/tenants\?lifecycle=TRIAL/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(`QA Total ${seed.suffix}`).first()).toBeVisible();
  });

  test('[P-11/1-6] entrar como: faixa, registros, bloqueio, sessao e saida', async ({ browser }) => {
    const page = await asStaff(browser, 'sergio');
    await goConsole(page, `/tenants/${tenantId}`);
    await page.locator('tr').filter({ hasText: mail('bruno') }).getByRole('button', { name: 'Entrar como' }).click();
    await page.waitForURL(new RegExp(`/${slug}/home`), { timeout: 30_000 });
    await expect(page.getByText(/Você está impersonando/)).toContainText('Bruno');
    await expect(page.getByText(/Você está impersonando/)).toContainText('Sérgio');

    // 2. Ve exatamente o que o Bruno ve (X-01).
    await records(page);
    await expect(page.getByText('Cliente A', { exact: true })).toBeVisible();
    await expect(page.getByText('Cliente B', { exact: true })).toBeVisible();
    await expect(page.getByText('Cliente C', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Cliente D', { exact: true })).toHaveCount(0);

    // 3. Troca de senha bloqueada. A senha atual esta errada de proposito: nunca troca de verdade.
    // ROTEIRO: o passo diz "Configuracoes > Seguranca", mas o formulario de senha fica na aba Perfil.
    await go(page, '/settings');
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill('senha-atual-errada-1');
    await passwords.nth(1).fill(`UiPend${RUN}Aa9!x`);
    await passwords.nth(2).fill(`UiPend${RUN}Aa9!x`);
    const blocked = page.waitForResponse((r) => r.request().method() !== 'GET' && /password/i.test(new URL(r.url()).pathname));
    await page.getByRole('button', { name: 'Alterar Senha' }).click();
    const refusal = await blocked;
    expect(refusal.status()).toBe(403);
    expect((await refusal.json()).message).toBe('Acao sensivel bloqueada em sessao de impersonacao: trocar a senha');

    // 4. Na conta do Bruno, a sessao aparece com o selo do suporte.
    const bruno = await as(browser, 'bruno');
    await go(bruno, '/settings?tab=security');
    const support = bruno.getByTestId('sessions-card').getByText(/Suporte: Sérgio/);
    await expect(support.first()).toBeVisible();
    const during = await support.count();

    // 5. Sair volta ao console e a sessao some dos aparelhos do Bruno.
    await page.getByRole('button', { name: /Sair da impersona/i }).click();
    await page.waitForURL(new RegExp(`/admin/tenants/${tenantId}`), { timeout: 30_000 });
    await bruno.reload();
    await bruno.waitForLoadState('networkidle');
    await expect(support).toHaveCount(during - 1);
    // Sessoes de suporte de rodadas interrompidas nao ficam para tras.
    const stale = bruno.getByTestId('session-other').filter({ hasText: /Suporte: Sérgio/ });
    while (await stale.count()) {
      const left = await stale.count();
      await stale.first().getByRole('button').click();
      await expect(stale).toHaveCount(left - 1);
    }

    // 6. Auditoria do console com IP.
    await goConsole(page, '/audit');
    const audited = page.locator('tr').filter({ hasText: 'entrou como usuário' }).filter({ hasText: 'Sérgio' }).first();
    await expect(audited).toBeVisible();
    await expect(audited.locator('td').last()).not.toHaveText('—');
  });

  test('[P-11/3 mensagem] troca de senha bloqueada mostra o motivo', async ({ browser }) => {
    const page = await asStaff(browser, 'sergio');
    await goConsole(page, `/tenants/${tenantId}`);
    await page.locator('tr').filter({ hasText: mail('bruno') }).getByRole('button', { name: 'Entrar como' }).click();
    await page.waitForURL(new RegExp(`/${slug}/home`), { timeout: 30_000 });
    try {
      await go(page, '/settings');
      const passwords = page.locator('input[type="password"]');
      await passwords.nth(0).fill('senha-atual-errada-1');
      await passwords.nth(1).fill(`UiPend${RUN}Aa9!x`);
      await passwords.nth(2).fill(`UiPend${RUN}Aa9!x`);
      await page.getByRole('button', { name: 'Alterar Senha' }).click();
      await expect(toast(page, 'Acao sensivel bloqueada em sessao de impersonacao: trocar a senha')).toBeVisible();
    } finally {
      await page.getByRole('button', { name: /Sair da impersona/i }).click();
      await page.waitForURL(new RegExp(`/admin/tenants/${tenantId}`), { timeout: 30_000 });
    }
  });

  test('[P-11/7] Dora impersonada nao exporta, nao encerra e nao gere cargos', async ({ browser }) => {
    const page = await asStaff(browser, 'sergio');
    await goConsole(page, `/tenants/${tenantId}`);
    await page.locator('tr').filter({ hasText: mail('dora') }).getByRole('button', { name: 'Entrar como' }).click();
    await page.waitForURL(new RegExp(`/${slug}/home`), { timeout: 30_000 });
    try {
      await go(page, '/gestao/privacy');
      await page.getByTestId('privacy-export-button').click();
      await expect(toast(page, 'Nao disponivel ao entrar como outra pessoa')).toBeVisible();

      // Senha errada de proposito: mesmo sem o bloqueio, a empresa nao seria encerrada.
      await page.getByTestId('privacy-close-open').click();
      const closeDialog = page.getByRole('dialog').or(page.getByRole('alertdialog')).first();
      const tenantName = `QA Total ${seed.suffix}`;
      const inputs = closeDialog.locator('input');
      await inputs.nth(0).fill(tenantName);
      await closeDialog.locator('input[type="password"]').fill('senha-errada-de-proposito-1');
      await closeDialog.getByRole('button', { name: /Encerrar/ }).last().click();
      await expect(toast(page, 'Nao disponivel ao entrar como outra pessoa')).toBeVisible();
      await page.keyboard.press('Escape');

      await go(page, '/gestao/roles');
      await page.getByRole('button', { name: 'Novo Cargo' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('input').first().fill(named('Cargo bloqueado'));
      await dialog.getByRole('button', { name: /Criar|Salvar/ }).last().click();
      await expect(toast(page, 'Acao sensivel bloqueada em sessao de impersonacao: criar cargo')).toBeVisible();
      await page.keyboard.press('Escape');
    } finally {
      await page.getByRole('button', { name: /Sair da impersona/i }).click();
      await page.waitForURL(new RegExp(`/admin/tenants/${tenantId}`), { timeout: 30_000 });
    }
  });

  test('[P-13] comunicado: criar, publicar para a QA Total, faixa, fechar, tirar do ar e excluir', async ({ browser, request }) => {
    const paula = await paulaApi(request);
    const title = named('Manutenção sábado');
    const critical = named('Crítico');
    const card = (page: Page, name: string): Locator => page.getByTestId(`console-announcement-${name}`);
    const banner = (page: Page, name: string): Locator => page.getByTestId('announcements').locator('> div').filter({ hasText: name });
    try {
      const page = await asStaff(browser, 'sergio');
      await goConsole(page, '/announcements');
      await page.getByTestId('announcement-new').click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('#ann-title').fill(title);
      await dialog.locator('#ann-body').fill('UI PEND aviso de teste');
      await radixPick(page, dialog.getByTestId('ann-severity'), 'Atenção');
      await radixPick(page, dialog.getByTestId('ann-audience'), 'Empresas específicas');
      await dialog.getByTestId('ann-tenant-search').fill(`QA Total ${seed.suffix}`);
      await dialog.getByTestId(`ann-option-QA Total ${seed.suffix}`).getByRole('checkbox').click();
      await expect(dialog.getByTestId('ann-reach')).toHaveText('Vai aparecer para 1 empresa');

      await dialog.locator('#ann-link').fill('exemplo.com');
      await dialog.getByTestId('ann-save').click();
      await expect(toast(page, 'O link precisa comecar com http:// ou https://')).toBeVisible();
      await dialog.locator('#ann-link').fill('https://dev.iossystem.com.br/health');

      const tomorrow = new Date(Date.now() + 86_400_000);
      const local = (date: Date): string => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      await dialog.locator('#ann-start').fill(local(tomorrow));
      await dialog.locator('#ann-end').fill(local(new Date(Date.now() + 3_600_000)));
      await dialog.getByTestId('ann-save').click();
      await expect(toast(page, 'O fim precisa ser depois do inicio')).toBeVisible();
      await dialog.locator('#ann-end').fill('');
      await dialog.locator('#ann-start').fill(local(new Date(Date.now() - 60_000)));

      await dialog.getByTestId('ann-save').click();
      await expect(toast(page, 'Comunicado salvo')).toBeVisible();
      await expect(card(page, title).getByTestId('state-draft')).toBeVisible();

      // Trava de seguranca: so publica se o publico gravado for exatamente a QA Total.
      const saved = (await listOf(request, paula, '/platform/announcements')).find((item) => item.title === title)!;
      expect(saved.audience).toEqual({ type: 'tenants', ids: [tenantId] });

      await card(page, title).getByTestId('announcement-publish').click();
      await expect(toast(page, 'Comunicado publicado')).toBeVisible();
      await expect(card(page, title).getByTestId('state-active')).toBeVisible();

      const ana = await as(browser, 'ana');
      await go(ana, '/home');
      await expect(banner(ana, title)).toBeVisible({ timeout: 15_000 });
      const doraPage = await as(browser, 'dora');
      await go(doraPage, '/home');
      await expect(banner(doraPage, title)).toBeVisible({ timeout: 15_000 });

      await banner(ana, title).getByRole('button', { name: 'Fechar aviso' }).click();
      await expect(banner(ana, title)).toHaveCount(0);
      await ana.waitForLoadState('networkidle');
      await ana.reload();
      await ana.waitForLoadState('networkidle');
      await expect(banner(ana, title)).toHaveCount(0);
      await doraPage.reload();
      await expect(banner(doraPage, title)).toBeVisible({ timeout: 15_000 });
      await page.reload();
      await expect(card(page, title).getByTestId('announcement-stats')).toContainText('1 fecharam');

      // 6. Critico, so para quem administra e sem X.
      await page.getByTestId('announcement-new').click();
      await dialog.locator('#ann-title').fill(critical);
      await dialog.locator('#ann-body').fill('UI PEND critico');
      await radixPick(page, dialog.getByTestId('ann-severity'), 'Crítico');
      await radixPick(page, dialog.getByTestId('ann-audience'), 'Empresas específicas');
      await dialog.getByTestId('ann-tenant-search').fill(`QA Total ${seed.suffix}`);
      await dialog.getByTestId(`ann-option-QA Total ${seed.suffix}`).getByRole('checkbox').click();
      await dialog.locator('#ann-admins').click();
      await dialog.getByTestId('ann-dismissible').click();
      await dialog.getByTestId('ann-save').click();
      await expect(card(page, critical)).toBeVisible();
      const savedCritical = (await listOf(request, paula, '/platform/announcements')).find((item) => item.title === critical)!;
      expect(savedCritical.audience).toEqual({ type: 'tenants', ids: [tenantId] });
      await card(page, critical).getByTestId('announcement-publish').click();
      await expect(card(page, critical).getByTestId('state-active')).toBeVisible();

      await doraPage.reload();
      await expect(banner(doraPage, critical)).toBeVisible({ timeout: 15_000 });
      await expect(banner(doraPage, critical).getByRole('button', { name: 'Fechar aviso' })).toHaveCount(0);
      const alex = await as(browser, 'alex');
      await go(alex, '/home');
      await expect(banner(alex, critical)).toBeVisible({ timeout: 15_000 });
      for (const nick of ['ana', 'vera']) {
        const other = await as(browser, nick);
        await go(other, '/home');
        await expect(banner(other, critical), nick).toHaveCount(0);
      }

      // 7. Tirar do ar some a faixa; excluir pede confirmacao e Cancelar mantem.
      for (const name of [title, critical]) {
        await card(page, name).getByTestId('announcement-unpublish').click();
        await expect(card(page, name).getByTestId('announcement-publish')).toBeVisible();
      }
      await doraPage.reload();
      await doraPage.waitForLoadState('networkidle');
      await expect(banner(doraPage, title)).toHaveCount(0);
      await expect(banner(doraPage, critical)).toHaveCount(0);

      await card(page, title).getByTestId('announcement-delete').click();
      const confirm = page.getByRole('alertdialog');
      await expect(confirm).toContainText(`Excluir o comunicado "${title}"?`);
      await confirm.getByRole('button', { name: 'Cancelar' }).click();
      await expect(card(page, title)).toBeVisible();
      for (const name of [title, critical]) {
        await card(page, name).getByTestId('announcement-delete').click();
        await page.getByTestId('announcement-delete-confirm').click();
        await expect(card(page, name)).toHaveCount(0);
      }
    } finally {
      for (const item of await listOf(request, paula, '/platform/announcements')) {
        if (String(item.title).startsWith(PREFIX)) await call(request, 'delete', `/platform/announcements/${item.id}`, paula, { expected: [200, 204] });
      }
      expect((await listOf(request, paula, '/platform/announcements')).filter((item) => String(item.title).startsWith(PREFIX))).toEqual([]);
    }
  });

  test('[P-14] pessoas: busca, detalhe e Lia sem botoes, sem acao destrutiva', async ({ browser }) => {
    const page = await asStaff(browser, 'sergio');
    const search = async (target: Page, term: string): Promise<void> => {
      await goConsole(target, '/people');
      await target.getByTestId('people-search').fill(term);
    };
    await search(page, 'bru');
    const person = page.getByTestId(`person-${mail('bruno')}`);
    await expect(person).toBeVisible();
    await expect(person).toContainText(`QA Total ${seed.suffix} · Equipe campo`);
    await search(page, mail('bruno'));
    await expect(person).toBeVisible();
    await person.click();
    await page.waitForURL(/\/admin\/people\/[^/]+$/);
    await expect(page.getByRole('heading', { name: 'Bruno' })).toBeVisible();
    await expect(page.getByTestId(`membership-${slug}`)).toContainText('Equipe campo');
    await expect(page.getByTestId('person-sessions')).toBeVisible();
    await expect(page.getByText('Últimas ações').or(page.getByText('Ações recentes')).first()).toBeVisible();

    // Abre a confirmacao e cancela: nao desconecta ninguem.
    for (const id of ['person-reset', 'person-logout']) await expect(page.getByTestId(id), id).toBeVisible();
    await expect(page.getByTestId('person-mfa-reset')).toBeDisabled();
    const url = page.url();

    const lia = await asStaff(browser, 'lia');
    await lia.goto(url);
    await lia.waitForLoadState('networkidle');
    await expect(lia.getByRole('heading', { name: 'Bruno' })).toBeVisible();
    for (const id of ['person-reset', 'person-logout', 'person-mfa-reset', `enter-${slug}`]) await expect(lia.getByTestId(id), id).toHaveCount(0);
  });

  test('[P-18] metricas, saude e auditoria', async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await asStaff(browser, 'paula');
    await goConsole(page, '/metrics');
    await expect(page.getByTestId('metrics-kpis')).toBeVisible();
    for (const months of [24, 6, 12]) {
      await page.getByTestId(`metrics-period-${months}`).click();
      await expect(page.getByTestId(`metrics-period-${months}`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('metrics-kpis')).toBeVisible();
    }
    await page.getByTestId('metrics-toggle-table').click();
    await expect(page.getByTestId('metrics-table')).toBeVisible();
    await expect(page.getByTestId('metrics-plans')).toBeVisible();
    await expect(page.getByText('Clientes sem uso há 30 dias')).toBeVisible();
    await expect(page.getByTestId('metrics-risk')).toBeVisible();
    for (const nick of ['fabio', 'lia'] as const) {
      const other = await asStaff(browser, nick);
      await goConsole(other, '/metrics');
      await expect(other.getByTestId('metrics-kpis'), nick).toBeVisible();
    }

    await goConsole(page, '/health');
    for (const card of ['database', 'redis', 'queues', 'app', 'powersync', 'email', 'push', 'storage', 'problems']) {
      await expect(page.getByTestId(`health-${card}`), card).toBeVisible();
    }
    await expect(page.getByTestId('health-email').getByTestId('status-warning')).toBeVisible();
    await expect(page.getByText('Problemas recentes')).toBeVisible();
    const manual = page.waitForResponse((r) => r.url().includes('/health') && r.ok());
    await page.getByTestId('health-refresh').click();
    await manual;
    await page.waitForTimeout(1_000);
    const automatic = page.waitForResponse((r) => r.url().includes('/health') && r.ok(), { timeout: 40_000 });
    expect((await automatic).ok()).toBeTruthy();

    await goConsole(page, '/audit');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('tbody').getByText('entrou no console').first()).toBeVisible();
    const actions = await rows.locator('td:nth-child(3)').allInnerTexts();
    expect(actions.filter((text) => /^[a-z_]+\.[a-z_]+$/.test(text.trim())), 'acoes sem traducao').toEqual([]);
    const targets = await rows.locator('td:nth-child(4)').allInnerTexts();
    expect(targets.some((text) => ['staff', 'tenant', 'plan', 'announcement', 'user', 'ticket'].includes(text.trim()) || text.includes('@') || text.trim().length > 0)).toBeTruthy();
  });
});

/** PNG valido com ruido, para o upload contar no armazenamento. */
function noisePng(size: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (data: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const typed = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(typed));
    return Buffer.concat([length, typed, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const line = Buffer.alloc(1 + size * 3);
    for (let x = 1; x < line.length; x++) line[x] = Math.floor(Math.random() * 256);
    rows.push(line);
  }
  const { deflateSync } = createRequire(resolve('package.json'))('zlib');
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Abre o seletor de campos do editor e adiciona um campo do tipo pedido, ja com o rotulo. */
async function addField(page: Page, typeLabel: string, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Campo', exact: true }).click();
  const picker = page.getByRole('dialog');
  await picker.getByPlaceholder('Buscar campos...').fill(typeLabel);
  await picker.getByRole('button', { name: new RegExp(typeLabel) }).first().click();
  await expect(picker).toHaveCount(0);
  await page.locator('label').filter({ hasText: /^Rótulo$/ }).locator('..').locator('input').fill(label);
}

const fieldProps = (page: Page) => page.locator('div.w-72, div.lg\\:w-80').last();

async function selectField(page: Page, name: string): Promise<void> {
  await page.locator('.rfb-grid .react-grid-item').filter({ hasText: new RegExp(name, 'i') }).first().click({ position: { x: 8, y: 8 } });
  await expect(fieldProps(page)).toContainText(new RegExp(name, 'i'));
}

async function saveEntity(page: Page, entityId: string): Promise<void> {
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && new URL(r.url()).pathname.endsWith(`/entities/${entityId}`));
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
}

async function createTable(page: Page, name: string, template?: string, category?: string): Promise<string> {
  await go(page, '/gestao/entities');
  await page.getByRole('link', { name: /Nova tabela/i }).first().click();
  await page.waitForURL(/\/gestao\/entities\/new$/);
  if (template) await page.locator('button').filter({ hasText: template }).first().click();
  await page.locator('#name').fill(name);
  if (category) await page.locator('#category').fill(category);
  await page.getByRole('button', { name: 'Criar Tabela' }).click();
  await expect(toast(page, 'Tabela criada!')).toBeVisible();
  await page.waitForURL(/\/gestao\/entities\/(?!new)[^/]+$/, { timeout: 30_000 });
  await expect(page.getByTestId('entity-editor-tabs')).toBeVisible();
  return new URL(page.url()).pathname.split('/').pop()!;
}

test.describe('Administracao', () => {
  test('[E-04/2,4,6] logo, cor e tema: salvar e voltar ao original', async ({ browser, request }) => {
    const session = await dora(request);
    const original = await (await call(request, 'get', '/tenants/me', session, { expected: 200 })).json();
    const page = await as(browser, 'dora');
    const directory = mkdtempSync(join(tmpdir(), 'ui-pend-'));
    const logo = join(directory, 'logo.png');
    writeFileSync(logo, noisePng(150));
    try {
      await go(page, '/gestao/organization');
      const primary = (): Promise<string> => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary'));
      const primaryBefore = await primary();
      await page.getByTestId('logo-input').setInputFiles(logo);
      await expect(page.getByTestId('logo-preview').locator('img')).toBeVisible();

      await page.locator('#org-name').fill(`${original.name} UI`);
      await page.getByTestId('color-hex').fill('#12ab34');
      await page.getByTestId('theme-dark').click();
      await page.getByTestId('organization-save').click();
      await expect(toast(page, 'Organização atualizada')).toBeVisible();

      // Nome na lateral muda na hora, sem recarregar.
      await expect(page.getByTestId('gestao-shell').getByText(`${original.name} UI`).first()).toBeVisible();
      await expect.poll(primary, { message: 'cor da marca aplicada na hora' }).not.toBe(primaryBefore);
      const updated = await (await call(request, 'get', '/tenants/me', session, { expected: 200 })).json();
      expect(updated.settings.theme.brandColor).toBe('#12ab34');
      expect(updated.settings.theme.darkMode).toBe('dark');
      expect(updated.logo).toBeTruthy();
      expect(updated.storageUsedKb, 'logo conta no armazenamento').toBeGreaterThan(original.storageUsedKb);
      await expect(page.getByTestId('logo-preview').locator('img')).toBeVisible();

      // 6. Voltar pela tela.
      await page.getByRole('button', { name: /cor padrão/i }).click();
      await page.getByTestId('theme-system').click();
      await page.getByTestId('logo-remove').click();
      await page.locator('#org-name').fill(original.name);
      await page.getByTestId('organization-save').click();
      await expect(toast(page, 'Organização atualizada').first()).toBeVisible();
    } finally {
      await call(request, 'patch', '/tenants/me', session, {
        expected: 200,
        data: { name: original.name, logo: original.logo, brandColor: original.settings?.theme?.brandColor ?? null, darkMode: original.settings?.theme?.darkMode ?? 'system' },
      });
    }
    const restored = await (await call(request, 'get', '/tenants/me', session, { expected: 200 })).json();
    expect(restored.name).toBe(original.name);
    expect(restored.logo).toBe(original.logo);
    expect(restored.settings?.theme?.brandColor ?? null).toBeNull();
    expect(restored.settings?.theme?.darkMode ?? 'system').toBe('system');
  });

  const CONTACTS = named('Clientes');
  const VISITS = named('Visitas');
  const OPERATIONS = named('Operações');

  test('[E-06/1-3] tabela pelo template: campos, obrigatorio, unico', async ({ browser, request }) => {
    const page = await as(browser, 'dora');
    const id = await createTable(page, CONTACTS, 'Contato', 'CRM');
    await addField(page, 'Imagem', 'Foto');
    await addField(page, 'Select', 'Status');
    const props = fieldProps(page);
    for (const label of ['Novo', 'Em contato', 'Fechado']) {
      await props.getByRole('button', { name: 'Adicionar', exact: true }).click();
      const inputs = props.locator('input[placeholder*="abel"], input[placeholder*="ótulo"], input[placeholder*="Nome"]');
      await inputs.last().fill(label);
    }
    await addField(page, 'Sim/Nao', 'VIP');
    await addField(page, 'CPF', 'CPF');
    const grid = page.locator('.rfb-grid .react-grid-item');
    for (const name of ['Foto', 'Status', 'VIP', 'CPF']) await expect(grid.filter({ hasText: name }).first(), name).toBeVisible();

    // Nome e Email do template: obrigatorio e unico.
    await selectField(page, 'nome');
    const required = props.locator('div').filter({ hasText: /^Obrigatório$/ }).getByRole('switch');
    if ((await required.getAttribute('aria-checked')) !== 'true') await required.click();
    await selectField(page, 'e-?mail');
    const unique = props.locator('div').filter({ hasText: /^Único$/ }).getByRole('switch');
    if ((await unique.getAttribute('aria-checked')) !== 'true') await unique.click();
    await saveEntity(page, id);

    const session = await dora(request);
    const entity = await (await call(request, 'get', `/entities/${id}`, session, { expected: 200 })).json();
    // O template Contato ja traz Status e CPF: vale o ultimo, o que foi adicionado aqui.
    const field = (name: string) => [...entity.fields].reverse().find((item: Record<string, unknown>) => String(item.name).toLowerCase() === name || String(item.label).toLowerCase() === name);
    expect(field('nome').required).toBeTruthy();
    expect((field('email') ?? field('e-mail')).unique).toBeTruthy();
    expect(field('foto').type).toBe('image');
    expect(field('status').options.map((option: { label: string }) => option.label)).toEqual(['Novo', 'Em contato', 'Fechado']);
    expect(field('vip').type).toBe('boolean');
    expect(field('cpf').type).toBe('cpf');
  });

  test('[E-06/2 arrastar] arrastar um campo muda a ordem', async ({ browser, request }) => {
    const session = await dora(request);
    const entity = (await listOf(request, session, '/entities?limit=100')).find((item) => item.name === CONTACTS)!;
    const page = await as(browser, 'dora');
    await go(page, `/gestao/entities/${entity.id}`);
    const grid = page.locator('.rfb-grid .react-grid-item');
    const source = grid.filter({ hasText: 'CPF' }).first();
    await source.scrollIntoViewIfNeeded();
    const from = (await source.boundingBox())!;
    const boxes = await grid.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().y));
    const above = Math.max(...boxes.filter((y) => y < from.y - 5));
    await page.mouse.move(from.x + 30, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(from.x + 34, from.y + 10, { steps: 4 });
    await page.mouse.move(from.x + 34, above + 6, { steps: 25 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(500);
    const moved = (await source.boundingBox())!;
    expect(moved.y, 'CPF subiu no canvas').toBeLessThan(from.y);
  });

  test('[E-06/4-5] tabela do zero e sub-entidade', async ({ browser, request }) => {
    const page = await as(browser, 'dora');
    const session = await dora(request);
    const visitsId = await createTable(page, VISITS, undefined, 'CRM');
    await addField(page, 'Data', 'Data');
    await addField(page, 'Texto', 'Resumo');
    await saveEntity(page, visitsId);
    const visits = await (await call(request, 'get', `/entities/${visitsId}`, session, { expected: 200 })).json();
    const types = visits.fields.map((item: { type: string }) => item.type);
    expect(types).toContain('date');
    expect(types).toContain('text');

    const contacts = (await listOf(request, session, '/entities?limit=100')).find((item) => item.name === CONTACTS)!;
    await go(page, `/gestao/entities/${contacts.id}`);
    await addField(page, 'Sub-entidade', 'Visitas');
    const props = fieldProps(page);
    await props.locator('label').filter({ hasText: 'Sub-entidade (slug)' }).locator('..').locator('input').fill(visits.slug);
    await saveEntity(page, contacts.id);
    const updated = await (await call(request, 'get', `/entities/${contacts.id}`, session, { expected: 200 })).json();
    expect(updated.fields.find((item: { type: string }) => item.type === 'sub-entity').subEntitySlug).toBe(visits.slug);

    // O formulario de um registro novo passa a mostrar a sub-tabela.
    await go(page, `/data?entity=${contacts.slug}`);
    await page.getByRole('button', { name: 'Criar', exact: true }).first().click();
    await expect(page.getByRole('dialog').getByText(`Salve o registro primeiro para adicionar Visitas`)).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('[E-06/6-8] template Ordem de Servico, nome repetido e lista', async ({ browser, request }) => {
    const page = await as(browser, 'dora');
    const session = await dora(request);
    const id = await createTable(page, OPERATIONS, 'Ordem de Servico');
    // O template existe e cria os campos. Automacoes: ver [E-06/6 automacoes].
    const created = await (await call(request, 'get', `/entities/${id}`, session, { expected: 200 })).json();
    expect(created.fields.length).toBeGreaterThan(3);

    await go(page, '/gestao/entities/new');
    await page.locator('#name').fill(OPERATIONS);
    await page.getByRole('button', { name: 'Criar Tabela' }).click();
    await expect(toast(page, /Erro ao criar tabela|Entidade com este slug ja existe/)).toBeVisible();
    await expect(page).toHaveURL(/\/gestao\/entities\/new$/);

    await go(page, '/gestao/entities');
    const contacts = page.locator('a, div').filter({ hasText: CONTACTS }).filter({ hasText: /\d+ campos/ }).last();
    await expect(contacts).toContainText(/\d+ campos/);
    await expect(contacts).toContainText(/\d+ registros/);
    await expect(contacts).toContainText('CRM');
  });


  test('[E-06/6 automacoes] template com automacao cria a automacao', async ({ browser, request }) => {
    const page = await as(browser, 'dora');
    const session = await dora(request);
    const id = await createTable(page, named('Inspeção'), 'Inspecao');
    const automations = await listOf(request, session, `/entities/${id}/automations`);
    expect(automations.map((item) => item.name)).toContain('Notificar inspecao reprovada');
  });

  test('[E-06/7 mensagem] nome repetido mostra o erro da API', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await go(page, '/gestao/entities/new');
    await page.locator('#name').fill(OPERATIONS);
    await page.getByRole('button', { name: 'Criar Tabela' }).click();
    await expect(toast(page, 'Entidade com este slug ja existe')).toBeVisible();
  });

  test('[E-06/11] filtro global esconde VIP de todos e remover volta', async ({ browser, request }) => {
    const page = await as(browser, 'dora');
    const session = await dora(request);
    const contacts = (await listOf(request, session, '/entities?limit=100')).find((item) => item.name === CONTACTS)!;
    const fields: Array<Record<string, string>> = contacts.fields;
    const slugOf = (name: string): string => fields.find((item) => String(item.name).toLowerCase() === name || String(item.label).toLowerCase() === name)!.slug;
    const nome = slugOf('nome');
    const vip = slugOf('vip');
    const plain = named('Filtro comum');
    const special = named('Filtro VIP');
    await call(request, 'post', `/data/${contacts.slug}`, session, { expected: [200, 201], data: { data: { [nome]: plain, [vip]: false } } });
    await call(request, 'post', `/data/${contacts.slug}`, session, { expected: [200, 201], data: { data: { [nome]: special, [vip]: true } } });

    await records(page, contacts.slug);
    await expect(row(page, plain)).toHaveCount(1);
    await expect(row(page, special)).toHaveCount(1);

    await go(page, `/gestao/entities/${contacts.id}`);
    await page.getByTestId('entity-tab-filters').click();
    const panel = page.getByTestId('global-filters');
    await radixPick(page, panel.getByRole('combobox').nth(0), 'VIP');
    await expect(panel.getByRole('combobox').nth(1)).toContainText('Igual');
    await radixPick(page, panel.getByRole('combobox').nth(2), 'Não');
    await panel.getByRole('button', { name: /Adicionar/ }).click();
    await expect(panel.getByTestId('global-filter-chip')).toContainText(/igual a Não/i);
    await page.getByTestId('global-filters-save').click();
    await expect(toast(page, 'Filtro global salvo')).toBeVisible();

    await records(page, contacts.slug);
    await expect(row(page, plain)).toHaveCount(1);
    await expect(row(page, special)).toHaveCount(0);

    await go(page, `/gestao/entities/${contacts.id}`);
    await page.getByTestId('entity-tab-filters').click();
    await panel.getByRole('button', { name: 'Remover filtro' }).click();
    await page.getByTestId('global-filters-save').click();
    await expect(toast(page, 'Filtro global salvo')).toBeVisible();
    await records(page, contacts.slug);
    await expect(row(page, special)).toHaveCount(1);
  });

  test('[E-06/12] regra de campo fica salva e o web ainda nao aplica', async ({ browser, request }) => {
    const page = await as(browser, 'dora');
    const session = await dora(request);
    const contacts = (await listOf(request, session, '/entities?limit=100')).find((item) => item.name === CONTACTS)!;
    const fields: Array<Record<string, string>> = contacts.fields;
    const nomeField = fields.find((item) => String(item.name).toLowerCase() === 'nome')!;
    await go(page, `/gestao/entities/${contacts.id}`);
    await page.getByTestId('entity-tab-rules').click();
    await page.getByRole('button', { name: 'Adicionar regra' }).click();
    const dialog = page.getByRole('dialog');
    await radixPick(page, dialog.getByRole('combobox').nth(0), /mail/i);
    await radixPick(page, dialog.getByRole('combobox').nth(1), /Obrigatorio/);
    await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('1 regra(s)')).toBeVisible();

    // No web a regra nao vale: cria sem Email.
    const name = named('Sem email');
    await records(page, contacts.slug);
    await page.getByRole('button', { name: 'Criar', exact: true }).first().click();
    const form = page.getByRole('dialog');
    await form.locator(`[id="${nomeField.slug}"]`).fill(name);
    await form.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(toast(page, 'Registro criado com sucesso')).toBeVisible();
    await expect(row(page, name)).toHaveCount(1);
  });

  test('[E-06/13] excluir tabela pede o nome', async ({ browser, request }) => {
    const page = await as(browser, 'dora');
    const session = await dora(request);
    const name = named('Lixo');
    const id = await createTable(page, name);
    await page.getByTestId('entity-tab-danger').click();
    await expect(page.getByTestId('entity-delete-confirm')).toBeDisabled();
    await page.getByTestId('entity-delete-name').fill('outro nome');
    await expect(page.getByTestId('entity-delete-confirm')).toBeDisabled();
    await page.getByTestId('entity-delete-name').fill(name);
    await page.getByTestId('entity-delete-confirm').click();
    await page.waitForURL(/\/gestao\/entities$/, { timeout: 30_000 });
    await expect(page.getByText(name)).toHaveCount(0);
    expect((await listOf(request, session, '/entities?limit=100')).some((item) => item.id === id)).toBeFalsy();
  });
});


test.describe('Administracao II', () => {
  const FICHA = named('Ficha do cliente');
  const LISTA = named('Lista de clientes');

  async function createPdfTemplate(page: Page, name: string, batch: boolean): Promise<void> {
    await go(page, '/gestao/pdf-templates/new');
    await page.getByPlaceholder('Ex: Relatorio de Veiculo').fill(name);
    if (batch) await radixPick(page, page.getByRole('combobox').nth(0), /Lote/);
    await radixPick(page, page.getByRole('combobox').nth(1), 'Clientes');
    const created = page.waitForResponse((r) => r.request().method() === 'POST' && /\/pdf-templates$/.test(new URL(r.url()).pathname));
    await page.getByRole('button', { name: 'Criar e Continuar' }).click();
    expect((await created).ok()).toBeTruthy();
    // O editor abre pela lista: o redirecionamento direto e o bug conhecido E-11/2b.
    await page.waitForURL(/\/pdf-templates\/(?!new)[^/]+$/, { timeout: 30_000 });
    await go(page, '/gestao/pdf-templates');
  }

  const pdfCard = (page: Page, name: string): Locator =>
    page.locator('div.rounded-xl, div[class*="rounded"]').filter({ hasText: name }).filter({ has: page.getByRole('link', { name: 'Editar' }) }).last();

  async function addPdfElement(page: Page, label: string): Promise<void> {
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: new RegExp(label) }).first().click();
    await expect(dialog).toHaveCount(0);
  }

  test('[E-11/3] editor: elementos, preview, salvar e publicar', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await createPdfTemplate(page, FICHA, false);
    await expect(pdfCard(page, FICHA)).toContainText('Rascunho');
    await pdfCard(page, FICHA).getByRole('link', { name: 'Editar' }).click();
    await page.waitForURL(/\/pdf-templates\/[^/]+$/);
    await expect(page.getByText('Informacoes do Template')).toBeVisible();
    for (const element of ['Texto', 'Grupo de Campos', 'Divisor']) await addPdfElement(page, element);

    // Esconder e mostrar a previa.
    const preview = page.getByRole('button', { name: 'Preview' });
    await preview.click();
    await preview.click();

    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(toast(page, 'Template salvo com sucesso!')).toBeVisible();
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(toast(page, 'Template publicado com sucesso!')).toBeVisible();

    await go(page, '/gestao/pdf-templates');
    await expect(pdfCard(page, FICHA)).not.toContainText('Rascunho');
    await expect(pdfCard(page, FICHA)).toContainText('Publicado');
  });


  test('[E-11/4] modelo em lote publicado pelo menu', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await createPdfTemplate(page, LISTA, true);
    await expect(pdfCard(page, LISTA)).toContainText('Lote');
    await pdfCard(page, LISTA).getByRole('link', { name: 'Editar' }).click();
    await page.waitForURL(/\/pdf-templates\/[^/]+$/);
    await addPdfElement(page, 'Tabela');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(toast(page, 'Template salvo com sucesso!')).toBeVisible();
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(toast(page, 'Template publicado com sucesso!')).toBeVisible();
  });

  test('[E-11/5] duplicar e excluir a copia', async ({ browser, request }) => {
    const session = await dora(request);
    const page = await as(browser, 'dora');
    await go(page, '/gestao/pdf-templates');
    await pdfCard(page, FICHA).getByRole('button').first().click();
    await page.getByRole('menuitem', { name: 'Duplicar' }).click();
    await expect(toast(page, /duplicado/i)).toBeVisible();
    await page.waitForLoadState('networkidle');

    const before = await listOf(request, session, '/pdf-templates?limit=100');
    const copy = before.find((item) => item.name !== FICHA && String(item.name).includes(FICHA));
    expect(copy, 'copia na lista').toBeTruthy();
    await go(page, '/gestao/pdf-templates');
    await pdfCard(page, copy!.name).getByRole('button').first().click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: /Excluir/ }).click();
    await expect(toast(page, /excluido/i)).toBeVisible();
    expect((await listOf(request, session, '/pdf-templates?limit=100')).some((item) => item.id === copy!.id)).toBeFalsy();
  });

  test('[E-11/6] gerar a partir de um modelo publicado', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await go(page, '/gestao/pdf-templates');
    await pdfCard(page, LISTA).getByRole('button', { name: 'Gerar' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Gerar PDF' })).toBeVisible();
    await expect(dialog.getByText(/\d+\s+registro/).first()).toBeVisible({ timeout: 15_000 });
    const generated = page.waitForResponse((r) => r.request().method() === 'POST' && /pdf/i.test(new URL(r.url()).pathname), { timeout: 60_000 });
    await dialog.getByRole('button', { name: /Gerar PDF \(/ }).click();
    expect((await generated).ok()).toBeTruthy();
    await expect(toast(page, /gerado|sucesso/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('[E-12/1-3] dashboards por cargo', async ({ browser, request }) => {
    const session = await dora(request);
    const page = await as(browser, 'dora');
    const first = named('Painel campo');
    const second = named('Painel segundo');
    try {
      const build = async (name: string, widgets: string[], roles: string[]): Promise<void> => {
        await go(page, '/gestao/dashboard-templates/new');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.getByPlaceholder('Nome do painel').fill(name);
        await radixPick(page, page.locator('button[role="combobox"].w-48'), 'Clientes');
        for (const widget of widgets) {
          const paletteType: Record<string, string> = { 'KPI Card': 'kpi-card', Pizza: 'pie-chart', 'Tabela de Dados': 'data-table' };
          await page.getByTestId(`palette-${paletteType[widget]}`).click();
          if (widget === 'Pizza') {
            const group = page.locator('div.space-y-1\\.5').filter({ has: page.getByText('Campo (agrupar por)', { exact: true }) });
            await radixPick(page, group.getByRole('combobox'), 'Status');
          }
          if (widget === 'Tabela de Dados') {
            for (const label of ['Permitir criar', 'Permitir editar', 'Permitir excluir', 'Permitir exportar']) {
              await expect(page.locator('div.flex.items-center.gap-2').filter({ has: page.getByText(label, { exact: true }) }).getByRole('switch'), label).toHaveAttribute('aria-checked', 'true');
            }
          }
        }
        await page.getByRole('button', { name: 'Quem vê', exact: true }).click();
        const settings = page.getByRole('dialog');
        for (const role of roles) await settings.locator('label').filter({ hasText: new RegExp(`^${role}$`) }).locator('input').check();
        const active = settings.locator('div.flex.items-center').filter({ has: page.getByText('Ativo', { exact: true }) }).getByRole('switch');
        await expect(active).toHaveAttribute('aria-checked', 'true');
        await settings.getByRole('button', { name: 'Fechar' }).last().click();
        await page.getByRole('button', { name: 'Salvar', exact: true }).click();
        await expect(toast(page, 'Template de dashboard criado!')).toBeVisible();
      };
      await build(first, ['KPI Card', 'Pizza', 'Tabela de Dados'], ['Equipe campo', 'Operador']);
      await build(second, ['Pizza', 'Tabela de Dados'], ['Operador']);

      const saved = await listOf(request, session, '/dashboard-templates?limit=100');
      const panel = saved.find((item) => item.name === first)!;
      const types = Object.values(panel.widgets as Record<string, { type: string }>).map((widget) => widget.type).sort();
      expect(types).toEqual(['data-table', 'kpi-card', 'pie-chart'].sort());
      expect(panel.entitySlug).toBe('clientes');
      expect(panel.isActive).toBeTruthy();
      expect(panel.roleIds?.length ?? panel.roles?.length).toBe(2);

      // Operador alterna entre os dois.
      const ana = await as(browser, 'ana');
      await records(ana);
      await expect(ana.getByRole('button', { name: first })).toBeVisible();
      await expect(ana.getByRole('button', { name: second })).toBeVisible();
    } finally {
      for (const item of await listOf(request, session, '/dashboard-templates?limit=100')) {
        if (String(item.name).startsWith(PREFIX)) await call(request, 'delete', `/dashboard-templates/${item.id}`, session, { expected: [200, 204] });
      }
      expect((await listOf(request, session, '/dashboard-templates?limit=100')).filter((item) => String(item.name).startsWith(PREFIX))).toEqual([]);
    }
  });

  test('[E-15/4-6] webhook com destino no proprio dev: salvar, testar e envios', async ({ browser, request }) => {
    const session = await dora(request);
    const name = named('Webhook');
    const record = named('Webhook registro');
    const page = await as(browser, 'dora');
    try {
      await go(page, '/gestao/integrations');
      await page.getByTestId('integrations-tab-webhooks').click();
      await page.getByTestId('new-webhook').click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('#wh-name').fill(name);
      // POST nesta rota do proprio dev responde 200; /health so aceita GET.
      await dialog.locator('#wh-url').fill('https://dev.iossystem.com.br/pt-BR/login');
      await radixPick(page, dialog.getByTestId('wh-table'), 'Clientes');
      for (const event of ['created', 'updated']) {
        const box = dialog.getByTestId(`wh-event-${event}`);
        if ((await box.getAttribute('aria-checked')) !== 'true') await box.click();
      }
      await dialog.getByTestId('wh-save').click();
      await expect(toast(page, 'Webhook salvo')).toBeVisible();
      await expect(page.getByTestId(`webhook-${name}`)).toContainText('Clientes');

      await page.getByTestId(`test-${name}`).click();
      await expect(toast(page, 'Teste enviado: o destino respondeu 200.')).toBeVisible({ timeout: 30_000 });

      // 6. Criar e editar um cliente gera envios.
      const created = await (await call(request, 'post', '/data/clientes', session, { expected: [200, 201], data: { data: { nome: record } } })).json();
      await call(request, 'patch', `/data/clientes/${created.id}`, session, { expected: 200, data: { data: { nome: record, telefone: '11999990000' } } });
      await expect(async () => {
        await page.getByTestId(`runs-${name}`).click();
        const runs = page.getByTestId('webhook-runs');
        await expect(runs).toContainText('created', { timeout: 3_000 });
        await expect(runs).toContainText('updated', { timeout: 3_000 });
        await expect(runs.getByText('200').first()).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 45_000, intervals: [3_000] }).catch(async (error) => {
        throw error;
      });
      await page.keyboard.press('Escape');

      // E-19: Execucoes mostram os envios.
      await go(page, '/gestao/execution-logs');
      const delivery = page.locator('div.divide-y > div').filter({ hasText: name }).first();
      await expect(delivery).toContainText('Webhook');
      await expect(delivery).toContainText('Sucesso');
    } finally {
      for (const item of (await listOf(request, session, '/webhooks')).filter((w) => String(w.name).startsWith(PREFIX))) {
        await call(request, 'delete', `/webhooks/${item.id}`, session, { expected: [200, 204] });
      }
      expect((await listOf(request, session, '/webhooks')).filter((w) => String(w.name).startsWith(PREFIX))).toEqual([]);
    }
  });

  test('[E-17] plano: troca para o minimo tira funcoes e menus; volta no fim', async ({ browser, request }) => {
    test.setTimeout(240_000);
    const paula = await paulaApi(request);
    const consolePage = await asStaff(browser, 'paula');
    const page = await as(browser, 'dora');
    const ana = await as(browser, 'ana');
    const setPlan = (planId: string) => call(request, 'patch', `/platform/tenants/${tenantId}/plan`, paula, { expected: 200, data: { planId } });
    const reloaded = async (target: Page, path: string): Promise<void> => {
      await go(target, path);
    };
    const nav = (target: Page, key: string): Locator => target.getByTestId(`gestao-nav-${key}`);
    try {
      await reloaded(page, '/gestao/plan');
      const panel = page.getByTestId('subscription-panel');
      await expect(panel).toContainText(`QA Básico ${seed.suffix}`);
      await expect(panel).toContainText(/\d+ dias? restantes? de teste/);
      for (const row of ['Usuários', 'Registros', 'Armazenamento']) await expect(panel.getByText(row, { exact: true }).first(), row).toBeVisible();
      await expect(nav(page, 'pdfTemplates')).toBeVisible();
      await expect(nav(page, 'publicLinks')).toBeVisible();
      await reloaded(ana, '/home');
      await expect(ana.getByRole('link', { name: 'Chat', exact: true })).toBeVisible();

      // O console troca o plano pela tela.
      await goConsole(consolePage, `/tenants/${tenantId}`);
      const planCard = consolePage.locator('div').filter({ has: consolePage.getByRole('button', { name: 'Trocar plano' }) }).last();
      await radixPick(consolePage, planCard.getByRole('combobox'), `QA Mínimo ${seed.suffix}`);
      await planCard.getByRole('button', { name: 'Trocar plano' }).click();
      await expect(toast(consolePage, 'Plano atualizado')).toBeVisible();

      await expect(async () => {
        await reloaded(page, '/gestao/plan');
        await expect(nav(page, 'pdfTemplates')).toHaveCount(0, { timeout: 2_000 });
      }).toPass({ timeout: 60_000, intervals: [5_000] });
      await expect(nav(page, 'publicLinks')).toHaveCount(0);
      const panel2 = page.getByTestId('subscription-panel');
      await expect(panel2).toContainText(`QA Mínimo ${seed.suffix}`);
      for (const feature of ['Chat', 'Modelos de PDF', 'Links públicos']) {
        await expect(panel2.locator('li, div').filter({ hasText: feature }).filter({ hasText: 'não incluída no plano' }).first(), feature).toBeVisible();
      }

      await expect(async () => {
        await reloaded(ana, '/home');
        await expect(ana.getByRole('link', { name: 'Chat', exact: true })).toHaveCount(0, { timeout: 2_000 });
      }).toPass({ timeout: 60_000, intervals: [5_000] });
    } finally {
      await setPlan(seed.planIds.basic);
    }
    const tenant = await (await call(request, 'get', `/platform/tenants/${tenantId}`, paula, { expected: 200 })).json();
    expect(tenant.planId ?? tenant.plan?.id).toBe(seed.planIds.basic);
    await expect(async () => {
      await reloaded(page, '/gestao/plan');
      await expect(nav(page, 'pdfTemplates')).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000, intervals: [5_000] });
  });

  /** Pessoa temporaria com o cargo Auditor do seed. Sempre sai no finally. */
  async function withAuditor(browser: Browser, request: APIRequestContext, tag: string, run: (page: Page, token: Session, userId: string) => Promise<void>): Promise<void> {
    const session = await dora(request);
    const email = `ui.pend.auditor.${tag}.${RUN}@example.com`;
    const temporary = `TmpUi!${RUN}Aa9`;
    const auditor = (await listOf(request, session, '/custom-roles?limit=100')).find((role) => role.name === 'Auditor');
    expect(auditor, 'cargo Auditor do seed').toBeTruthy();
    const createdUser = await (await call(request, 'post', '/users', session, {
      expected: [200, 201],
      data: { email, name: named('Auditor'), password: temporary, customRoleId: auditor!.id },
    })).json();
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await submitLogin(page, '/pt-BR/login', email, temporary, () => page.waitForURL(new RegExp(`/${slug}/home`), { timeout: 30_000 }));
      const login = await request.post(`${API}/auth/login`, { data: { email, password: temporary } });
      expect(login.ok()).toBeTruthy();
      await run(page, { token: (await login.json()).accessToken, slug, email }, createdUser.id);
    } finally {
      await context.close();
      await call(request, 'delete', `/users/${createdUser.id}`, session, { expected: [200, 204] });
    }
    const users = await listOf(request, session, '/users?limit=100');
    expect(users.filter((user) => user.email === email && user.status === 'ACTIVE')).toEqual([]);
  }

  test('[E-08 cargo sem ninguem] excluir a pessoa libera o cargo', async ({ request }) => {
    const session = await dora(request);
    const auditorRole = async (): Promise<Record<string, any>> => (await listOf(request, session, '/custom-roles?limit=100')).find((role) => role.name === 'Auditor')!;
    const before = (await auditorRole())._count.tenantAccessUsers;
    const person = await (await call(request, 'post', '/users', session, {
      expected: [200, 201],
      data: { email: `ui.pend.auditor.conta.${RUN}@example.com`, name: named('Auditor conta'), password: `TmpUi!${RUN}Aa9`, customRoleId: (await auditorRole()).id },
    })).json();
    await call(request, 'delete', `/users/${person.id}`, session, { expected: [200, 204] });
    expect((await auditorRole())._count.tenantAccessUsers).toBe(before);
  });

  test('[E-19] Auditor ve so Auditoria e Execucoes; a API libera os logs', async ({ browser, request }) => {
    await withAuditor(browser, request, 'menu', async (page, token, userId) => {
      await go(page, '/gestao');
      const links = await page.locator('[data-testid^="gestao-nav-"]').evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')!.replace('gestao-nav-', '')));
      expect(links.filter((key) => key !== 'dashboard').sort()).toEqual(['auditLogs', 'executionLogs']);

      await call(request, 'get', '/audit-logs?limit=1', token, { expected: 200 });
      await call(request, 'get', '/execution-logs?limit=1', token, { expected: 200 });

      for (const denied of ['/gestao/users', '/gestao/roles', '/gestao/organization']) {
        await page.goto(`/pt-BR/${slug}${denied}`);
        await page.waitForURL((url) => !url.pathname.endsWith(denied), { timeout: 15_000 });
      }

      // A Dora ve a criacao dessa pessoa na auditoria.
      const doraPage = await as(browser, 'dora');
      await go(doraPage, '/gestao/audit-logs');
      await expect(doraPage.getByRole('heading', { name: 'Logs de Auditoria' })).toBeVisible();
      await doraPage.getByPlaceholder('Buscar por ID do recurso...').fill(userId);
      await doraPage.waitForLoadState('networkidle');
      await expect(doraPage.getByText('Nenhum log encontrado')).toHaveCount(0);
    });
  });

  test('[E-19 Auditor tela] Auditor abre a Auditoria', async ({ browser, request }) => {
    await withAuditor(browser, request, 'tela', async (page) => {
      await go(page, '/gestao');
      await page.getByTestId('gestao-nav-auditLogs').click();
      await page.waitForURL(/\/gestao\/audit-logs/);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'Logs de Auditoria' })).toBeVisible();
    });
  });

  test('[E-19 Auditor tela] Auditor abre as Execucoes', async ({ browser, request }) => {
    await withAuditor(browser, request, 'exec', async (page) => {
      await go(page, '/gestao/execution-logs');
      await expect(page.getByRole('heading', { name: 'Logs de Execucao' })).toBeVisible();
    });
  });
});

test.describe('Operacao', () => {
  async function rowMenu(page: Page, name: string, item: string): Promise<void> {
    await row(page, name).locator('td').last().getByRole('button').click();
    await page.getByRole('menuitem', { name: item }).click();
  }

  test('[O-07/2] sub-registros: Novo, Tabela, Cards, Timeline e ordenacao', async ({ browser, request }) => {
    const ana = await apiUser(request, 'ana');
    const name = named('Com visitas O07');
    const created = await (await call(request, 'post', '/data/clientes', ana, { expected: [200, 201], data: { data: { nome: name, vip: false } } })).json();
    const older = named('Visita antiga');
    await call(request, 'post', '/data/visitas', ana, { expected: [200, 201], data: { data: { resumo: older }, parentRecordId: created.id } });
    const page = await as(browser, 'ana');
    await records(page);
    await rowMenu(page, name, 'Editar');
    const dialog = page.getByRole('dialog').first();
    await expect(dialog.getByText(older).first()).toBeVisible();

    const newer = named('Visita nova');
    await dialog.getByRole('button', { name: 'Novo', exact: true }).click();
    const form = page.getByRole('dialog').last();
    await form.locator('#resumo').fill(newer);
    await form.getByRole('button', { name: 'Criar', exact: true }).click();
    await expect(toast(page, /criado com sucesso/i).first()).toBeVisible();
    await expect(dialog.getByText(newer).first()).toBeVisible();

    for (const view of ['Tabela', 'Cards', 'Timeline']) {
      await dialog.getByTitle(view, { exact: true }).click();
      await expect(dialog.getByText(newer).first(), view).toBeVisible();
      await expect(dialog.getByText(older).first(), view).toBeVisible();
    }

    // Ordenacao na vista de tabela: mais recente primeiro; inverter troca a ordem.
    await dialog.getByTitle('Tabela', { exact: true }).click();
    const rows = dialog.locator('tbody tr');
    await expect(rows.first()).toContainText(newer);
    await radixPick(page, dialog.getByRole('combobox').filter({ hasText: 'Mais recentes' }), 'Mais antigos');
    await expect(rows.first()).toContainText(older);
  });

  const IMPORT_MARK = named('Imp');

  async function sheet(rowsOut: Array<[string, string, string]>): Promise<string> {
    const ExcelJS = createRequire(resolve('apps/api/package.json'))('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Dados');
    worksheet.addRow(['Nome', 'Email', 'Telefone']);
    for (const line of rowsOut) worksheet.addRow(line);
    const file = join(mkdtempSync(join(tmpdir(), 'ui-pend-')), `planilha-${rowsOut.length}.xlsx`);
    await workbook.xlsx.writeFile(file);
    return file;
  }

  const openImport = async (page: Page): Promise<Locator> => {
    await records(page);
    await page.getByRole('button', { name: /Importar/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Selecione um arquivo .xlsx ou .json para importar registros.')).toBeVisible();
    return dialog;
  };

  test('[O-09/1] csv e recusado', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const dialog = await openImport(page);
    const file = join(mkdtempSync(join(tmpdir(), 'ui-pend-')), 'planilha.csv');
    writeFileSync(file, 'Nome,Email\nUI PEND csv,csv@example.com\n');
    await dialog.locator('input[type="file"]').setInputFiles(file);
    await expect(toast(page, 'Formato não suportado. Use .xlsx ou .json')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  /** Importa e devolve a resposta da API; o primeiro POST em /import e a previa. */
  async function runImport(page: Page, dialog: Locator, file: string, rows: number): Promise<{ status: number; body: Record<string, any> }> {
    await dialog.locator('input[type="file"]').setInputFiles(file);
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await expect(dialog.getByText(`${rows} linha(s) no arquivo`).first()).toBeVisible();
    const posted = page.waitForResponse((r) => r.request().method() === 'POST' && /import/.test(new URL(r.url()).pathname), { timeout: 60_000 });
    await dialog.getByRole('button', { name: new RegExp(`Importar ${rows} registro`) }).click();
    const response = await posted;
    return { status: response.status(), body: await response.json() };
  }

  const fiveLines = (mark: string, tag: string): Array<[string, string, string]> =>
    [1, 2, 3, 4, 5].map((n) => [`${mark} ${n}`, n === 3 ? 'email-invalido' : `ui.pend.${tag}${n}.${RUN}@example.com`, '11999990000']);

  test('[O-09/2] xlsx com 5 linhas: 4 importados e 1 erro', async ({ browser, request }) => {
    const session = await dora(request);
    const page = await as(browser, 'dora');
    const dialog = await openImport(page);
    const { status, body } = await runImport(page, dialog, await sheet(fiveLines(IMPORT_MARK, 'imp')), 5);
    expect(status).toBe(201);
    expect(body.imported).toBe(4);
    expect(body.errors).toHaveLength(1);
    await expect(toast(page, '4 registro(s) importado(s) com sucesso')).toBeVisible();
    const saved = await listOf(request, session, `/data/clientes?limit=50&search=${encodeURIComponent(IMPORT_MARK)}`);
    expect(saved.filter((record) => String(record.data?.nome).startsWith(`${IMPORT_MARK} `))).toHaveLength(4);
  });

  test('[O-09/2 resultado] o resultado com a linha do erro continua na tela', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const dialog = await openImport(page);
    await runImport(page, dialog, await sheet(fiveLines(named('Imp dois'), 'impb')), 5);
    await page.waitForTimeout(2_000);
    await expect(dialog.getByText('1 erro(s)')).toBeVisible();
    await expect(dialog.getByText(/Linha \d+/).first()).toBeVisible();
  });

  test('[O-09/3-4] exportar Excel e JSON com selecao', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await records(page);
    const today = new Date().toISOString().slice(0, 10);
    const exportButton = page.getByRole('button', { name: /Exportar/ }).first();
    await exportButton.click();
    const excel = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: /Excel/ }).click();
    const file = await excel;
    expect(file.suggestedFilename()).toMatch(new RegExp(`^Clientes_\\d{4}-\\d{2}-\\d{2}\\.xlsx$`));
    expect(file.suggestedFilename()).toContain(today.slice(0, 7));
    await expect(toast(page, /registros exportados/)).toBeVisible();
    const ExcelJS = createRequire(resolve('apps/api/package.json'))('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(await file.path());
    expect(workbook.worksheets[0].rowCount, 'linhas do Excel').toBeGreaterThan(1);

    // Selecionar 2 linhas: so as 2 no JSON.
    const boxes = page.locator('tbody tr').getByRole('checkbox');
    await boxes.nth(0).click();
    await boxes.nth(1).click();
    await exportButton.click();
    const json = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: /JSON/ }).click();
    const content = JSON.parse(readFileSync(await (await json).path(), 'utf8'));
    expect(content).toHaveLength(2);
    await expect(toast(page, '2 registros exportados')).toBeVisible();
  });


  test('[O-09/5-7] PDF: individual pede selecao; individual e lote geram', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const ficha = named('Ficha do cliente');
    const lista = named('Lista de clientes');
    await records(page);
    const exportButton = page.getByRole('button', { name: /Exportar/ }).first();
    await exportButton.click();
    const item = page.getByRole('menuitem', { name: new RegExp(ficha) });
    await expect(item).toContainText('selecione');
    const before = await page.locator('[data-sonner-toast]').count();
    await item.click();
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(before);
    await page.keyboard.press('Escape');

    await page.locator('tbody tr').getByRole('checkbox').first().click();
    await exportButton.click();
    await page.getByRole('menuitem', { name: new RegExp(ficha) }).click();
    await expect(toast(page, 'PDF gerado com sucesso')).toBeVisible({ timeout: 60_000 });

    await exportButton.click();
    await page.getByRole('menuitem', { name: new RegExp(lista) }).click();
    await expect(toast(page, 'PDF em lote gerado com sucesso')).toBeVisible({ timeout: 60_000 });
  });

  const seventyLines = (tag: string): Array<[string, string, string]> =>
    Array.from({ length: 70 }, (_, n) => [`${named(tag)} ${n}`, `ui.pend.${tag.toLowerCase()}${n}.${RUN}@example.com`, '']);

  test('[O-09/10] 70 linhas batem no limite do plano e nada entra', async ({ browser, request }) => {
    const session = await dora(request);
    const total = async (): Promise<number> => (await (await call(request, 'get', '/data/clientes?limit=1', session, { expected: 200 })).json()).meta.total;
    const before = await total();
    const page = await as(browser, 'dora');
    const dialog = await openImport(page);
    const { status, body } = await runImport(page, dialog, await sheet(seventyLines('Lote')), 70);
    expect(status).toBe(403);
    expect(body.message).toContain('Limite de registros do plano atingido (60)');
    expect(await total()).toBe(before);
    await page.keyboard.press('Escape');
  });

  test('[O-09/10 mensagem] a tela mostra o limite do plano', async ({ browser }) => {
    const page = await as(browser, 'dora');
    const dialog = await openImport(page);
    await runImport(page, dialog, await sheet(seventyLines('Lote2')), 70);
    await expect(toast(page, /Limite de registros do plano atingido \(60\)/)).toBeVisible();
  });

  const composer = (page: Page): Locator => page.getByPlaceholder('Escreva uma mensagem… ou /comando');
  const openClientes = async (page: Page): Promise<void> => {
    await go(page, '/chat');
    await page.getByRole('button', { name: 'Clientes', exact: true }).click();
    await expect(composer(page)).toBeVisible();
  };

  test('[O-12/6] Dora renomeia e exclui um chat de registro', async ({ browser, request }) => {
    const session = await dora(request);
    const name = named('Thread');
    await call(request, 'post', '/data/clientes', session, { expected: [200, 201], data: { data: { nome: name } } });
    const page = await as(browser, 'dora');
    await records(page);
    await rowMenu(page, name, 'Abrir chat');
    await page.waitForURL(/\/chat\?thread=clientes:/);
    // Quem gerencia o chat escolhe os comandos ao abrir o chat do registro pela primeira vez.
    await page.getByRole('dialog').getByRole('button', { name: 'Criar e abrir' }).click();
    await expect(composer(page)).toBeVisible();

    const renamed = named('Thread renomeado');
    await page.getByTitle('Renomear').click();
    await page.locator('header input').fill(renamed);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.locator('aside').getByRole('button', { name: renamed })).toBeVisible();

    await page.getByTitle('Excluir chat').click();
    await expect(page.getByText('Excluir chat?')).toBeVisible();
    await page.getByTitle('Confirmar exclusão').click();
    await expect(toast(page, 'Chat excluído.')).toBeVisible();
    await expect(page.locator('aside').getByRole('button', { name: renamed })).toHaveCount(0);
  });

  test('[O-12/7] buscar mensagens pula para a mensagem com destaque', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await openClientes(page);
    const text = named('busca mensagem');
    await composer(page).fill(text);
    await page.keyboard.press('Enter');
    await expect(page.getByText(text).first()).toBeVisible();
    await page.getByTitle('Buscar mensagens').click();
    await page.getByPlaceholder('Buscar no histórico do chat…').fill(text);
    const result = page.locator('button').filter({ hasText: text }).first();
    await expect(result).toBeVisible({ timeout: 15_000 });
    await result.click();
    await expect(page.locator('.ring-yellow-400').filter({ hasText: text })).toBeVisible();
  });

  test('[O-12/8] @bot responde a contagem', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await openClientes(page);
    await composer(page).fill('@bot quantos clientes?');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Você pode ver \d+ registro\(s\)/).last()).toBeVisible({ timeout: 20_000 });
  });

  const CAPTURE = `uipendnovo${RUN}`;
  const QUERY = `uipendclientes${RUN}`;
  const RESTRICTED = `uipendrestrito${RUN}`;

  async function newCommand(page: Page, slugName: string, kind: 'create' | 'query', extra?: (dialog: Locator) => Promise<void>): Promise<void> {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Novo comando' }).click();
    await dialog.getByPlaceholder('avaria', { exact: true }).fill(slugName);
    await dialog.getByPlaceholder('Registrar avaria do veículo').fill(`${PREFIX}${slugName}`);
    if (kind === 'query') {
      const action = dialog.locator('div.space-y-1').filter({ has: page.getByText('Ação', { exact: true }) }).getByRole('combobox');
      await radixPick(page, action, 'Consulta / relatório');
    }
    const target = dialog.locator('div.space-y-1').filter({ has: page.getByText('Tabela-alvo', { exact: true }) }).getByRole('combobox');
    await radixPick(page, target, 'Clientes');
    if (extra) await extra(dialog);
    await dialog.getByRole('button', { name: 'Salvar comando' }).click();
    await expect(toast(page, 'Comando criado.').last()).toBeVisible();
  }

  test('[O-13/1-2,6] Dora cria comandos; restrito ao Gerente nao aparece para a Vera', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await go(page, '/chat');
    await page.getByRole('button', { name: 'Comandos do bot' }).click();
    await newCommand(page, CAPTURE, 'create', async (dialog) => {
      for (const field of ['Nome', 'Email']) {
        await radixPick(page, dialog.getByRole('combobox').filter({ hasText: '+ adicionar campo' }), new RegExp(`^${field}`));
      }
      await dialog.locator('label').filter({ hasText: 'Permitir registrar vários' }).getByRole('switch').click();
    });
    await newCommand(page, QUERY, 'query');
    await newCommand(page, RESTRICTED, 'query', async (dialog) => {
      await dialog.locator('label').filter({ hasText: /^Gerente$/ }).getByRole('checkbox').click();
    });

    const vera = await as(browser, 'vera');
    await openClientes(vera);
    await composer(vera).fill('/uipend');
    // A Vera nao cria registros: a captura nao aparece para ela, a consulta aberta sim.
    await expect(vera.locator('button').filter({ hasText: QUERY }).first()).toBeVisible();
    await expect(vera.locator('button').filter({ hasText: RESTRICTED })).toHaveCount(0);
    const gil = await as(browser, 'gil');
    await openClientes(gil);
    await composer(gil).fill('/uipend');
    await expect(gil.locator('button').filter({ hasText: RESTRICTED }).first()).toBeVisible();
  });

  test('[O-13/3] Ana digita / e navega pela lista com o teclado', async ({ browser }) => {
    const page = await as(browser, 'ana');
    await openClientes(page);
    await composer(page).fill('/uipend');
    const capture = page.locator('button').filter({ hasText: CAPTURE }).first();
    const query = page.locator('button').filter({ hasText: QUERY }).first();
    await expect(capture).toBeVisible();
    await expect(query).toBeVisible();
    const selected = page.locator('button.border-primary').filter({ hasText: /uipend/ });
    const firstSelected = (await selected.textContent())!;
    await page.keyboard.press('ArrowDown');
    await expect(selected).not.toHaveText(firstSelected);
    await page.keyboard.press('ArrowUp');
    await expect(selected).toHaveText(firstSelected);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /Cancelar|Registrar|Excel/ }).first()).toBeVisible();
  });

  test('[O-13/4 tela] comando criado pela tela abre a captura rapida', async ({ browser }) => {
    const page = await as(browser, 'dora');
    await openClientes(page);
    await composer(page).fill(`/${CAPTURE}`);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /Salvar e adicionar outra/ })).toBeVisible();
  });

  test('[O-13/4-5] captura rapida 2x e relatorio em Excel', async ({ browser, request }) => {
    // O comando nasce pela API com quickFields, o formato antigo: e o caminho que abre a captura rapida.
    const session = await dora(request);
    const quick = `uipendrapido${RUN}`;
    await call(request, 'post', '/chat/commands', session, {
      expected: [200, 201],
      data: { slug: quick, description: `${PREFIX}${quick}`, targetEntitySlug: 'clientes', actionType: 'create_record', execMode: 'as_user', actionConfig: { quickFields: ['nome', 'email'], allowMultiple: true }, visibleToRoleIds: [], isActive: true },
    });
    const page = await as(browser, 'dora');
    await openClientes(page);
    const first = named('Captura um');
    const second = named('Captura dois');
    await composer(page).fill(`/${quick}`);
    await page.keyboard.press('Enter');
    const form = page.locator('div.border-t.bg-muted\\/20').filter({ hasText: `/${quick}` });
    await expect(form).toBeVisible();
    const inputs = form.locator('input');
    await inputs.nth(0).fill(first);
    await inputs.nth(1).fill(`ui.pend.cap1.${RUN}@example.com`);
    await form.getByRole('button', { name: /Salvar e adicionar outra/ }).click();
    await expect(form.getByText('✓ 1 registro(s) adicionado(s). Preencha o próximo.')).toBeVisible();
    await inputs.nth(0).fill(second);
    await inputs.nth(1).fill(`ui.pend.cap2.${RUN}@example.com`);
    await form.getByRole('button', { name: /Salvar e adicionar outra/ }).click();
    await expect(form.getByText('✓ 2 registro(s) adicionado(s). Preencha o próximo.')).toBeVisible();
    await form.getByRole('button', { name: 'Fechar' }).click();

    const saved = await listOf(request, session, `/data/clientes?limit=50&search=${encodeURIComponent('Captura')}`);
    expect(saved.map((record) => record.data?.nome)).toEqual(expect.arrayContaining([first, second]));

    await composer(page).fill(`/${QUERY}`);
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Excel', exact: true }).click();
    await expect(toast(page, /Relatório gerado — clique na mensagem para baixar/)).toBeVisible({ timeout: 30_000 });
  });

  /** Notificacoes da pessoa, em JSON, para procurar o nome do registro. */
  const noticesFor = async (request: APIRequestContext, session: Session): Promise<string> =>
    JSON.stringify((await (await call(request, 'get', '/notifications?limit=50', session, { expected: 200 })).json()).data);

  test('[O-14/1-7] avisos e preferencias do Gil, com as preferencias restauradas', async ({ browser, request }) => {
    test.setTimeout(240_000);
    const doraSession = await dora(request);
    const gilSession = await apiUser(request, 'gil');
    const anaSession = await apiUser(request, 'ana');
    const original = await (await call(request, 'get', '/notifications/preferences', gilSession, { expected: 200 })).json();
    const create = async (session: Session, name: string) => (await (await call(request, 'post', '/data/clientes', session, { expected: [200, 201], data: { data: { nome: name } } })).json()) as { id: string };
    const page = await as(browser, 'gil');
    const settings = await as(browser, 'gil');
    const bell = page.getByRole('button').filter({ has: page.locator('svg.lucide-bell') });
    const unread = bell.locator('span.bg-red-500');
    const notifiedGil = async (name: string): Promise<void> => {
      await expect(async () => expect(await noticesFor(request, gilSession)).toContain(name)).toPass({ timeout: 20_000, intervals: [2_000] });
    };
    const setPref = async (id: string, checked: boolean): Promise<void> => {
      const box = settings.getByTestId(id);
      if ((await box.getAttribute('aria-checked')) !== String(checked)) await box.click();
      await expect(box).toHaveAttribute('aria-checked', String(checked));
      await expect(toast(settings, 'Preferências salvas').first()).toBeVisible();
    };
    try {
      await go(page, '/home');
      await go(settings, '/settings?tab=notifications');
      await expect(settings.getByTestId('prefs-events')).toBeVisible();

      // 1. Dora cria: toast e sino. 2. Dora nao recebe o proprio. 7. Ana nao enxerga, nao recebe.
      const first = named('Aviso um');
      await create(doraSession, first);
      await expect(toast(page, new RegExp(first))).toBeVisible({ timeout: 15_000 });
      await expect(unread).toBeVisible();
      await notifiedGil(first);
      await page.waitForTimeout(3_000);
      expect(await noticesFor(request, doraSession), 'Dora nao recebe o proprio aviso').not.toContain(first);
      expect(await noticesFor(request, anaSession), 'Ana nao recebe o que nao enxerga').not.toContain(first);

      // 3. Avisos na tela desligados: so no sino.
      await setPref('pref-popups', false);
      await page.reload();
      await page.waitForLoadState('networkidle');
      const second = named('Aviso dois');
      await create(doraSession, second);
      await notifiedGil(second);
      await expect(toast(page, new RegExp(second))).toHaveCount(0);
      await page.waitForTimeout(3_000);
      await expect(toast(page, new RegExp(second))).toHaveCount(0);
      await setPref('pref-popups', true);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // 4. Registro alterado desligado: edicao nao avisa.
      await setPref('pref-updated', false);
      const edited = named('Aviso editado');
      const record = await create(doraSession, edited);
      await notifiedGil(edited);
      const editedAgain = named('Aviso editado de novo');
      await call(request, 'patch', `/data/clientes/${record.id}`, doraSession, { expected: 200, data: { data: { nome: editedAgain } } });
      await page.waitForTimeout(5_000);
      expect(await noticesFor(request, gilSession), 'edicao nao avisa').not.toContain(editedAgain);
      await setPref('pref-updated', true);

      // 5. Minhas proprias acoes ligado: Gil recebe o que ele cria.
      await setPref('pref-own', true);
      const own = named('Aviso do Gil');
      await create(gilSession, own);
      await notifiedGil(own);
      await setPref('pref-own', false);

      // 6. Lista de tabelas; desligar Clientes para de avisar.
      await expect(settings.getByTestId('pref-table-clientes')).toBeVisible();
      await expect(settings.getByTestId('pref-table-visitas')).toBeVisible();
      await setPref('pref-table-clientes', false);
      const muted = named('Aviso silenciado');
      await create(doraSession, muted);
      await page.waitForTimeout(5_000);
      expect(await noticesFor(request, gilSession), 'tabela silenciada').not.toContain(muted);
    } finally {
      await call(request, 'put', '/notifications/preferences', gilSession, { expected: 200, data: original });
    }
    expect(await (await call(request, 'get', '/notifications/preferences', gilSession, { expected: 200 })).json()).toEqual(original);
  });

  test('[O-14/6 rotulo] tabelas aparecem com o nome certo', async ({ browser }) => {
    const page = await as(browser, 'gil');
    await go(page, '/settings?tab=notifications');
    const tables = page.getByTestId('prefs-tables');
    await expect(page.getByTestId('pref-table-clientes')).toBeVisible();
    await expect(tables.getByText('Clientes', { exact: true })).toBeVisible();
  });

  /** CPF valido a partir de 9 digitos. */
  function validCpf(seedNumber: number): string {
    const base = String(100000000 + seedNumber).slice(0, 9).split('').map(Number);
    const digit = (numbers: number[]): number => {
      const sum = numbers.reduce((total, value, index) => total + value * (numbers.length + 1 - index), 0);
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    const first = digit(base);
    const second = digit([...base, first]);
    return [...base, first, second].join('');
  }

  test('[O-18/1-7,9-10] link publico pela tela', async ({ browser, request }) => {
    test.setTimeout(300_000);
    const session = await dora(request);
    const name = named('Link');
    const doraPage = await as(browser, 'dora');
    const seedNumber = Date.now() % 800_000_000;
    const roleBefore = (await listOf(request, session, '/custom-roles?limit=100')).map((role) => role.name);
    const veraBefore = (await listOf(request, session, '/users?limit=100')).find((user) => user.email === mail('vera'))!.customRole?.name;
    const planUsers = async (): Promise<string> => {
      await go(doraPage, '/gestao/plan');
      return (await doraPage.getByTestId('subscription-panel').getByText(/\d+\s*\/\s*\d+/).first().innerText()).trim();
    };
    const usersBefore = await planUsers();
    const contextsHere: BrowserContext[] = [];
    let linkId = '';
    const newVisitor = async (): Promise<Page> => {
      const context = await browser.newContext();
      contextsHere.push(context);
      return context.newPage();
    };
    const register = async (page: Page, index: number, cpf: string): Promise<void> => {
      const email = `ui.pend.pub${index}.${RUN}@example.com`;
      await page.getByRole('tab', { name: 'Cadastro' }).click();
      await page.locator('#reg-name').fill(`${PREFIX}Visitante ${index}`);
      await page.locator('#reg-email').fill(email);
      await page.locator('#reg-cpf').fill(cpf);
      await page.locator('#reg-password').fill(`Pub!${RUN}Aa9x`);
      await page.getByRole('button', { name: 'Cadastrar' }).click();
    };
    try {
      await go(doraPage, '/gestao/public-links');
      await doraPage.getByRole('button', { name: 'Novo Link' }).first().click();
      const dialog = doraPage.getByRole('dialog');
      await dialog.locator('#name').fill(name);
      await radixPick(doraPage, dialog.getByRole('combobox'), 'Clientes');
      await expect(dialog.locator('#autoCreateRole')).toBeChecked();
      await dialog.locator('#maxUsers').fill('2');
      await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      const link = (await listOf(request, session, '/public-links?limit=100')).find((item) => item.name === name)!;
      linkId = link.id;
      const url = `/pt-BR/p/${link.slug}`;

      // 1. Abas.
      const visitor = await newVisitor();
      await visitor.goto(url);
      await expect(visitor.getByRole('tab', { name: 'Entrar' })).toBeVisible();
      await expect(visitor.getByRole('tab', { name: 'Cadastro' })).toBeVisible();

      // 2. CPF invalido.
      await register(visitor, 0, '11111111111');
      await expect(visitor.getByText('CPF invalido').first()).toBeVisible();

      // 3. Cadastro valido entra no app.
      await visitor.locator('#reg-email').fill(`ui.pend.pub1.${RUN}@example.com`);
      await visitor.locator('#reg-cpf').fill(validCpf(seedNumber));
      await visitor.getByRole('button', { name: 'Cadastrar' }).click();
      await visitor.waitForURL(new RegExp(`/p/${link.slug}/app`), { timeout: 30_000 });
      await expect(visitor.getByText(/Nenhum registro encontrado/)).toBeVisible();
      await expect(visitor.getByRole('button', { name: 'Novo registro' })).toBeVisible();

      // 4. Criar registro aparece no app e no web da Dora.
      const publicRecord = named('Registro do link');
      await visitor.getByRole('button', { name: 'Novo registro' }).click();
      const form = visitor.getByRole('dialog');
      await form.locator('#nome').fill(publicRecord);
      await form.getByRole('button', { name: 'Criar', exact: true }).click();
      await expect(form).toHaveCount(0);
      await expect(visitor.getByText(publicRecord).first()).toBeVisible();
      await records(doraPage);
      await expect(row(doraPage, publicRecord)).toHaveCount(1);

      // 5. Segundo cadastro ok; terceiro barrado. O cadastro aceita 3 tentativas por minuto: espera a janela.
      await doraPage.waitForTimeout(65_000);
      const second = await newVisitor();
      await second.goto(url);
      await register(second, 2, validCpf(seedNumber + 7));
      await second.waitForURL(new RegExp(`/p/${link.slug}/app`), { timeout: 30_000 });
      const third = await newVisitor();
      await third.goto(url);
      await register(third, 3, validCpf(seedNumber + 13));
      await expect(third.getByText('Limite de registros atingido para este link').first()).toBeVisible();

      // 7. Cadastros do link nao contam no limite de usuarios.
      expect(await planUsers()).toBe(usersBefore);

      // 9. Seis logins errados em e-mail que nao existe: limite por IP + e-mail.
      const attacker = await newVisitor();
      await attacker.goto(url);
      const status: number[] = [];
      attacker.on('response', (response) => { if (response.url().endsWith(`/p/${link.slug}/login`)) status.push(response.status()); });
      await attacker.locator('#login-identifier').fill(`ui.pend.errado.${RUN}@example.com`);
      await attacker.locator('#login-password').fill('senha-errada-123');
      for (let attempt = 0; attempt < 6; attempt++) {
        await attacker.getByRole('button', { name: 'Entrar', exact: true }).last().click();
        await attacker.waitForTimeout(800);
      }
      expect(status).toContain(429);
      await expect(attacker.getByText(/Muitas tentativas/).first()).toBeVisible();

      // 10. Vera entra pelo link: o cargo dela nao muda.
      const veraVisitor = await newVisitor();
      await veraVisitor.goto(url);
      await veraVisitor.locator('#login-identifier').fill(mail('vera'));
      await veraVisitor.locator('#login-password').fill(PASSWORD);
      await veraVisitor.getByRole('button', { name: 'Entrar', exact: true }).last().click();
      await veraVisitor.waitForURL(new RegExp(`/p/${link.slug}/app`), { timeout: 30_000 }).catch(() => undefined);
      const veraAfter = (await listOf(request, session, '/users?limit=100')).find((user) => user.email === mail('vera'))!.customRole?.name;
      expect(veraAfter).toBe(veraBefore);

      // 6. Dora desativa: recarregar mostra o aviso.
      await go(doraPage, '/gestao/public-links');
      await doraPage.locator('div').filter({ hasText: name }).filter({ has: doraPage.getByRole('switch') }).last().getByRole('switch').click();
      await expect(async () => {
        await visitor.reload();
        await expect(visitor.getByText('Este link esta desativado').first()).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 30_000, intervals: [3_000] });
    } finally {
      for (const context of contextsHere) await context.close();
      if (linkId) await call(request, 'delete', `/public-links/${linkId}`, session, { expected: [200, 204] });
      await removeVisitors(request, session);
      await retireLinkRole(request, session);
    }
    const realRoles = (await listOf(request, session, '/custom-roles?limit=100')).map((role) => role.name).filter((role) => !role.startsWith(PREFIX));
    expect(realRoles.sort()).toEqual(roleBefore.filter((role) => !role.startsWith(PREFIX) && role !== 'Publico - Clientes').sort());
  });
});

test.describe('Limpeza', () => {
  test('[LIMPEZA] apaga o que tem prefixo UI PEND e confere o que foi restaurado', async ({ request }) => {
    test.setTimeout(300_000);
    const session = await dora(request);
    const paula = await paulaApi(request);
    const pend = (item: Record<string, unknown>, key = 'name'): boolean => String(item[key] ?? '').startsWith(PREFIX);

    for (const item of (await listOf(request, paula, '/platform/announcements')).filter((a) => pend(a, 'title'))) {
      await call(request, 'delete', `/platform/announcements/${item.id}`, paula, { expected: [200, 204] });
    }
    for (const item of (await listOf(request, session, '/webhooks')).filter((w) => pend(w))) {
      await call(request, 'delete', `/webhooks/${item.id}`, session, { expected: [200, 204] });
    }
    for (const item of await listOf(request, session, '/chat/commands/manage')) {
      if (String(item.slug).startsWith('uipend') || String(item.description ?? '').startsWith(PREFIX)) {
        await call(request, 'delete', `/chat/commands/${item.id}`, session, { expected: [200, 204] });
      }
    }
    for (const channel of (await listOf(request, session, '/chat/channels')).filter((c) => pend(c))) {
      await call(request, 'delete', `/chat/channels/${channel.id}`, session, { expected: [200, 204] });
    }
    for (const entity of ['visitas', 'clientes']) {
      for (const record of await listOf(request, session, `/data/${entity}?limit=100&search=${encodeURIComponent(PREFIX.trim())}`)) {
        const label = String(record.data?.nome ?? record.data?.resumo ?? '');
        if (label.startsWith(PREFIX)) await call(request, 'delete', `/data/${entity}/${record.id}`, session, { expected: [200, 204, 404] });
      }
    }
    for (const path of ['/dashboard-templates', '/pdf-templates', '/public-links']) {
      for (const item of (await listOf(request, session, `${path}?limit=100`)).filter((i) => pend(i))) {
        await call(request, 'delete', `${path}/${item.id}`, session, { expected: [200, 204] });
      }
    }
    // Excluir a mae leva as sub-tabelas junto: a filha pode responder 404.
    for (const item of (await listOf(request, session, '/entities?limit=100')).filter((e) => pend(e))) {
      await call(request, 'delete', `/entities/${item.id}`, session, { expected: [200, 204, 404] });
    }
    for (const item of (await listOf(request, session, '/dashboard-templates?limit=100')).filter((i) => pend(i))) {
      await call(request, 'delete', `/dashboard-templates/${item.id}`, session, { expected: [200, 204] });
    }
    // O cargo do link so existe por causa destes testes: o seed nao cria.
    await removeVisitors(request, session);
    await retireLinkRole(request, session);
    for (const item of await listOf(request, session, `/trash?limit=100&search=${encodeURIComponent(PREFIX.trim())}`)) {
      if (String(item.title ?? '').startsWith(PREFIX)) await call(request, 'delete', `/trash/${item.entity.slug}/${item.id}`, session, { expected: [200, 204, 404] });
    }

    for (const path of ['/entities', '/dashboard-templates', '/pdf-templates', '/public-links']) {
      expect((await listOf(request, session, `${path}?limit=100`)).filter((i) => pend(i)).map((i) => i.name), path).toEqual([]);
    }
    expect((await listOf(request, paula, '/platform/announcements')).filter((a) => pend(a, 'title'))).toEqual([]);
    expect((await listOf(request, session, '/webhooks')).filter((w) => pend(w))).toEqual([]);
    const left = await listOf(request, session, `/data/clientes?limit=100&search=${encodeURIComponent(PREFIX.trim())}`);
    expect(left.filter((record) => String(record.data?.nome ?? '').startsWith(PREFIX)).map((r) => r.data?.nome)).toEqual([]);

    expect((await listOf(request, session, '/chat/commands/manage')).filter((c) => String(c.slug).startsWith('uipend')).map((c) => c.slug)).toEqual([]);
    expect((await listOf(request, session, '/users?limit=100')).filter((u) => pend(u) && u.status === 'ACTIVE').map((u) => u.email)).toEqual([]);
    const trash = await listOf(request, session, `/trash?limit=100&search=${encodeURIComponent(PREFIX.trim())}`);
    expect(trash.filter((item) => String(item.title ?? '').startsWith(PREFIX)).map((item) => item.title)).toEqual([]);

    const roleNames = (await listOf(request, session, '/custom-roles?limit=100')).map((role) => String(role.name)).filter((role) => !role.startsWith(PREFIX));
    expect(roleNames.sort()).toEqual(['Administrador', 'Auditor', 'Equipe campo', 'Gerente', 'Operador', 'Visualizador']);
    expect((await listOf(request, paula, '/platform/users?q=ui.pend.pub')).filter((item) => item.memberships?.length).map((item) => item.email)).toEqual([]);

    // Estado que os testes mudam e devolvem.
    const tenant = await (await call(request, 'get', `/platform/tenants/${tenantId}`, paula, { expected: 200 })).json();
    expect(tenant.planId ?? tenant.plan?.id, 'plano da QA Total').toBe(seed.planIds.basic);
  });
});
