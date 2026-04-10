#!/usr/bin/env node

/**
 * 🔥 Teste de Carga com Dados Mock
 *
 * Cria usuários temporários via API de registro (se disponível)
 * ou usa servidor mock local para simular alta concorrência
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOTAL_REQUESTS = parseInt(process.env.TOTAL || '500', 10);
const CONCURRENT_BATCH = parseInt(process.env.BATCH || '50', 10);
const MOCK_DIR = '/tmp/crm-load-test';
const USE_REAL_API = process.env.USE_REAL_API !== 'false';

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 10000,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, body: parsed });
        } catch (err) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function registerUser(email, password, name, tenantName) {
  try {
    const res = await makeRequest('POST', '/api/v1/auth/register', {
      email,
      password,
      name,
      tenantName,
    });

    if (res.status === 200 || res.status === 201) {
      return { success: true, token: res.body.accessToken };
    }

    return { success: false, error: res.body };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function login(email, password) {
  try {
    const res = await makeRequest('POST', '/api/v1/auth/login', { email, password });

    if (res.status === 200 || res.status === 201) {
      return { success: true, token: res.body.accessToken };
    }

    return { success: false, error: res.body };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// MOCK DATA SETUP
// ═══════════════════════════════════════════════════════════════════

class MockDataManager {
  constructor() {
    this.users = [];
    this.entities = ['leads', 'clientes', 'vendas', 'produtos'];
    this.mockRecords = new Map();

    if (!fs.existsSync(MOCK_DIR)) {
      fs.mkdirSync(MOCK_DIR, { recursive: true });
    }
  }

  async setupMockUsers() {
    console.log('\n🎭 Configurando usuários de teste...\n');

    const testUsers = [
      { email: `test-admin-1@loadtest.tmp`, password: 'Test123!@#', name: 'Admin Tenant 1', tenant: 'LoadTest-Tenant-1' },
      { email: `test-admin-2@loadtest.tmp`, password: 'Test123!@#', name: 'Admin Tenant 2', tenant: 'LoadTest-Tenant-2' },
      { email: `test-user-1@loadtest.tmp`, password: 'Test123!@#', name: 'User Tenant 1', tenant: 'LoadTest-Tenant-1' },
    ];

    for (const user of testUsers) {
      // Tentar registrar novo usuário
      console.log(`  Registrando ${user.email}...`);
      const registerResult = await registerUser(user.email, user.password, user.name, user.tenant);

      if (registerResult.success) {
        console.log(`    ✅ Registrado com sucesso`);
        this.users.push({ ...user, token: registerResult.token });
        continue;
      }

      // Se já existe, tentar login
      console.log(`    ⚠️  Já existe, tentando login...`);
      const loginResult = await login(user.email, user.password);

      if (loginResult.success) {
        console.log(`    ✅ Login bem-sucedido`);
        this.users.push({ ...user, token: loginResult.token });
      } else {
        console.log(`    ❌ Falha: ${loginResult.error?.message || 'erro desconhecido'}`);
      }
    }

    if (this.users.length === 0) {
      console.log('\n⚠️  Nenhum usuário conseguiu autenticar.');
      console.log('💡 Usando modo MOCK (sem API real)\n');

      // Criar tokens mock
      this.users = testUsers.map(u => ({
        ...u,
        token: `mock-token-${u.email}`,
      }));
    }

    console.log(`\n✅ ${this.users.length} usuário(s) pronto(s)\n`);

    // Salvar config no /tmp
    const configPath = path.join(MOCK_DIR, 'users.json');
    fs.writeFileSync(configPath, JSON.stringify(this.users, null, 2));

    return this.users;
  }

  generateMockData(entity, operationNum) {
    const base = {
      nome: `Mock ${entity} #${operationNum}`,
      status: ['novo', 'em-andamento', 'concluido'][Math.floor(Math.random() * 3)],
      created_at: new Date().toISOString(),
      test_id: `load-${operationNum}`,
    };

    if (entity.includes('lead') || entity.includes('cliente')) {
      base.email = `mock${operationNum}@test.tmp`;
      base.telefone = `+5511${String(operationNum).padStart(8, '0')}`;
    }

    if (entity.includes('venda') || entity.includes('produto')) {
      base.valor = Math.floor(Math.random() * 10000);
      base.quantidade = Math.floor(Math.random() * 100);
    }

    return base;
  }

  async simulateOperation(operation, user, entity, operationNum) {
    const startTime = Date.now();

    try {
      let result;

      if (USE_REAL_API && user.token && !user.token.startsWith('mock-')) {
        // Usar API real
        result = await this.executeRealOperation(operation, user, entity, operationNum);
      } else {
        // Simular localmente (muito rápido)
        result = this.executeMockOperation(operation, user, entity, operationNum);
      }

      const duration = Date.now() - startTime;
      return { success: result.success, duration, operation };

    } catch (err) {
      const duration = Date.now() - startTime;
      return { success: false, duration, error: err.message, operation };
    }
  }

  async executeRealOperation(operation, user, entity, operationNum) {
    const data = this.generateMockData(entity, operationNum);

    switch (operation) {
      case 'CREATE': {
        const res = await makeRequest(
          'POST',
          `/api/v1/data/${entity}`,
          { data },
          { Authorization: `Bearer ${user.token}` }
        );

        if (res.status === 200 || res.status === 201) {
          const recordId = res.body.id;
          if (!this.mockRecords.has(entity)) this.mockRecords.set(entity, []);
          this.mockRecords.get(entity).push(recordId);
          return { success: true, recordId };
        }

        return { success: false, status: res.status };
      }

      case 'UPDATE': {
        let records = this.mockRecords.get(entity) || [];

        // Se não tem records, criar um
        if (records.length === 0) {
          const createRes = await this.executeRealOperation('CREATE', user, entity, operationNum);
          if (!createRes.success) return createRes;
          records = this.mockRecords.get(entity);
        }

        const recordId = records[Math.floor(Math.random() * records.length)];
        const res = await makeRequest(
          'PATCH',
          `/api/v1/data/${entity}/${recordId}`,
          { data: { ...data, updated: true } },
          { Authorization: `Bearer ${user.token}` }
        );

        return { success: res.status === 200 };
      }

      case 'DELETE': {
        const records = this.mockRecords.get(entity) || [];
        if (records.length === 0) return { success: true }; // Nada para deletar

        const recordId = records.pop();
        const res = await makeRequest(
          'DELETE',
          `/api/v1/data/${entity}/${recordId}`,
          null,
          { Authorization: `Bearer ${user.token}` }
        );

        return { success: res.status === 200 || res.status === 204 };
      }

      default:
        return { success: false };
    }
  }

  executeMockOperation(operation, user, entity, operationNum) {
    // Simular latência (5-50ms)
    const mockLatency = 5 + Math.random() * 45;
    const startTime = Date.now();
    while (Date.now() - startTime < mockLatency) {
      // Busy wait para simular processamento
    }

    // Simular 2% de falhas aleatórias
    if (Math.random() < 0.02) {
      return { success: false, mock: true };
    }

    const data = this.generateMockData(entity, operationNum);

    switch (operation) {
      case 'CREATE': {
        const recordId = `mock-${entity}-${operationNum}`;
        if (!this.mockRecords.has(entity)) this.mockRecords.set(entity, []);
        this.mockRecords.get(entity).push(recordId);
        return { success: true, mock: true, recordId };
      }

      case 'UPDATE': {
        const records = this.mockRecords.get(entity) || [];
        if (records.length === 0) {
          // Criar um record mock
          const recordId = `mock-${entity}-${operationNum}`;
          this.mockRecords.get(entity).push(recordId);
        }
        return { success: true, mock: true };
      }

      case 'DELETE': {
        const records = this.mockRecords.get(entity) || [];
        if (records.length > 0) records.pop();
        return { success: true, mock: true };
      }

      default:
        return { success: false, mock: true };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// LOAD TESTER
// ═══════════════════════════════════════════════════════════════════

class LoadTester {
  constructor(mockManager) {
    this.mockManager = mockManager;
    this.stats = {
      operations: {
        CREATE: { success: 0, errors: 0, times: [] },
        UPDATE: { success: 0, errors: 0, times: [] },
        DELETE: { success: 0, errors: 0, times: [] },
      },
      tenants: new Map(),
    };
  }

  selectOperation() {
    const rand = Math.random() * 100;
    if (rand < 40) return 'CREATE';
    if (rand < 80) return 'UPDATE';
    return 'DELETE';
  }

  async run() {
    console.log('🚀 Iniciando teste de carga...\n');
    const startTime = Date.now();

    let totalSuccess = 0;
    let totalErrors = 0;

    for (let batch = 0; batch < Math.ceil(TOTAL_REQUESTS / CONCURRENT_BATCH); batch++) {
      const batchSize = Math.min(CONCURRENT_BATCH, TOTAL_REQUESTS - (batch * CONCURRENT_BATCH));
      const promises = [];

      for (let i = 0; i < batchSize; i++) {
        const operationNum = (batch * CONCURRENT_BATCH) + i + 1;
        const user = this.mockManager.users[Math.floor(Math.random() * this.mockManager.users.length)];
        const entity = this.mockManager.entities[Math.floor(Math.random() * this.mockManager.entities.length)];
        const operation = this.selectOperation();

        const promise = this.mockManager.simulateOperation(operation, user, entity, operationNum)
          .then(result => {
            this.stats.operations[operation].times.push(result.duration);

            if (result.success) {
              this.stats.operations[operation].success++;
              this.stats.tenants.set(user.tenant, (this.stats.tenants.get(user.tenant) || 0) + 1);
              totalSuccess++;
            } else {
              this.stats.operations[operation].errors++;
              totalErrors++;
            }

            this.printProgress(operationNum, TOTAL_REQUESTS, totalSuccess, totalErrors);
          });

        promises.push(promise);
      }

      await Promise.all(promises);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const throughput = (TOTAL_REQUESTS / parseFloat(totalTime)).toFixed(2);

    console.log('\n\n');
    console.log(`⏱️  Tempo total: ${totalTime}s`);
    console.log(`📈 Throughput: ${throughput} req/s\n`);

    this.printStats();

    // Salvar resultados
    const resultsPath = path.join(MOCK_DIR, `results-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      config: { total: TOTAL_REQUESTS, batch: CONCURRENT_BATCH, useRealApi: USE_REAL_API },
      stats: this.stats,
      totalTime: parseFloat(totalTime),
      throughput: parseFloat(throughput),
    }, null, 2));

    console.log(`💾 Resultados salvos em: ${resultsPath}\n`);
  }

  printProgress(current, total, successCount, errorCount) {
    const percentage = ((current / total) * 100).toFixed(1);
    const successRate = current > 0 ? ((successCount / current) * 100).toFixed(1) : '0.0';

    process.stdout.write(
      `\r🚀 Progresso: ${current}/${total} (${percentage}%) | ✅ ${successCount} | ❌ ${errorCount} | Taxa: ${successRate}%`
    );
  }

  printStats() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📊 RESULTADOS DO TESTE DE CARGA');
    console.log('═══════════════════════════════════════════════════════════\n');

    const totalSuccess = Object.values(this.stats.operations).reduce((sum, op) => sum + op.success, 0);
    const totalErrors = Object.values(this.stats.operations).reduce((sum, op) => sum + op.errors, 0);
    const totalOps = totalSuccess + totalErrors;
    const successRate = totalOps > 0 ? ((totalSuccess / totalOps) * 100).toFixed(2) : '0';

    console.log('📈 RESUMO GERAL:\n');
    console.log(`  Total de operações:  ${totalOps}`);
    console.log(`  ✅ Sucesso:          ${totalSuccess} (${successRate}%)`);
    console.log(`  ❌ Erros:            ${totalErrors}\n`);

    console.log('📋 POR TIPO DE OPERAÇÃO:\n');
    for (const [op, stats] of Object.entries(this.stats.operations)) {
      const total = stats.success + stats.errors;
      if (total === 0) continue;

      const avgTime = stats.times.length > 0
        ? (stats.times.reduce((a, b) => a + b, 0) / stats.times.length).toFixed(0)
        : '0';

      console.log(`  ${op}:`);
      console.log(`    ✅ ${stats.success} | ❌ ${stats.errors} | ⏱️  ${avgTime}ms\n`);
    }

    console.log('🏢 POR TENANT:\n');
    for (const [tenant, count] of this.stats.tenants.entries()) {
      console.log(`  ${tenant}: ${count} operações`);
    }

    // Latência
    const allTimes = Object.values(this.stats.operations).flatMap(op => op.times);
    if (allTimes.length > 0) {
      const sorted = allTimes.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      console.log('\n⏱️  LATÊNCIA:\n');
      console.log(`  p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms\n`);

      if (p95 < 200) {
        console.log('  ✅ Latência excelente!\n');
      } else if (p95 < 500) {
        console.log('  ✅ Latência boa\n');
      } else {
        console.log('  ⚠️  Latência alta\n');
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n');
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔥 TESTE DE CARGA - CRM Builder API');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  API:                  ${API_URL}`);
  console.log(`  Total de requisições: ${TOTAL_REQUESTS}`);
  console.log(`  Batch concorrente:    ${CONCURRENT_BATCH}`);
  console.log(`  Modo:                 ${USE_REAL_API ? 'API Real' : 'Mock Local'}`);
  console.log(`  Diretório mock:       ${MOCK_DIR}\n`);

  try {
    const mockManager = new MockDataManager();
    await mockManager.setupMockUsers();

    const tester = new LoadTester(mockManager);
    await tester.run();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ Teste concluído!');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ Erro fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
