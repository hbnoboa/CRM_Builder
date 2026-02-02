# 🧪 Padrões de Testes

## Framework: Playwright

Usamos Playwright para testes E2E.

## Estrutura

```
e2e/
├── api.spec.ts      # Testes de API
├── app.spec.ts      # Testes de UI
├── auth.spec.ts     # Testes de autenticação
└── fixtures/        # Dados de teste
```

## Configuração

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev:api',
      url: 'http://localhost:3001/api/v1/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm dev:admin',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

## Testes de API

```typescript
// e2e/api.spec.ts
import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3001/api/v1';

test.describe('Auth API', () => {
  test('POST /auth/login - sucesso', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'admin@demo.com',
        password: 'admin123',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('user');
  });

  test('POST /auth/login - credenciais inválidas', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'admin@demo.com',
        password: 'senhaerrada',
      },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe('Users API', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'admin@demo.com',
        password: 'admin123',
      },
    });
    const body = await response.json();
    token = body.accessToken;
  });

  test('GET /users - lista usuários', async ({ request }) => {
    const response = await request.get(`${API_URL}/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBeTruthy();
  });
});
```

## Testes de UI

```typescript
// e2e/app.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('login com credenciais válidas', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'admin@demo.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Deve redirecionar para dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Deve mostrar nome do usuário
    await expect(page.locator('text=Admin Demo')).toBeVisible();
  });

  test('login com credenciais inválidas', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'admin@demo.com');
    await page.fill('input[name="password"]', 'senhaerrada');
    await page.click('button[type="submit"]');

    // Deve mostrar erro
    await expect(page.locator('text=Credenciais inválidas')).toBeVisible();
    
    // Deve permanecer na página de login
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login antes de cada teste
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@demo.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('exibe estatísticas', async ({ page }) => {
    await expect(page.locator('text=Total de Usuários')).toBeVisible();
    await expect(page.locator('text=Total de Entidades')).toBeVisible();
  });

  test('navegação para usuários', async ({ page }) => {
    await page.click('text=Usuários');
    await expect(page).toHaveURL('/users');
  });
});
```

## Page Objects (Opcional)

```typescript
// e2e/pages/login.page.ts
import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }
}

// Uso
test('login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('admin@demo.com', 'admin123');
  await expect(page).toHaveURL('/dashboard');
});
```

## Comandos

```bash
# Rodar todos os testes
pnpm test

# Rodar com UI
pnpm test:ui

# Rodar em modo headed (ver browser)
pnpm test:headed

# Rodar apenas testes de API
pnpm test:api

# Rodar apenas testes E2E
pnpm test:e2e

# Ver relatório
pnpm test:report
```

## Boas Práticas

1. **Isolamento**: Cada teste deve ser independente
2. **Setup/Teardown**: Usar `beforeEach`/`afterEach` para estado limpo
3. **Seletores estáveis**: Preferir `data-testid` ou texto visível
4. **Waits explícitos**: Usar `waitForURL`, `waitForSelector`
5. **Assertions claras**: Verificar o que é importante
6. **Dados de teste**: Usar fixtures ou seed do banco
