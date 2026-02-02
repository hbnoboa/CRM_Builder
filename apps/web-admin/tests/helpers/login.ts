import { Page, expect } from '@playwright/test';

export async function login(
  page: Page,
  email = 'admin@demo.com',
  password = 'admin123'
) {
  // Usa baseURL do config (URL relativa)
  await page.goto('/login');

  // Seletores por ID (mais estáveis)
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  // Aguarda navegação para /dashboard (mais robusto que texto)
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Confirma que chegou ao dashboard (fallback)
  await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
}
