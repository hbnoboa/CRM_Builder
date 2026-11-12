import { defineConfig, devices } from '@playwright/test';

// Os testes criam e apagam dados: nunca rodam contra producao.
const PROD_HOSTS = new Set(['iossystem.com.br', 'www.iossystem.com.br']);
const baseURL = process.env.BASE_URL || 'http://localhost:3100';
for (const url of [baseURL, process.env.API_URL, process.env.WEB_URL]) {
  if (url && PROD_HOSTS.has(new URL(url).hostname)) {
    throw new Error(`Testes nao rodam contra producao: ${url}`);
  }
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Cenario do roteiro manual: pnpm test:seed (com e2e/.env.dev.local carregado).
    {
      name: 'seed',
      testDir: './e2e/seed',
      testMatch: '*.seed.ts',
    },
    // Parte de tela do roteiro, sobre o cenario do seed: pnpm test:ui-roteiro.
    {
      name: 'ui',
      testDir: './e2e/ui',
      timeout: 120_000,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', screenshot: 'only-on-failure' },
    },
    // Testes HTTP, sem navegador: montam o proprio cenario. Ver docs/teste-e2e-completo.md (secao 13).
    {
      name: 'api',
      testMatch: 'api/**/*.spec.ts',
      timeout: 120_000,
      fullyParallel: false,
    },
    {
      name: 'chromium',
      testIgnore: ['api/**', 'ui/**'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: ['api/**', 'ui/**'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: ['api/**', 'ui/**'],
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      testIgnore: ['api/**', 'ui/**'],
      use: { ...devices['Pixel 5'] },
    },
  ],

  // webServer comentado pois estamos testando contra servidor remoto
  // webServer: [
  //   {
  //     command: 'cd apps/api && pnpm run dev',
  //     port: 3001,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 120 * 1000,
  //   },
  //   {
  //     command: 'cd apps/web-admin && pnpm run dev',
  //     port: 3000,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 120 * 1000,
  //   },
  // ],
});
