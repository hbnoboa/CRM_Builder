import { readFileSync } from 'fs';
import { Browser, expect, Page, test } from '@playwright/test';

// Parte de tela do roteiro (docs/teste-e2e-completo.md), sobre o cenario de pnpm test:seed.
// Le as contas de e2e/.dev-accounts.local.json e a senha de QA_PASSWORD.
const seed = JSON.parse(readFileSync(process.env.ACCOUNTS_FILE || 'e2e/.dev-accounts.local.json', 'utf8'));
const PASSWORD = process.env.QA_PASSWORD!;
const slug: string = seed.slug;
const mail = (nick: string): string => seed.accounts[nick];

async function asUser(browser: Browser, nick: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/pt-BR/login');
  await page.locator('#email').fill(mail(nick));
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(new RegExp(`/${slug}/home`), { timeout: 30_000 });
  return page;
}

async function asStaff(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/pt-BR/admin/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.getByRole('link', { name: 'Clientes' }).first().waitFor({ timeout: 30_000 });
  return page;
}

const paula = (browser: Browser) => asStaff(browser, process.env.PLATFORM_EMAIL!, process.env.PLATFORM_PASSWORD!);

const records = async (page: Page, entity = 'clientes') => {
  await page.goto(`/pt-BR/${slug}/data?entity=${entity}`);
  await page.waitForLoadState('networkidle');
};

test.describe('Plataforma', () => {
  test('[P-01/1-2] login do console recusa senha errada', async ({ page }) => {
    await page.goto('/pt-BR/admin/login');
    await expect(page.getByText('Console da plataforma')).toBeVisible();
    await page.locator('#email').fill(`inexistente.${Date.now()}@example.com`);
    await page.locator('#password').fill('senha-errada-123');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText('Credenciais invalidas')).toBeVisible();
  });

  test('[P-01/6] menu da dona', async ({ browser }) => {
    const page = await paula(browser);
    for (const item of ['Visão geral', 'Métricas', 'Pessoas', 'Clientes', 'Planos', 'Equipe', 'Chamados', 'Comunicados', 'Saúde do sistema', 'Auditoria']) {
      await expect(page.getByRole('link', { name: item }).first(), item).toBeVisible();
    }
  });

  test('[P-06] menu por papel', async ({ browser }) => {
    const expectedMenu: Array<[string, boolean, boolean]> = [['sergio', false, false], ['fabio', true, false], ['lia', true, false]];
    for (const [nick, metrics, staff] of expectedMenu) {
      const page = await asStaff(browser, mail(nick), PASSWORD);
      await expect(page.getByRole('link', { name: 'Métricas' }), `${nick} metricas`).toHaveCount(metrics ? 1 : 0);
      await expect(page.getByRole('link', { name: 'Equipe', exact: true }), `${nick} equipe`).toHaveCount(staff ? 1 : 0);
      await page.context().close();
    }
  });

  test('[P-10] detalhe do cliente mostra uso, cargos e dono', async ({ browser }) => {
    const page = await paula(browser);
    await page.goto(`/pt-BR/admin/tenants/${seed.tenantId}`);
    await expect(page.getByText(`QA Total ${seed.suffix}`).first()).toBeVisible();
    for (const role of ['Administrador', 'Gerente', 'Operador', 'Visualizador']) await expect(page.getByText(role).first(), role).toBeVisible();
    await expect(page.getByText('Dono', { exact: true }).first()).toBeVisible();
  });

  test('[P-11] entrar como: banner, bloqueio e saida', async ({ browser }) => {
    const page = await asStaff(browser, mail('sergio'), PASSWORD);
    await page.goto(`/pt-BR/admin/tenants/${seed.tenantId}`);
    const row = page.locator('tr').filter({ hasText: mail('bruno') });
    await row.getByRole('button', { name: 'Entrar como' }).click();
    const confirm = page.getByRole('dialog').getByRole('button', { name: 'Entrar como' });
    if (await confirm.count()) await confirm.click();
    await page.waitForURL(new RegExp(`/${slug}/home`), { timeout: 30_000 });
    await expect(page.getByText(/impersonando/i)).toBeVisible();
    await records(page);
    await expect(page.getByText('Cliente B').first()).toBeVisible();
    await expect(page.getByText('Cliente C')).toHaveCount(0);
    await page.getByRole('button', { name: /Sair da impersona/i }).click();
    await page.waitForURL(/\/admin\/tenants\//, { timeout: 30_000 });
  });
});

test.describe('Cadastro', () => {
  test('[E-01/1] tela de cadastro mostra os dias do servidor', async ({ page }) => {
    await page.goto('/pt-BR/register');
    await expect(page.getByText(/teste grátis por \d+ dias/)).toBeVisible();
  });

  test('[E-02] login leva ao cadastro', async ({ page }) => {
    await page.goto('/pt-BR/login');
    await page.getByRole('link', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe('Administracao', () => {
  test('[E-03] painel da dona', async ({ browser }) => {
    const page = await asUser(browser, 'dora');
    await page.goto(`/pt-BR/${slug}/gestao`);
    await expect(page.getByText('Olá, Dora')).toBeVisible();
    await expect(page.getByText(/Administração da QA Total/)).toBeVisible();
  });

  test('[E-08/12] usuarios e selo de dono', async ({ browser }) => {
    const page = await asUser(browser, 'dora');
    await page.goto(`/pt-BR/${slug}/gestao/users`);
    for (const nick of ['alex', 'gil', 'ana', 'bruno', 'carla', 'vera']) await expect(page.getByText(mail(nick)).first(), nick).toBeVisible();
  });

  test('[E-20] Gerente ve as secoes certas', async ({ browser }) => {
    const page = await asUser(browser, 'gil');
    await page.goto(`/pt-BR/${slug}/gestao`);
    await expect(page.getByRole('link', { name: 'Usuários' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cargos' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboards' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Links públicos' })).toHaveCount(0);
    await page.goto(`/pt-BR/${slug}/gestao/public-links`);
    await page.waitForURL(new RegExp(`/${slug}/gestao$`), { timeout: 15_000 });
    await page.goto(`/pt-BR/${slug}/gestao/organization`);
    await page.waitForURL(new RegExp(`/${slug}/gestao$`), { timeout: 15_000 });
  });

  test('[E-16] wizard de automacao sem Executar Script', async ({ browser }) => {
    const page = await asUser(browser, 'dora');
    await page.goto(`/pt-BR/${slug}/gestao/entities`);
    await expect(page.getByText('Clientes').first()).toBeVisible();
    await expect(page.getByText('Executar Script')).toHaveCount(0);
  });
});

test.describe('Operacao', () => {
  test('[O-01/O-02/O-03] Operador so ve o operacional', async ({ browser }) => {
    const page = await asUser(browser, 'ana');
    await expect(page.getByText('Operacional').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Administração' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Lixeira' })).toHaveCount(0);
    for (const card of ['Templates PDF', 'Dashboards', 'Links Públicos', 'Auditoria', 'Usuários', 'Cargos', 'Nova Tabela']) {
      await expect(page.getByRole('link', { name: new RegExp(card) }), card).toHaveCount(0);
    }
    await page.goto(`/pt-BR/${slug}/gestao/entities`);
    await page.waitForURL(new RegExp(`/${slug}/home`), { timeout: 15_000 });
    await page.goto(`/pt-BR/${slug}/settings`);
    await expect(page).toHaveURL(/\/settings/);
    await page.goto(`/pt-BR/${slug}/profile`);
    await expect(page).toHaveURL(/\/profile/);
  });

  test('[X-01] matriz na tela', async ({ browser }) => {
    const matrix: Record<string, string[]> = {
      dora: ['Cliente A', 'Cliente B', 'Cliente C', 'Cliente D'],
      gil: ['Cliente A', 'Cliente B', 'Cliente C', 'Cliente D'],
      vera: ['Cliente A', 'Cliente B', 'Cliente C', 'Cliente D'],
      ana: ['Cliente A'],
      bruno: ['Cliente A', 'Cliente B'],
      carla: ['Cliente C'],
    };
    for (const [nick, visible] of Object.entries(matrix)) {
      const page = await asUser(browser, nick);
      await records(page);
      for (const name of ['Cliente A', 'Cliente B', 'Cliente C', 'Cliente D']) {
        await expect(page.getByText(name, { exact: true }), `${nick} / ${name}`).toHaveCount(visible.includes(name) ? 1 : 0, { timeout: 15_000 });
      }
      await page.context().close();
    }
  });

  test('[O-06/3] Operador ve os campos, menos o CPF', async ({ browser }) => {
    const page = await asUser(browser, 'ana');
    await records(page);
    await expect(page.getByText('Cliente A', { exact: true })).toBeVisible();
    await expect(page.getByText('cliente.a.', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('CPF', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Não', { exact: true }).first()).toBeVisible();
    // Seletor de colunas e formulario tambem nao oferecem o campo.
    await page.getByRole('button', { name: 'Colunas' }).click();
    await expect(page.getByText('CPF', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('dialog').getByText('Nome').first()).toBeVisible();
    await expect(page.getByRole('dialog').getByText('CPF')).toHaveCount(0);
  });

  test('[O-09/8-9] exportar por cargo', async ({ browser }) => {
    const gil = await asUser(browser, 'gil');
    await records(gil);
    await expect(gil.getByRole('button', { name: /Exportar/ }).first()).toBeVisible();
    const ana = await asUser(browser, 'ana');
    await records(ana);
    await expect(ana.getByRole('button', { name: /Exportar/ })).toHaveCount(0);
    await expect(ana.getByRole('button', { name: /Importar/ })).toHaveCount(0);
  });
});
