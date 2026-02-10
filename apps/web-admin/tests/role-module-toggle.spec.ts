import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Role form dialog - module toggle (no infinite loop)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@marisadilda.com', '12345678');
  });

  test('Deve abrir modal de nova role e clicar nos módulos sem causar loop infinito', async ({ page }) => {
    // Coleta erros do console
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navega diretamente para a página de roles com locale
    await page.goto('/pt-BR/roles');
    await page.waitForLoadState('networkidle');

    // Debug: tira screenshot para ver estado da página
    await page.screenshot({ path: 'test-results/debug-roles-page.png' });

    // Aguarda a página carregar completamente - espera por qualquer heading
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20000 });

    // Clica no botão de nova role - texto "Nova Role" em pt-BR
    const newRoleBtn = page.locator('button').filter({ hasText: /Nova Role|New Role|Nuevo Rol/ }).first();
    await expect(newRoleBtn).toBeVisible({ timeout: 20000 });
    await newRoleBtn.click();

    // Aguarda o modal abrir
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Encontra os cards de módulo dentro do modal (divs com switch dentro)
    const moduleCards = dialog.locator('div.cursor-pointer:has(button[role="switch"])');
    const cardCount = await moduleCards.count();

    // Deve ter pelo menos 1 módulo
    expect(cardCount).toBeGreaterThan(0);

    // Clica em cada módulo e verifica que a página não trava
    for (let i = 0; i < cardCount; i++) {
      const card = moduleCards.nth(i);
      await card.click();

      // Pequena pausa para verificar se não trava (loop infinito congela a UI)
      await page.waitForTimeout(500);

      // Verifica que o dialog ainda está visível (não crashou)
      await expect(dialog).toBeVisible();
    }

    // Clica novamente nos módulos (toggle de volta) para testar ambas as direções
    for (let i = 0; i < cardCount; i++) {
      const card = moduleCards.nth(i);
      await card.click();
      await page.waitForTimeout(500);
      await expect(dialog).toBeVisible();
    }

    // Também testa clicar diretamente no Switch (o principal cenário do bug)
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const sw = moduleCards.nth(i).locator('button[role="switch"]');
      await sw.click();
      await page.waitForTimeout(500);
      await expect(dialog).toBeVisible();
    }

    // Verifica que nenhum erro #185 (Maximum update depth exceeded) ocorreu
    const loopErrors = consoleErrors.filter(
      (e) => e.includes('#185') || e.includes('Maximum update depth') || e.includes('too many re-renders')
    );
    expect(loopErrors).toHaveLength(0);

    // Verifica que o formulário ainda é interativo (não travou)
    const nameInput = dialog.locator('input').first();
    await nameInput.fill('Test Role');
    await expect(nameInput).toHaveValue('Test Role');
  });
});
