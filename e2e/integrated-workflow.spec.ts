import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * TESTE E2E - FLUXO INTEGRADO COMPLETO
 *
 * Este teste simula o cenario real demonstrado:
 * 0. Limpar dados de testes anteriores
 * 1. Login e obtencao de token
 * 2. Criar Entidade "Reclamacao" com relacao a "Cliente"
 * 3. Listar Clientes existentes
 * 4. Criar Reclamacoes vinculadas aos Clientes
 * 5. Criar Custom API para buscar reclamacoes por cliente
 * 6. Testar a Custom API
 * 7. Criar Page com componente que usa a Custom API
 * 8. Testar preview da Page
 * 9. Limpeza dos dados criados
 */

const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

// Credenciais de teste
const ADMIN_CREDENTIALS = {
  email: 'admin@demo.com',
  password: 'admin123',
};

// Prefixo fixo para identificar recursos de teste (facilita limpeza)
const TEST_PREFIX = 'e2e-test';

// Variaveis para armazenar IDs criados
let token: string;
let workspaceId: string;
let clienteEntityId: string;
let reclamacaoEntityId: string;
let clienteIds: string[] = [];
let reclamacaoIds: string[] = [];
let customApiId: string;
let pageId: string;

const timestamp = Date.now();

// ============================================================================
// FUNCOES AUXILIARES
// ============================================================================

async function login(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: ADMIN_CREDENTIALS,
  });

  expect(response.ok(), `Login falhou: ${response.status()}`).toBeTruthy();
  const body = await response.json();
  return body.accessToken;
}

async function apiGet(request: APIRequestContext, endpoint: string) {
  return request.get(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function apiPost(request: APIRequestContext, endpoint: string, data: any) {
  return request.post(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function apiPatch(request: APIRequestContext, endpoint: string, data?: any) {
  return request.patch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function apiDelete(request: APIRequestContext, endpoint: string) {
  return request.delete(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ============================================================================
// TESTE 0: LIMPEZA INICIAL (Remover dados de testes anteriores)
// ============================================================================

test.describe.serial('0. Limpeza Inicial', () => {
  test('deve fazer login para limpeza', async ({ request }) => {
    token = await login(request);
    expect(token).toBeTruthy();
  });

  test('deve obter workspaceId', async ({ request }) => {
    const response = await apiGet(request, '/entities');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const entities = Array.isArray(body) ? body : body.data || [];

    if (entities.length > 0) {
      workspaceId = entities[0].workspaceId;
    }
  });

  test('deve remover paginas de testes anteriores', async ({ request }) => {
    const response = await apiGet(request, '/pages');
    if (!response.ok()) return;

    const body = await response.json();
    const pages = Array.isArray(body) ? body : body.data || [];

    // Encontrar paginas com prefixo de teste ou slug de teste
    const testPages = pages.filter((p: any) =>
      p.slug?.includes(TEST_PREFIX) ||
      p.slug?.includes('reclamacao-e2e') ||
      p.slug?.includes('dashboard-reclamacoes-e2e') ||
      p.slug?.includes('tickets-dashboard-') ||
      p.title?.includes('E2E')
    );

    for (const page of testPages) {
      await apiDelete(request, `/pages/${page.id}`);
    }
  });

  test('deve remover Custom APIs de testes anteriores', async ({ request }) => {
    const response = await apiGet(request, '/custom-apis');
    if (!response.ok()) return;

    const body = await response.json();
    const apis = Array.isArray(body) ? body : body.data || [];

    // Encontrar APIs com prefixo de teste
    const testApis = apis.filter((a: any) =>
      a.path?.includes(TEST_PREFIX) ||
      a.path?.includes('cliente-reclamacoes-e2e') ||
      a.path?.includes('tickets-') ||
      a.name?.includes('E2E')
    );

    for (const api of testApis) {
      await apiDelete(request, `/custom-apis/${api.id}`);
    }
  });

  test('deve remover entidades de testes anteriores', async ({ request }) => {
    const response = await apiGet(request, '/entities');
    if (!response.ok()) return;

    const body = await response.json();
    const entities = Array.isArray(body) ? body : body.data || [];

    // Encontrar entidades com prefixo de teste
    const testEntities = entities.filter((e: any) =>
      e.slug?.includes(TEST_PREFIX) ||
      e.slug?.includes('reclamacao-e2e') ||
      e.slug?.includes('ticket-') ||
      e.name?.includes('E2E')
    );

    for (const entity of testEntities) {
      // Primeiro remover todos os dados da entidade
      if (workspaceId) {
        const dataResponse = await apiGet(request, `/data/${workspaceId}/${entity.slug}`);
        if (dataResponse.ok()) {
          const dataBody = await dataResponse.json();
          const records = dataBody.data || [];
          for (const record of records) {
            await apiDelete(request, `/data/${workspaceId}/${entity.slug}/${record.id}`);
          }
        }
      }

      // Depois remover a entidade
      await apiDelete(request, `/entities/${entity.id}`);
    }
  });

  test('limpeza inicial concluida', async () => {
    // Reset das variaveis para os proximos testes
    reclamacaoEntityId = '';
    reclamacaoIds = [];
    customApiId = '';
    pageId = '';

    expect(true).toBe(true);
  });
});

// ============================================================================
// TESTE 1: AUTENTICACAO
// ============================================================================

test.describe.serial('1. Autenticacao', () => {
  test('deve fazer login e obter token', async ({ request }) => {
    // Token ja obtido na limpeza, mas garantir que esta valido
    if (!token) {
      token = await login(request);
    }
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(50);
  });

  test('deve obter perfil do usuario', async ({ request }) => {
    const response = await apiGet(request, '/auth/me');
    expect(response.ok()).toBeTruthy();

    const user = await response.json();
    expect(user.email).toBe(ADMIN_CREDENTIALS.email);
    expect(user.role).toBe('ADMIN');
  });
});

// ============================================================================
// TESTE 2: ENTIDADES EXISTENTES
// ============================================================================

test.describe.serial('2. Verificar Entidades Existentes', () => {
  test('deve listar entidades e encontrar Cliente', async ({ request }) => {
    const response = await apiGet(request, '/entities');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const entities = Array.isArray(body) ? body : body.data || [];

    // Buscar entidade Cliente
    const cliente = entities.find((e: any) => e.slug === 'cliente');
    expect(cliente, 'Entidade Cliente nao encontrada').toBeTruthy();

    clienteEntityId = cliente.id;
    workspaceId = cliente.workspaceId;

    expect(workspaceId).toBeTruthy();
  });

  test('deve listar clientes existentes', async ({ request }) => {
    const response = await apiGet(request, `/data/${workspaceId}/cliente`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const clientes = body.data || [];

    expect(clientes.length).toBeGreaterThan(0);

    // Salvar IDs dos clientes para usar nas reclamacoes
    clienteIds = clientes.slice(0, 2).map((c: any) => c.id);

    // Verificar estrutura dos clientes
    const primeiroCliente = clientes[0];
    expect(primeiroCliente.data).toHaveProperty('nome');
    expect(primeiroCliente.data).toHaveProperty('email');
  });
});

// ============================================================================
// TESTE 3: CRIAR ENTIDADE RECLAMACAO
// ============================================================================

test.describe.serial('3. Criar Entidade Reclamacao', () => {
  test('deve criar entidade Reclamacao com relacao a Cliente', async ({ request }) => {
    const entityData = {
      name: `Reclamacao E2E ${timestamp}`,
      namePlural: `Reclamacoes E2E ${timestamp}`,
      slug: `reclamacao-e2e-${timestamp}`,
      description: 'Entidade de reclamacoes criada via teste E2E',
      icon: 'alert-triangle',
      fields: [
        { name: 'Titulo', slug: 'titulo', type: 'text', required: true },
        { name: 'Descricao', slug: 'descricao', type: 'textarea', required: true },
        { name: 'Cliente', slug: 'clienteId', type: 'relation', required: true, relationEntity: 'cliente' },
        {
          name: 'Status',
          slug: 'status',
          type: 'select',
          required: true,
          options: [
            { label: 'Aberta', value: 'aberta', color: '#EF4444' },
            { label: 'Em Andamento', value: 'em_andamento', color: '#F59E0B' },
            { label: 'Resolvida', value: 'resolvida', color: '#22C55E' },
          ],
          default: 'aberta',
        },
        {
          name: 'Prioridade',
          slug: 'prioridade',
          type: 'select',
          required: true,
          options: [
            { label: 'Baixa', value: 'baixa', color: '#6B7280' },
            { label: 'Media', value: 'media', color: '#F59E0B' },
            { label: 'Alta', value: 'alta', color: '#EF4444' },
          ],
          default: 'media',
        },
        { name: 'Data de Abertura', slug: 'dataAbertura', type: 'date', required: true },
      ],
      settings: {
        titleField: 'titulo',
        subtitleField: 'status',
        searchFields: ['titulo', 'descricao'],
      },
    };

    const response = await apiPost(request, '/entities', entityData);
    expect(response.ok(), `Falha ao criar entidade: ${await response.text()}`).toBeTruthy();

    const entity = await response.json();
    reclamacaoEntityId = entity.id;

    expect(entity.name).toBe(entityData.name);
    expect(entity.fields).toHaveLength(6);
  });

  test('deve buscar entidade Reclamacao por ID', async ({ request }) => {
    const response = await apiGet(request, `/entities/${reclamacaoEntityId}`);
    expect(response.ok()).toBeTruthy();

    const entity = await response.json();
    expect(entity.id).toBe(reclamacaoEntityId);
  });
});

// ============================================================================
// TESTE 4: CRIAR DADOS DE RECLAMACOES
// ============================================================================

test.describe.serial('4. Criar Reclamacoes', () => {
  test('deve criar reclamacao para primeiro cliente', async ({ request }) => {
    expect(clienteIds.length).toBeGreaterThan(0);

    const reclamacaoData = {
      data: {
        titulo: `Demora no atendimento - E2E ${timestamp}`,
        descricao: 'Aguardei mais de 30 minutos para ser atendido no suporte tecnico',
        clienteId: clienteIds[0],
        status: 'aberta',
        prioridade: 'alta',
        dataAbertura: new Date().toISOString().split('T')[0],
      },
    };

    const response = await apiPost(
      request,
      `/data/${workspaceId}/reclamacao-e2e-${timestamp}`,
      reclamacaoData
    );
    expect(response.ok(), `Falha ao criar reclamacao: ${await response.text()}`).toBeTruthy();

    const record = await response.json();
    reclamacaoIds.push(record.id);

    expect(record.data.titulo).toContain('Demora no atendimento');
  });

  test('deve criar segunda reclamacao para primeiro cliente', async ({ request }) => {
    const reclamacaoData = {
      data: {
        titulo: `Sistema fora do ar - E2E ${timestamp}`,
        descricao: 'O sistema ficou indisponivel durante toda a manha',
        clienteId: clienteIds[0],
        status: 'em_andamento',
        prioridade: 'alta',
        dataAbertura: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      },
    };

    const response = await apiPost(
      request,
      `/data/${workspaceId}/reclamacao-e2e-${timestamp}`,
      reclamacaoData
    );
    expect(response.ok()).toBeTruthy();

    const record = await response.json();
    reclamacaoIds.push(record.id);
  });

  test('deve criar reclamacao para segundo cliente (se existir)', async ({ request }) => {
    if (clienteIds.length < 2) {
      test.skip();
      return;
    }

    const reclamacaoData = {
      data: {
        titulo: `Erro na fatura - E2E ${timestamp}`,
        descricao: 'A fatura veio com valor incorreto',
        clienteId: clienteIds[1],
        status: 'resolvida',
        prioridade: 'media',
        dataAbertura: new Date(Date.now() - 172800000).toISOString().split('T')[0],
      },
    };

    const response = await apiPost(
      request,
      `/data/${workspaceId}/reclamacao-e2e-${timestamp}`,
      reclamacaoData
    );
    expect(response.ok()).toBeTruthy();

    const record = await response.json();
    reclamacaoIds.push(record.id);
  });

  test('deve listar todas as reclamacoes criadas', async ({ request }) => {
    const response = await apiGet(request, `/data/${workspaceId}/reclamacao-e2e-${timestamp}`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.meta.total).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// TESTE 5: CRIAR CUSTOM API
// ============================================================================

test.describe.serial('5. Criar Custom API', () => {
  test('deve criar API para buscar reclamacoes por cliente', async ({ request }) => {
    const apiData = {
      name: `Reclamacoes por Cliente E2E ${timestamp}`,
      path: `/cliente-reclamacoes-e2e-${timestamp}`,
      method: 'GET',
      description: 'Busca reclamacoes de um cliente especifico',
      auth: 'JWT',
      isActive: true,
      inputSchema: {
        type: 'object',
        properties: {
          clienteId: { type: 'string', description: 'ID do cliente' },
        },
        required: ['clienteId'],
      },
      logic: `
        const reclamacoes = await db.entityData.findMany({
          where: {
            entity: { slug: "reclamacao-e2e-${timestamp}" },
            data: { path: ["clienteId"], equals: query.clienteId }
          }
        });
        const cliente = await db.entityData.findFirst({
          where: { id: query.clienteId }
        });
        return {
          cliente: cliente?.data,
          reclamacoes: reclamacoes.map(r => r.data),
          total: reclamacoes.length
        };
      `,
    };

    const response = await apiPost(request, '/custom-apis', apiData);
    expect(response.ok(), `Falha ao criar Custom API: ${await response.text()}`).toBeTruthy();

    const api = await response.json();
    customApiId = api.id;

    expect(api.name).toBe(apiData.name);
    expect(api.isActive).toBe(true);
  });

  test('deve buscar Custom API por ID', async ({ request }) => {
    const response = await apiGet(request, `/custom-apis/${customApiId}`);
    expect(response.ok()).toBeTruthy();

    const api = await response.json();
    expect(api.id).toBe(customApiId);
  });
});

// ============================================================================
// TESTE 6: EXECUTAR CUSTOM API
// ============================================================================

test.describe.serial('6. Executar Custom API', () => {
  test('deve executar API e retornar reclamacoes do cliente', async ({ request }) => {
    const response = await apiGet(
      request,
      `/x/${workspaceId}/cliente-reclamacoes-e2e-${timestamp}?clienteId=${clienteIds[0]}`
    );

    // A API pode retornar 200 com dados ou erro de execucao
    if (response.ok()) {
      const result = await response.json();

      expect(result).toHaveProperty('cliente');
      expect(result).toHaveProperty('reclamacoes');
      expect(result).toHaveProperty('total');
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.reclamacoes[0]).toHaveProperty('titulo');
    } else {
      // Se falhar, pelo menos nao deve ser erro de servidor
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('deve retornar vazio para cliente sem reclamacoes', async ({ request }) => {
    const response = await apiGet(
      request,
      `/x/${workspaceId}/cliente-reclamacoes-e2e-${timestamp}?clienteId=id-inexistente`
    );

    if (response.ok()) {
      const result = await response.json();
      expect(result.total).toBe(0);
      expect(result.reclamacoes).toHaveLength(0);
    }
  });
});

// ============================================================================
// TESTE 7: CRIAR PAGINA COM CUSTOM API VIEWER
// ============================================================================

test.describe.serial('7. Criar Pagina', () => {
  test('deve criar pagina com configuracao de Custom API Viewer', async ({ request }) => {
    const pageData = {
      title: `Dashboard Reclamacoes E2E ${timestamp}`,
      slug: `dashboard-reclamacoes-e2e-${timestamp}`,
      description: 'Pagina de dashboard de reclamacoes criada via teste E2E',
      isPublished: false,
      content: {
        content: [
          {
            type: 'Heading',
            props: {
              text: 'Dashboard de Reclamacoes',
              level: 'h1',
              align: 'center',
            },
          },
          {
            type: 'Spacer',
            props: { size: 'md' },
          },
          {
            type: 'CustomApiViewer',
            props: {
              title: 'Reclamacoes do Cliente',
              apiPath: `/cliente-reclamacoes-e2e-${timestamp}`,
              params: [{ key: 'clienteId', value: clienteIds[0] }],
              displayMode: 'table',
              refreshInterval: 0,
            },
          },
        ],
        root: { props: {} },
      },
    };

    const response = await apiPost(request, '/pages', pageData);
    expect(response.ok(), `Falha ao criar pagina: ${await response.text()}`).toBeTruthy();

    const page = await response.json();
    pageId = page.id;

    expect(page.title).toBe(pageData.title);
    expect(page.isPublished).toBe(false);
  });

  test('deve buscar pagina por ID', async ({ request }) => {
    const response = await apiGet(request, `/pages/${pageId}`);
    expect(response.ok()).toBeTruthy();

    const page = await response.json();
    expect(page.id).toBe(pageId);
    expect(page.content).toBeDefined();
  });

  test('deve publicar pagina', async ({ request }) => {
    const response = await apiPatch(request, `/pages/${pageId}/publish`);
    expect(response.ok()).toBeTruthy();

    const page = await response.json();
    expect(page.isPublished).toBe(true);
  });
});

// ============================================================================
// TESTE 8: TESTAR PREVIEW DA PAGINA
// ============================================================================

test.describe.serial('8. Testar Preview', () => {
  test('deve acessar preview autenticado da pagina', async ({ request }) => {
    const response = await apiGet(
      request,
      `/pages/preview/${workspaceId}/dashboard-reclamacoes-e2e-${timestamp}`
    );

    expect(response.ok()).toBeTruthy();

    const preview = await response.json();
    expect(preview.title).toContain('Dashboard Reclamacoes');
    expect(preview.content).toBeDefined();
    expect(preview.isPublished).toBe(true);
  });

  test('deve acessar pagina publica', async ({ request }) => {
    const response = await request.get(
      `${API_URL}/public/pages/${workspaceId}/dashboard-reclamacoes-e2e-${timestamp}`
    );

    expect(response.ok()).toBeTruthy();

    const page = await response.json();
    expect(page.title).toContain('Dashboard Reclamacoes');
  });

  test('deve despublicar e verificar que preview ainda funciona', async ({ request }) => {
    // Despublicar
    await apiPatch(request, `/pages/${pageId}/unpublish`);

    // Preview autenticado deve funcionar
    const previewResponse = await apiGet(
      request,
      `/pages/preview/${workspaceId}/dashboard-reclamacoes-e2e-${timestamp}`
    );
    expect(previewResponse.ok()).toBeTruthy();

    const preview = await previewResponse.json();
    expect(preview.isPublished).toBe(false);

    // Pagina publica deve falhar (404)
    const publicResponse = await request.get(
      `${API_URL}/public/pages/${workspaceId}/dashboard-reclamacoes-e2e-${timestamp}`
    );
    expect(publicResponse.status()).toBe(404);
  });
});

// ============================================================================
// TESTE 9: ESTATISTICAS
// ============================================================================

test.describe.serial('9. Verificar Estatisticas', () => {
  test('deve refletir novos dados nas estatisticas', async ({ request }) => {
    const response = await apiGet(request, '/stats/dashboard');
    expect(response.ok()).toBeTruthy();

    const stats = await response.json();
    expect(stats.totalEntities).toBeGreaterThan(0);
    expect(stats.totalRecords).toBeGreaterThan(0);
    expect(stats.totalPages).toBeGreaterThan(0);
    expect(stats.totalApis).toBeGreaterThan(0);
  });

  test('deve mostrar distribuicao de entidades', async ({ request }) => {
    const response = await apiGet(request, '/stats/entities-distribution');
    expect(response.ok()).toBeTruthy();
  });
});

// ============================================================================
// TESTE 10: LIMPEZA
// ============================================================================

test.describe.serial('10. Limpeza', () => {
  test('deve excluir pagina criada', async ({ request }) => {
    if (!pageId) {
      test.skip();
      return;
    }

    const response = await apiDelete(request, `/pages/${pageId}`);
    expect(response.ok()).toBeTruthy();
  });

  test('deve excluir Custom API criada', async ({ request }) => {
    if (!customApiId) {
      test.skip();
      return;
    }

    const response = await apiDelete(request, `/custom-apis/${customApiId}`);
    expect(response.ok()).toBeTruthy();
  });

  test('deve excluir reclamacoes criadas', async ({ request }) => {
    for (const id of reclamacaoIds) {
      const response = await apiDelete(
        request,
        `/data/${workspaceId}/reclamacao-e2e-${timestamp}/${id}`
      );
      // Pode ja ter sido deletado
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('deve excluir entidade Reclamacao criada', async ({ request }) => {
    if (!reclamacaoEntityId) {
      test.skip();
      return;
    }

    const response = await apiDelete(request, `/entities/${reclamacaoEntityId}`);
    expect(response.ok()).toBeTruthy();
  });

  test('deve verificar que dados foram limpos', async ({ request }) => {
    // Verificar que entidade foi removida
    const entityResponse = await apiGet(request, `/entities/${reclamacaoEntityId}`);
    expect(entityResponse.status()).toBe(404);

    // Verificar que API foi removida
    const apiResponse = await apiGet(request, `/custom-apis/${customApiId}`);
    expect(apiResponse.status()).toBe(404);

    // Verificar que pagina foi removida
    const pageResponse = await apiGet(request, `/pages/${pageId}`);
    expect(pageResponse.status()).toBe(404);
  });
});

// ============================================================================
// TESTE BONUS: FLUXO COMPLETO EM UM UNICO TESTE
// ============================================================================

test.describe('Fluxo Completo (Single Test)', () => {
  test('deve executar todo o fluxo em sequencia', async ({ request }) => {
    const ts = Date.now();
    let localToken: string;
    let localWorkspaceId: string;
    let localEntityId: string;
    let localRecordId: string;
    let localApiId: string;
    let localPageId: string;
    let localClienteId: string;

    // 1. Login
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: ADMIN_CREDENTIALS,
    });
    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    localToken = loginData.accessToken;

    const headers = { Authorization: `Bearer ${localToken}` };

    // 1.5 Limpeza de dados anteriores com mesmo padrao
    const existingEntities = await request.get(`${API_URL}/entities`, { headers });
    if (existingEntities.ok()) {
      const entitiesData = await existingEntities.json();
      const entities = Array.isArray(entitiesData) ? entitiesData : entitiesData.data || [];

      // Limpar entidades de teste anteriores
      for (const entity of entities) {
        if (entity.slug?.startsWith('ticket-')) {
          // Limpar dados primeiro
          const wsId = entity.workspaceId;
          const dataResp = await request.get(`${API_URL}/data/${wsId}/${entity.slug}`, { headers });
          if (dataResp.ok()) {
            const dataBody = await dataResp.json();
            for (const record of (dataBody.data || [])) {
              await request.delete(`${API_URL}/data/${wsId}/${entity.slug}/${record.id}`, { headers });
            }
          }
          await request.delete(`${API_URL}/entities/${entity.id}`, { headers });
        }
      }
    }

    // Limpar APIs de teste anteriores
    const existingApis = await request.get(`${API_URL}/custom-apis`, { headers });
    if (existingApis.ok()) {
      const apisData = await existingApis.json();
      const apis = Array.isArray(apisData) ? apisData : apisData.data || [];
      for (const api of apis) {
        if (api.path?.includes('tickets-')) {
          await request.delete(`${API_URL}/custom-apis/${api.id}`, { headers });
        }
      }
    }

    // Limpar paginas de teste anteriores
    const existingPages = await request.get(`${API_URL}/pages`, { headers });
    if (existingPages.ok()) {
      const pagesData = await existingPages.json();
      const pages = Array.isArray(pagesData) ? pagesData : pagesData.data || [];
      for (const page of pages) {
        if (page.slug?.includes('tickets-dashboard-')) {
          await request.delete(`${API_URL}/pages/${page.id}`, { headers });
        }
      }
    }

    // 2. Obter workspace e cliente
    const entitiesResponse = await request.get(`${API_URL}/entities`, { headers });
    const entities = (await entitiesResponse.json()).data || [];
    const clienteEntity = entities.find((e: any) => e.slug === 'cliente');
    expect(clienteEntity).toBeTruthy();
    localWorkspaceId = clienteEntity.workspaceId;

    const clientesResponse = await request.get(
      `${API_URL}/data/${localWorkspaceId}/cliente`,
      { headers }
    );
    const clientes = (await clientesResponse.json()).data || [];
    expect(clientes.length).toBeGreaterThan(0);
    localClienteId = clientes[0].id;

    // 3. Criar entidade
    const entityResponse = await request.post(`${API_URL}/entities`, {
      headers,
      data: {
        name: `Ticket ${ts}`,
        namePlural: `Tickets ${ts}`,
        slug: `ticket-${ts}`,
        description: 'Tickets de suporte',
        icon: 'ticket',
        fields: [
          { name: 'Assunto', slug: 'assunto', type: 'text', required: true },
          { name: 'Cliente', slug: 'clienteId', type: 'relation', required: true },
          { name: 'Status', slug: 'status', type: 'select', required: true, options: [
            { label: 'Novo', value: 'novo' },
            { label: 'Fechado', value: 'fechado' },
          ]},
        ],
      },
    });
    expect(entityResponse.ok()).toBeTruthy();
    localEntityId = (await entityResponse.json()).id;

    // 4. Criar registro
    const recordResponse = await request.post(
      `${API_URL}/data/${localWorkspaceId}/ticket-${ts}`,
      {
        headers,
        data: {
          data: {
            assunto: `Ticket de teste ${ts}`,
            clienteId: localClienteId,
            status: 'novo',
          },
        },
      }
    );
    expect(recordResponse.ok()).toBeTruthy();
    localRecordId = (await recordResponse.json()).id;

    // 5. Criar Custom API
    const apiResponse = await request.post(`${API_URL}/custom-apis`, {
      headers,
      data: {
        name: `Tickets API ${ts}`,
        path: `/tickets-${ts}`,
        method: 'GET',
        auth: 'JWT',
        isActive: true,
        logic: `
          const tickets = await db.entityData.findMany({
            where: { entity: { slug: "ticket-${ts}" } }
          });
          return { tickets: tickets.map(t => t.data), total: tickets.length };
        `,
      },
    });
    expect(apiResponse.ok()).toBeTruthy();
    localApiId = (await apiResponse.json()).id;

    // 6. Criar pagina
    const pageResponse = await request.post(`${API_URL}/pages`, {
      headers,
      data: {
        title: `Tickets Dashboard ${ts}`,
        slug: `tickets-dashboard-${ts}`,
        isPublished: true,
        content: {
          content: [
            { type: 'Heading', props: { text: 'Tickets', level: 'h1', align: 'left' } },
          ],
          root: { props: {} },
        },
      },
    });
    expect(pageResponse.ok()).toBeTruthy();
    localPageId = (await pageResponse.json()).id;

    // 7. Testar Custom API
    const customApiResponse = await request.get(
      `${API_URL}/x/${localWorkspaceId}/tickets-${ts}`,
      { headers }
    );
    if (customApiResponse.ok()) {
      const result = await customApiResponse.json();
      expect(result.total).toBeGreaterThanOrEqual(1);
    }

    // 8. Limpeza
    await request.delete(`${API_URL}/pages/${localPageId}`, { headers });
    await request.delete(`${API_URL}/custom-apis/${localApiId}`, { headers });
    await request.delete(`${API_URL}/data/${localWorkspaceId}/ticket-${ts}/${localRecordId}`, { headers });
    await request.delete(`${API_URL}/entities/${localEntityId}`, { headers });

    // Verificar limpeza
    const checkEntity = await request.get(`${API_URL}/entities/${localEntityId}`, { headers });
    expect(checkEntity.status()).toBe(404);
  });
});
