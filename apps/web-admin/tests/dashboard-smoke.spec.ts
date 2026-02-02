import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

// Lista de rotas principais do dashboard para testar (apenas rotas que existem)
const dashboardRoutes = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/entities', name: 'Entidades' },
  { path: '/data', name: 'Dados' },
  { path: '/pages', name: 'Páginas' },
  { path: '/apis', name: 'APIs' },
  { path: '/users', name: 'Usuários' },
  { path: '/organization', name: 'Organização' },
  { path: '/settings', name: 'Configurações' },
  { path: '/perfil', name: 'Perfil' },
  { path: '/permissoes', name: 'Permissões' },
  { path: '/tenants', name: 'Tenants' },
  { path: '/clientes', name: 'Clientes' },
];

test.describe('Smoke test das páginas do dashboard', () => {
  // Login uma vez antes de todos os testes
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  dashboardRoutes.forEach(({ path, name }) => {
    test(`Deve carregar a página ${name} (${path}) sem erros`, async ({ page }) => {
      await page.goto(path);
      
      // Aguarda domcontentloaded (mais rápido que networkidle)
      await page.waitForLoadState('domcontentloaded');
      
      // Verifica que a página carregou - aceita h1, h2, ou data-testid de heading
      const heading = page.locator('h1, h2, [data-testid$="-heading"], [data-testid="page-title"]').first();
      await expect(heading).toBeVisible({ timeout: 30000 });
    });
  });
});

test.describe('Smoke test de botões principais', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard deve ter botão de atualizar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Verifica se o botão de refresh existe
    const refreshBtn = page.locator('button:has-text("Atualizar"), [data-testid="refresh-btn"]').first();
    await expect(refreshBtn).toBeVisible({ timeout: 30000 });
  });

  test('Entidades deve ter botão de nova entidade', async ({ page }) => {
    await page.goto('/entities');
    await page.waitForLoadState('domcontentloaded');
    
    // Verifica se o botão de criar existe (link ou botão) - usa .first() para evitar strict mode
    const newBtn = page.locator('a[href="/entities/new"], [data-testid="new-entity-btn"]').first();
    await expect(newBtn).toBeVisible({ timeout: 30000 });
  });

  test('Páginas deve ter botão de nova página', async ({ page }) => {
    await page.goto('/pages');
    await page.waitForLoadState('domcontentloaded');
    
    // Verifica se o botão de criar existe - usa .first() para evitar strict mode
    const newBtn = page.locator('a[href="/pages/new"], [data-testid="new-page-button"]').first();
    await expect(newBtn).toBeVisible({ timeout: 30000 });
  });
});
