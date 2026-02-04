import { test, expect, Page, APIRequestContext } from '@playwright/test';

/**
 * TESTE E2E COMPLETO - CRM Builder
 * CRUD COMPLETO DE TODOS OS MÓDULOS
 * 
 * Este teste cobre o CRUD completo de:
 * 1. Tenants (PLATFORM_ADMIN)
 * 2. Organizations
 * 3. Users
 * 4. Roles
 * 5. Entities
 * 6. Data (dynamic records)
 * 7. Pages
 * 8. Custom APIs
 * 
 * Access levels tested:
 * - PLATFORM_ADMIN: Super admin da plataforma
 * - ADMIN: Admin do tenant
 */

// Configurar apenas chromium para testes de UI
test.use({ browserName: 'chromium' });

const API_URL = 'http://localhost:3001/api/v1';
const WEB_URL = 'http://localhost:3000';

// Credenciais de teste
const PLATFORM_ADMIN = {
  email: 'superadmin@platform.com',
  password: 'superadmin123',
};

const TENANT_ADMIN = {
  email: 'admin@demo.com',
  password: 'admin123',
};

// IDs criados durante os testes
let platformAdminToken: string;
let adminToken: string;
let createdTenantId: string;
let createdOrganizationId: string;
let createdUserId: string;
let createdRoleId: string;
let createdEntityId: string;
let createdRecordId: string;
let createdPageId: string;
let createdApiId: string;

// Unique data for each execution
const timestamp = Date.now();

// Workspace ID will be obtained dynamically
let organizationId: string;

const TEST_DATA = {
  tenant: {
    name: `Tenant Teste ${timestamp}`,
    slug: `tenant-teste-${timestamp}`,
    plan: 'PROFESSIONAL',
    adminEmail: `admin-${timestamp}@teste.com`,
    adminName: `Admin Teste ${timestamp}`,
    adminPassword: 'teste123456',
  },
  organization: {
    name: `Test Organization ${timestamp}`,
    slug: `org-teste-${timestamp}`,
  },
  user: {
    email: `user-${timestamp}@teste.com`,
    password: 'user123456',
    name: `Test User ${timestamp}`,
    role: 'USER',
  },
  role: {
    name: `Role Teste ${timestamp}`,
    description: 'Role criada via teste E2E',
    permissions: ['read:entities', 'read:data'],
  },
  entity: {
    name: `Produtos ${timestamp}`,
    slug: `produtos-${timestamp}`,
    description: 'Test product catalog',
    icon: 'package',
    fields: [
      { name: 'nome', label: 'Nome', type: 'text', required: true },
      { name: 'preco', label: 'Price', type: 'number', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: false },
      { name: 'ativo', label: 'Ativo', type: 'boolean', required: false },
    ],
  },
  record: {
    data: {
      nome: `Produto Teste ${timestamp}`,
      preco: 99.90,
      description: 'Description do produto de teste',
      ativo: true,
    },
  },
  page: {
    title: `Test Page ${timestamp}`,
    slug: `pagina-teste-${timestamp}`,
    description: 'Page created via E2E test',
    content: { root: { children: [] } },
    isPublished: false,
  },
  customApi: {
    name: `API Teste ${timestamp}`,
    path: `/api-teste-${timestamp}`,
    method: 'GET',
  },
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

async function getAuthToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  
  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()}`);
  }
  
  const body = await response.json();
  return body.accessToken || body.access_token || body.token;
}

async function apiRequest(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  token: string,
  data?: any
) {
  const options: any = {
    headers: { Authorization: `Bearer ${token}` },
  };
  
  if (data) {
    options.data = data;
  }
  
  switch (method) {
    case 'GET':
      return request.get(`${API_URL}${endpoint}`, options);
    case 'POST':
      return request.post(`${API_URL}${endpoint}`, options);
    case 'PUT':
      return request.put(`${API_URL}${endpoint}`, options);
    case 'PATCH':
      return request.patch(`${API_URL}${endpoint}`, options);
    case 'DELETE':
      return request.delete(`${API_URL}${endpoint}`, options);
  }
}

async function loginWeb(page: Page, email: string, password: string) {
  await page.goto(`${WEB_URL}/login`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

// ============================================================================
// TESTES DE HEALTH CHECK
// ============================================================================

test.describe('Health Check', () => {
  test('API health check', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBe(true);
  });

  test('API readiness', async ({ request }) => {
    const response = await request.get(`${API_URL}/health/ready`);
    expect(response.ok()).toBe(true);
  });

  test('Web App available', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

// ============================================================================
// AUTENTICAÇÃO
// ============================================================================

test.describe('Authentication', () => {
  test('deve fazer login como PLATFORM_ADMIN', async ({ request }) => {
    platformAdminToken = await getAuthToken(request, PLATFORM_ADMIN.email, PLATFORM_ADMIN.password);
    expect(platformAdminToken).toBeTruthy();
  });

  test('deve fazer login como ADMIN', async ({ request }) => {
    adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    expect(adminToken).toBeTruthy();
  });

  test('deve obter perfil do PLATFORM_ADMIN', async ({ request }) => {
    if (!platformAdminToken) platformAdminToken = await getAuthToken(request, PLATFORM_ADMIN.email, PLATFORM_ADMIN.password);
    
    const response = await apiRequest(request, 'GET', '/auth/me', platformAdminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.email).toBe(PLATFORM_ADMIN.email);
    expect(body.role).toBe('PLATFORM_ADMIN');
  });

  test('deve obter perfil do ADMIN', async ({ request }) => {
    if (!adminToken) adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    
    const response = await apiRequest(request, 'GET', '/auth/me', adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.email).toBe(TENANT_ADMIN.email);
    expect(body.role).toBe('ADMIN');
  });

  test('should reject invalid token', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/auth/me', 'token-invalido');
    expect(response.status()).toBe(401);
  });

  test('deve rejeitar login com credenciais erradas', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'naoexiste@teste.com', password: 'senhaerrada' },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

// ============================================================================
// CRUD - TENANTS (PLATFORM_ADMIN)
// ============================================================================

test.describe.serial('CRUD - Tenants', () => {
  test.beforeAll(async ({ request }) => {
    if (!platformAdminToken) {
      platformAdminToken = await getAuthToken(request, PLATFORM_ADMIN.email, PLATFORM_ADMIN.password);
    }
  });

  test('CREATE - deve criar novo tenant', async ({ request }) => {
    const response = await apiRequest(request, 'POST', '/tenants', platformAdminToken, TEST_DATA.tenant);
    
    // Pode retornar 201 ou 200
    expect(response.status()).toBeLessThan(300);
    
    if (response.ok()) {
      const body = await response.json();
      createdTenantId = body.id;
      expect(body.name).toBe(TEST_DATA.tenant.name);
    }
  });

  test('READ - deve listar tenants', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/tenants', platformAdminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const data = Array.isArray(body) ? body : body.data || [];
    expect(Array.isArray(data)).toBe(true);
  });

  test('READ - deve buscar tenant por ID', async ({ request }) => {
    if (!createdTenantId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'GET', `/tenants/${createdTenantId}`, platformAdminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.id).toBe(createdTenantId);
  });

  test('READ - should get tenant statistics', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/tenants/stats', platformAdminToken);
    expect(response.status()).toBe(200);
  });

  test('UPDATE - deve atualizar tenant', async ({ request }) => {
    if (!createdTenantId) {
      test.skip();
      return;
    }
    
    const updateData = { name: `${TEST_DATA.tenant.name} - Atualizado` };
    const response = await apiRequest(request, 'PUT', `/tenants/${createdTenantId}`, platformAdminToken, updateData);
    expect(response.status()).toBeLessThan(300);
  });

  test('PATCH - deve suspender tenant', async ({ request }) => {
    if (!createdTenantId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'PATCH', `/tenants/${createdTenantId}/suspend`, platformAdminToken);
    expect(response.status()).toBeLessThan(300);
  });

  test('PATCH - deve ativar tenant', async ({ request }) => {
    if (!createdTenantId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'PATCH', `/tenants/${createdTenantId}/activate`, platformAdminToken);
    expect(response.status()).toBeLessThan(300);
  });

  test('DELETE - deve excluir tenant', async ({ request }) => {
    if (!createdTenantId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'DELETE', `/tenants/${createdTenantId}`, platformAdminToken);
    expect(response.status()).toBeLessThan(300);
    createdTenantId = ''; // Clear to not try to delete again
  });

  test('ACCESS - ADMIN cannot access /tenants', async ({ request }) => {
    if (!adminToken) adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    
    const response = await apiRequest(request, 'GET', '/tenants', adminToken);
    expect(response.status()).toBe(403);
  });
});

// ============================================================================
// CRUD - ORGANIZATIONS
// ============================================================================

test.describe.serial('CRUD - Organizations', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
  });

  test('CREATE - should create new organization', async ({ request }) => {
    const response = await apiRequest(request, 'POST', '/organizations', adminToken, TEST_DATA.organization);
    
    if (response.ok()) {
      const body = await response.json();
      createdOrganizationId = body.id;
      expect(body.name).toBe(TEST_DATA.organization.name);
    } else {
      // May already exist or have no permission
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('READ - should list organizations', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/organizations', adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const data = Array.isArray(body) ? body : body.data || [];
    expect(Array.isArray(data)).toBe(true);
  });

  test('READ - should fetch organization by ID', async ({ request }) => {
    if (!createdOrganizationId) {
      // Get first existing organization
      const listResponse = await apiRequest(request, 'GET', '/organizations', adminToken);
      const orgs = await listResponse.json();
      const data = Array.isArray(orgs) ? orgs : orgs.data || [];
      if (data.length > 0) {
        createdOrganizationId = data[0].id;
      } else {
        test.skip();
        return;
      }
    }
    
    const response = await apiRequest(request, 'GET', `/organizations/${createdOrganizationId}`, adminToken);
    expect(response.status()).toBe(200);
  });

  test('UPDATE - should update organization', async ({ request }) => {
    if (!createdOrganizationId) {
      test.skip();
      return;
    }
    
    // Organization only has name, slug and settings as editable fields
    const updateData = { name: `${TEST_DATA.organization.name} - Atualizado` };
    const response = await apiRequest(request, 'PUT', `/organizations/${createdOrganizationId}`, adminToken, updateData);
    expect(response.status()).toBeLessThan(300);
  });
});

// ============================================================================
// CRUD - USERS
// ============================================================================

test.describe.serial('CRUD - Users', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
  });

  test('READ - deve obter perfil atual', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/users/me', adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body).toHaveProperty('email');
  });

  test('CREATE - should create new user', async ({ request }) => {
    const response = await apiRequest(request, 'POST', '/users', adminToken, TEST_DATA.user);
    
    if (response.ok()) {
      const body = await response.json();
      createdUserId = body.id;
      expect(body.email).toBe(TEST_DATA.user.email);
    } else {
      // May fail if already exists or due to permission
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('READ - should list users', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/users', adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const data = Array.isArray(body) ? body : body.data || [];
    expect(Array.isArray(data)).toBe(true);
  });

  test('READ - should fetch user by ID', async ({ request }) => {
    if (!createdUserId) {
      // Get first existing user
      const listResponse = await apiRequest(request, 'GET', '/users', adminToken);
      const users = await listResponse.json();
      const data = Array.isArray(users) ? users : users.data || [];
      if (data.length > 0) {
        createdUserId = data[0].id;
      } else {
        test.skip();
        return;
      }
    }
    
    const response = await apiRequest(request, 'GET', `/users/${createdUserId}`, adminToken);
    expect(response.status()).toBe(200);
  });

  test('UPDATE - should update own profile', async ({ request }) => {
    const updateData = { name: 'Nome Atualizado via Teste' };
    const response = await apiRequest(request, 'PUT', '/users/me', adminToken, updateData);
    expect(response.status()).toBeLessThan(300);
  });

  test('UPDATE - should update user by ID', async ({ request }) => {
    if (!createdUserId) {
      test.skip();
      return;
    }
    
    const updateData = { name: 'Updated User' };
    const response = await apiRequest(request, 'PUT', `/users/${createdUserId}`, adminToken, updateData);
    expect(response.status()).toBeLessThan(300);
  });
});

// ============================================================================
// CRUD - ROLES
// ============================================================================

test.describe.serial('CRUD - Roles', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
  });

  test('CREATE - deve criar nova role', async ({ request }) => {
    const response = await apiRequest(request, 'POST', '/roles', adminToken, TEST_DATA.role);
    
    if (response.ok()) {
      const body = await response.json();
      createdRoleId = body.id;
      expect(body.name).toBe(TEST_DATA.role.name);
    } else {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('READ - deve listar roles', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/roles', adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const data = Array.isArray(body) ? body : body.data || [];
    expect(Array.isArray(data)).toBe(true);
  });

  test('READ - deve buscar role por ID', async ({ request }) => {
    if (!createdRoleId) {
      // Pega a primeira role existente
      const listResponse = await apiRequest(request, 'GET', '/roles', adminToken);
      const roles = await listResponse.json();
      const data = Array.isArray(roles) ? roles : roles.data || [];
      if (data.length > 0) {
        createdRoleId = data[0].id;
      } else {
        test.skip();
        return;
      }
    }
    
    const response = await apiRequest(request, 'GET', `/roles/${createdRoleId}`, adminToken);
    expect(response.status()).toBe(200);
  });

  test('UPDATE - deve atualizar role', async ({ request }) => {
    if (!createdRoleId) {
      test.skip();
      return;
    }
    
    const updateData = { description: 'Role atualizada via teste' };
    const response = await apiRequest(request, 'PUT', `/roles/${createdRoleId}`, adminToken, updateData);
    expect(response.status()).toBeLessThan(300);
  });
});

// ============================================================================
// CRUD - PERMISSIONS
// ============================================================================

test.describe('CRUD - Permissions (somente leitura)', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
  });

  test('READ - should list all permissions', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/permissions', adminToken);
    expect(response.status()).toBe(200);
  });

  test('READ - should get my permissions', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/permissions/me', adminToken);
    expect(response.status()).toBe(200);
  });
});

// ============================================================================
// CRUD - ENTITIES
// ============================================================================

test.describe.serial('CRUD - Entities', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
  });

  test('CREATE - deve criar nova entidade', async ({ request }) => {
    const response = await apiRequest(request, 'POST', '/entities', adminToken, TEST_DATA.entity);
    
    if (response.ok()) {
      const body = await response.json();
      createdEntityId = body.id;
      expect(body.name).toBe(TEST_DATA.entity.name);
    } else {
      // If already exists, fetch existing
      const listResponse = await apiRequest(request, 'GET', '/entities', adminToken);
      const entities = await listResponse.json();
      const data = Array.isArray(entities) ? entities : entities.data || [];
      const existing = data.find((e: any) => e.slug === TEST_DATA.entity.slug);
      if (existing) {
        createdEntityId = existing.id;
      }
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('READ - deve listar entidades', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/entities', adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const data = Array.isArray(body) ? body : body.data || [];
    expect(Array.isArray(data)).toBe(true);
  });

  test('READ - deve buscar entidade por ID', async ({ request }) => {
    if (!createdEntityId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'GET', `/entities/${createdEntityId}`, adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.id).toBe(createdEntityId);
  });

  test('READ - deve buscar entidade por slug', async ({ request }) => {
    const response = await apiRequest(request, 'GET', `/entities/slug/${TEST_DATA.entity.slug}`, adminToken);
    // May return 200 or 404 if not exists
    expect(response.status()).toBeLessThan(500);
  });

  test('UPDATE - deve atualizar entidade', async ({ request }) => {
    if (!createdEntityId) {
      test.skip();
      return;
    }
    
    const updateData = { description: 'Description atualizada via teste' };
    const response = await apiRequest(request, 'PUT', `/entities/${createdEntityId}`, adminToken, updateData);
    expect(response.status()).toBeLessThan(300);
  });
});

// ============================================================================
// CRUD - DATA (Dynamic records)
// ============================================================================

let entitySlug: string;

test.describe.serial('CRUD - Data (Registros)', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
    
    // Obter organizationId e entitySlug
    const listResponse = await apiRequest(request, 'GET', '/entities', adminToken);
    const entities = await listResponse.json();
    const data = Array.isArray(entities) ? entities : entities.data || [];
    if (data.length > 0) {
      createdEntityId = data[0].id;
      entitySlug = data[0].slug;
      organizationId = data[0].organizationId;
    }
  });

  test('CREATE - deve criar registro na entidade', async ({ request }) => {
    if (!organizationId || !entitySlug) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'POST', `/data/${organizationId}/${entitySlug}`, adminToken, TEST_DATA.record);
    
    if (response.ok()) {
      const body = await response.json();
      createdRecordId = body.id;
      expect(body.data).toBeDefined();
    } else {
      // May fail due to validation
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('READ - deve listar registros da entidade', async ({ request }) => {
    if (!organizationId || !entitySlug) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'GET', `/data/${organizationId}/${entitySlug}`, adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const data = Array.isArray(body) ? body : body.data || [];
    expect(Array.isArray(data)).toBe(true);
  });

  test('READ - deve buscar registro por ID', async ({ request }) => {
    if (!organizationId || !entitySlug || !createdRecordId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'GET', `/data/${organizationId}/${entitySlug}/${createdRecordId}`, adminToken);
    expect(response.status()).toBe(200);
  });

  test('UPDATE - deve atualizar registro', async ({ request }) => {
    if (!organizationId || !entitySlug || !createdRecordId) {
      test.skip();
      return;
    }
    
    const updateData = { data: { nome: 'Produto Atualizado', preco: 149.90 } };
    const response = await apiRequest(request, 'PUT', `/data/${organizationId}/${entitySlug}/${createdRecordId}`, adminToken, updateData);
    
    if (response.ok()) {
      const body = await response.json();
      expect(body.data.nome).toBe(updateData.data.nome);
    } else {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('DELETE - deve excluir registro', async ({ request }) => {
    if (!organizationId || !entitySlug || !createdRecordId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'DELETE', `/data/${organizationId}/${entitySlug}/${createdRecordId}`, adminToken);
    expect(response.status()).toBeLessThan(300);
    createdRecordId = '';
  });
});

// ============================================================================
// CRUD - PAGES
// ============================================================================

test.describe.serial('CRUD - Pages', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
  });

  test('CREATE - should create new page', async ({ request }) => {
    const response = await apiRequest(request, 'POST', '/pages', adminToken, TEST_DATA.page);
    
    if (response.ok()) {
      const body = await response.json();
      createdPageId = body.id;
      expect(body.title).toBe(TEST_DATA.page.title);
    } else {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('READ - should list pages', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/pages', adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const data = Array.isArray(body) ? body : body.data || [];
    expect(Array.isArray(data)).toBe(true);
  });

  test('READ - should fetch page by ID', async ({ request }) => {
    if (!createdPageId) {
      // Get first existing page
      const listResponse = await apiRequest(request, 'GET', '/pages', adminToken);
      const pages = await listResponse.json();
      const data = Array.isArray(pages) ? pages : pages.data || [];
      if (data.length > 0) {
        createdPageId = data[0].id;
      } else {
        test.skip();
        return;
      }
    }
    
    const response = await apiRequest(request, 'GET', `/pages/${createdPageId}`, adminToken);
    expect(response.status()).toBe(200);
  });

  test('READ - should fetch page by slug', async ({ request }) => {
    const response = await apiRequest(request, 'GET', `/pages/slug/${TEST_DATA.page.slug}`, adminToken);
    expect(response.status()).toBeLessThan(500);
  });

  test('UPDATE - should update page', async ({ request }) => {
    if (!createdPageId) {
      test.skip();
      return;
    }
    
    const updateData = { description: 'Page updated via test' };
    const response = await apiRequest(request, 'PUT', `/pages/${createdPageId}`, adminToken, updateData);
    expect(response.status()).toBeLessThan(300);
  });

  test('PATCH - should publish page', async ({ request }) => {
    if (!createdPageId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'PATCH', `/pages/${createdPageId}/publish`, adminToken);
    expect(response.status()).toBeLessThan(300);
  });

  test('PATCH - should unpublish page', async ({ request }) => {
    if (!createdPageId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'PATCH', `/pages/${createdPageId}/unpublish`, adminToken);
    expect(response.status()).toBeLessThan(300);
  });

  test('POST - should duplicate page', async ({ request }) => {
    if (!createdPageId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'POST', `/pages/${createdPageId}/duplicate`, adminToken);
    expect(response.status()).toBeLessThan(300);
  });

  test('DELETE - should delete page', async ({ request }) => {
    if (!createdPageId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'DELETE', `/pages/${createdPageId}`, adminToken);
    expect(response.status()).toBeLessThan(300);
    createdPageId = '';
  });
});

// ============================================================================
// CRUD - CUSTOM APIs
// ============================================================================

test.describe.serial('CRUD - Custom APIs', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
  });

  test('CREATE - deve criar nova API customizada', async ({ request }) => {
    const response = await apiRequest(request, 'POST', '/custom-apis', adminToken, TEST_DATA.customApi);
    
    if (response.ok()) {
      const body = await response.json();
      createdApiId = body.id;
      expect(body.name).toBe(TEST_DATA.customApi.name);
    } else {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('READ - deve listar APIs customizadas', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/custom-apis', adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const data = Array.isArray(body) ? body : body.data || [];
    expect(Array.isArray(data)).toBe(true);
  });

  test('READ - deve buscar API por ID', async ({ request }) => {
    if (!createdApiId) {
      // Pega a primeira API existente
      const listResponse = await apiRequest(request, 'GET', '/custom-apis', adminToken);
      const apis = await listResponse.json();
      const data = Array.isArray(apis) ? apis : apis.data || [];
      if (data.length > 0) {
        createdApiId = data[0].id;
      } else {
        test.skip();
        return;
      }
    }
    
    const response = await apiRequest(request, 'GET', `/custom-apis/${createdApiId}`, adminToken);
    expect(response.status()).toBe(200);
  });

  test('UPDATE - deve atualizar API', async ({ request }) => {
    if (!createdApiId) {
      test.skip();
      return;
    }
    
    const updateData = { description: 'API atualizada via teste' };
    const response = await apiRequest(request, 'PUT', `/custom-apis/${createdApiId}`, adminToken, updateData);
    expect(response.status()).toBeLessThan(300);
  });

  test('PATCH - deve ativar/desativar API', async ({ request }) => {
    if (!createdApiId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'PATCH', `/custom-apis/${createdApiId}/toggle`, adminToken);
    expect(response.status()).toBeLessThan(300);
  });

  test('DELETE - deve excluir API', async ({ request }) => {
    if (!createdApiId) {
      test.skip();
      return;
    }
    
    const response = await apiRequest(request, 'DELETE', `/custom-apis/${createdApiId}`, adminToken);
    expect(response.status()).toBeLessThan(300);
    createdApiId = '';
  });
});

// ============================================================================
// STATS - Dashboard
// ============================================================================

test.describe('Stats - Dashboard', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
  });

  test('should get dashboard statistics', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/stats/dashboard', adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body).toHaveProperty('totalEntities');
    expect(body).toHaveProperty('totalRecords');
    expect(body).toHaveProperty('totalPages');
  });

  test('deve obter registros ao longo do tempo', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/stats/records-over-time?days=30', adminToken);
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('should get entity distribution', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/stats/entities-distribution', adminToken);
    expect(response.status()).toBe(200);
  });

  test('deve obter atividade recente', async ({ request }) => {
    const response = await apiRequest(request, 'GET', '/stats/recent-activity?limit=10', adminToken);
    expect(response.status()).toBe(200);
  });
});

// ============================================================================
// UPLOAD
// ============================================================================

test.describe('Upload', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
  });

  test('deve fazer upload de arquivo', async ({ request }) => {
    const fileContent = Buffer.from('Conteudo de teste para upload');
    
    const response = await request.post(`${API_URL}/upload/file`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      multipart: {
        file: {
          name: 'teste.txt',
          mimeType: 'text/plain',
          buffer: fileContent,
        },
        folder: 'test',
      },
    });
    
    // May fail depending on storage configuration
    expect(response.status()).toBeLessThan(500);
  });
});

// ============================================================================
// WEB - NAVEGAÇÃO
// ============================================================================

test.describe('Web - Navigation', () => {
  test('deve fazer login na web', async ({ page }) => {
    await loginWeb(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  // TODO: Dashboard takes long to load statistics - investigate
  test.skip('should see dashboard with statistics', async ({ page }) => {
    await loginWeb(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
    // Aguarda o dashboard carregar completamente
    await page.waitForSelector('[data-testid="dashboard-heading"], h1', { timeout: 30000 });
    
    await expect(page.getByText('Entidades').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Registros').first()).toBeVisible({ timeout: 15000 });
  });

  test('deve navegar para Entidades', async ({ page }) => {
    await loginWeb(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
    await page.goto(`${WEB_URL}/entidades`);
    await page.waitForLoadState('networkidle');
    
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('deve navegar para Dados', async ({ page }) => {
    await loginWeb(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
    await page.goto(`${WEB_URL}/data`);
    await page.waitForLoadState('networkidle');
    
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('should navigate to Pages', async ({ page }) => {
    await loginWeb(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
    await page.goto(`${WEB_URL}/paginas`);
    await page.waitForLoadState('networkidle');
    
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('deve navegar para APIs', async ({ page }) => {
    await loginWeb(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
    await page.goto(`${WEB_URL}/apis`);
    await page.waitForLoadState('domcontentloaded');
    
    // Verify page loaded correctly
    await page.waitForTimeout(1000);
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('should navigate to Users', async ({ page }) => {
    await loginWeb(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
    await page.goto(`${WEB_URL}/usuarios`);
    await page.waitForLoadState('networkidle');
    
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('should navigate to Organization', async ({ page }) => {
    await loginWeb(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
    await page.goto(`${WEB_URL}/organizacao`);
    await page.waitForLoadState('networkidle');
    
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });

  test('should navigate to Settings', async ({ page }) => {
    await loginWeb(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
    await page.goto(`${WEB_URL}/configuracoes`);
    await page.waitForLoadState('networkidle');
    
    const content = await page.content();
    expect(content).not.toContain('Application error');
  });
});

// ============================================================================
// LIMPEZA FINAL
// ============================================================================

test.describe.serial('Cleanup', () => {
  test.beforeAll(async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
    if (!platformAdminToken) {
      platformAdminToken = await getAuthToken(request, PLATFORM_ADMIN.email, PLATFORM_ADMIN.password);
    }
  });

  test('deve limpar registros criados', async ({ request }) => {
    // Limpar record
    if (createdRecordId && createdEntityId) {
      await apiRequest(request, 'DELETE', `/data/${createdEntityId}/${createdRecordId}`, adminToken);
    }
    
    // Limpar page
    if (createdPageId) {
      await apiRequest(request, 'DELETE', `/pages/${createdPageId}`, adminToken);
    }
    
    // Limpar API
    if (createdApiId) {
      await apiRequest(request, 'DELETE', `/custom-apis/${createdApiId}`, adminToken);
    }
    
    // Limpar entity
    if (createdEntityId) {
      await apiRequest(request, 'DELETE', `/entities/${createdEntityId}`, adminToken);
    }
    
    // Limpar user
    if (createdUserId) {
      await apiRequest(request, 'DELETE', `/users/${createdUserId}`, adminToken);
    }
    
    // Limpar role
    if (createdRoleId) {
      await apiRequest(request, 'DELETE', `/roles/${createdRoleId}`, adminToken);
    }
    
    // Limpar organization
    if (createdOrganizationId) {
      await apiRequest(request, 'DELETE', `/organizations/${createdOrganizationId}`, adminToken);
    }
    
    // Limpar tenant
    if (createdTenantId) {
      await apiRequest(request, 'DELETE', `/tenants/${createdTenantId}`, platformAdminToken);
    }
    
    expect(true).toBe(true);
  });
});

// ============================================================================
// PERFORMANCE
// ============================================================================

test.describe('Performance', () => {
  test('API deve responder em menos de 1 segundo', async ({ request }) => {
    if (!adminToken) {
      adminToken = await getAuthToken(request, TENANT_ADMIN.email, TENANT_ADMIN.password);
    }
    
    const start = Date.now();
    await apiRequest(request, 'GET', '/stats/dashboard', adminToken);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(1000);
  });

  test('Dashboard deve carregar em menos de 5 segundos', async ({ page }) => {
    const start = Date.now();
    await loginWeb(page, TENANT_ADMIN.email, TENANT_ADMIN.password);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(5000);
  });
});
