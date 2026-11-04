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
    // Testes HTTP, sem navegador: montam o proprio cenario. Ver docs/teste-e2e-completo.md (secao 13).
    {
      name: 'api',
      testMatch: 'api/**/*.spec.ts',
      fullyParallel: false,
    },
    {
      name: 'chromium',
      testIgnore: 'api/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: 'api/**',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: 'api/**',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      testIgnore: 'api/**',
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
