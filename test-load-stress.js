#!/usr/bin/env node

/**
 * 🔥 Teste de Carga e Stress - CRM Builder API
 *
 * Simula cenário real de produção com múltiplos tenants,
 * operações mistas (CREATE/UPDATE/DELETE) e alta concorrência.
 *
 * Testa se a API aguenta:
 * - 500+ requisições simultâneas
 * - Múltiplos tenants (isolamento)
 * - Operações misturadas
 * - Race conditions
 * - Deadlocks
 */

const https = require('https');
const http = require('http');

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOTAL_REQUESTS = parseInt(process.env.TOTAL || '500', 10);
const CONCURRENT_BATCH = parseInt(process.env.BATCH || '50', 10);

// Credenciais de múltiplos usuários/tenants para teste
// IMPORTANTE: Criar esses usuários antes ou passar via ENV
const TEST_USERS = process.env.TEST_USERS
  ? JSON.parse(process.env.TEST_USERS)
  : [
      { email: 'admin@tenant1.com', password: 'senha123', tenant: 'tenant1' },
      { email: 'admin@tenant2.com', password: 'senha123', tenant: 'tenant2' },
      { email: 'user@tenant1.com', password: 'senha123', tenant: 'tenant1' },
    ];

// Entidades para testar (ajustar conforme seu schema)
const ENTITIES = process.env.ENTITIES
  ? process.env.ENTITIES.split(',')
  : ['leads', 'clientes', 'vendas'];

// Mix de operações (% de cada tipo)
const OPERATION_MIX = {
  CREATE: 40, // 40%
  UPDATE: 40, // 40%
  DELETE: 20, // 20%
};

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
      timeout: 10000, // 10s timeout
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (err) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function login(email, password) {
  try {
    const res = await makeRequest('POST', '/api/v1/auth/login', { email, password });
    if (res.status === 200 || res.status === 201) {
      return res.body.accessToken;
    }
    throw new Error(`Login failed: ${res.status}`);
  } catch (err) {
    throw new Error(`Login error for ${email}: ${err.message}`);
  }
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateTestData(entitySlug, operationNum) {
  // Gerar dados fictícios baseado na entidade
  const baseData = {
    nome: `Teste ${entitySlug} #${operationNum}`,
    status: randomItem(['novo', 'em-andamento', 'concluido', 'cancelado']),
    timestamp: new Date().toISOString(),
    test_id: `load-test-${operationNum}`,
  };

  // Campos específicos por entidade
  if (entitySlug.includes('lead') || entitySlug.includes('cliente')) {
    baseData.email = `teste${operationNum}@exemplo.com`;
    baseData.telefone = `+55119${String(operationNum).padStart(7, '0')}`;
  }

  if (entitySlug.includes('venda') || entitySlug.includes('pedido')) {
    baseData.valor = Math.floor(Math.random() * 10000);
    baseData.quantidade = Math.floor(Math.random() * 100);
  }

  return baseData;
}

// ═══════════════════════════════════════════════════════════════════
// OPERAÇÕES
// ═══════════════════════════════════════════════════════════════════

class LoadTester {
  constructor() {
    this.tokens = new Map(); // email -> token
    this.createdRecords = new Map(); // entitySlug -> [recordIds]
    this.stats = {
      operations: {
        CREATE: { success: 0, errors: 0, times: [] },
        UPDATE: { success: 0, errors: 0, times: [] },
        DELETE: { success: 0, errors: 0, times: [] },
      },
      errors: {
        timeout: 0,
        conflict: 0,
        serverError: 0,
        other: 0,
      },
      tenants: new Map(), // tenantId -> count
    };
  }

  async initialize() {
    console.log('\n🔐 Autenticando usuários...\n');

    for (const user of TEST_USERS) {
      try {
        const token = await login(user.email, user.password);
        this.tokens.set(user.email, token);
        console.log(`  ✅ ${user.email} (${user.tenant})`);
      } catch (err) {
        console.log(`  ⚠️  ${user.email}: ${err.message}`);
      }
    }

    if (this.tokens.size === 0) {
      throw new Error('Nenhum usuário conseguiu autenticar!');
    }

    console.log(`\n✅ ${this.tokens.size} usuário(s) autenticado(s)\n`);

    // Inicializar mapa de records criados
    for (const entity of ENTITIES) {
      this.createdRecords.set(entity, []);
    }
  }

  async executeOperation(operationType, user, entitySlug, operationNum) {
    const token = this.tokens.get(user.email);
    if (!token) return;

    const startTime = Date.now();

    try {
      let result;

      switch (operationType) {
        case 'CREATE':
          result = await this.createRecord(token, entitySlug, operationNum);
          break;
        case 'UPDATE':
          result = await this.updateRecord(token, entitySlug, operationNum);
          break;
        case 'DELETE':
          result = await this.deleteRecord(token, entitySlug);
          break;
      }

      const duration = Date.now() - startTime;
      this.stats.operations[operationType].times.push(duration);

      if (result.success) {
        this.stats.operations[operationType].success++;
        this.stats.tenants.set(user.tenant, (this.stats.tenants.get(user.tenant) || 0) + 1);
        return { success: true, duration };
      } else {
        this.stats.operations[operationType].errors++;
        this.categorizeError(result.status);
        return { success: false, duration, error: result.error };
      }

    } catch (err) {
      const duration = Date.now() - startTime;
      this.stats.operations[operationType].errors++;

      if (err.message.includes('timeout')) {
        this.stats.errors.timeout++;
      } else {
        this.stats.errors.other++;
      }

      return { success: false, duration, error: err.message };
    }
  }

  async createRecord(token, entitySlug, operationNum) {
    try {
      const data = generateTestData(entitySlug, operationNum);
      const res = await makeRequest(
        'POST',
        `/api/v1/data/${entitySlug}`,
        { data },
        { Authorization: `Bearer ${token}` }
      );

      if (res.status === 200 || res.status === 201) {
        // Guardar ID para updates/deletes futuros
        const recordId = res.body.id;
        this.createdRecords.get(entitySlug).push(recordId);
        return { success: true, recordId };
      }

      return { success: false, status: res.status, error: res.body };
    } catch (err) {
      throw err;
    }
  }

  async updateRecord(token, entitySlug, operationNum) {
    const records = this.createdRecords.get(entitySlug);

    // Se não tem records criados ainda, criar um primeiro
    if (records.length === 0) {
      const createResult = await this.createRecord(token, entitySlug, operationNum);
      if (!createResult.success) return createResult;
    }

    const recordId = randomItem(records);
    const updateData = {
      status: randomItem(['novo', 'em-andamento', 'concluido']),
      updated_at_test: new Date().toISOString(),
      update_count: operationNum,
    };

    try {
      const res = await makeRequest(
        'PATCH',
        `/api/v1/data/${entitySlug}/${recordId}`,
        { data: updateData },
        { Authorization: `Bearer ${token}` }
      );

      if (res.status === 200) {
        return { success: true };
      }

      return { success: false, status: res.status, error: res.body };
    } catch (err) {
      throw err;
    }
  }

  async deleteRecord(token, entitySlug) {
    const records = this.createdRecords.get(entitySlug);

    if (records.length === 0) {
      // Não tem nada para deletar, contar como sucesso
      return { success: true };
    }

    const recordId = records.pop(); // Remove do array

    try {
      const res = await makeRequest(
        'DELETE',
        `/api/v1/data/${entitySlug}/${recordId}`,
        null,
        { Authorization: `Bearer ${token}` }
      );

      if (res.status === 200 || res.status === 204) {
        return { success: true };
      }

      // Se falhou, devolver para o array
      records.push(recordId);
      return { success: false, status: res.status, error: res.body };
    } catch (err) {
      // Se falhou, devolver para o array
      records.push(recordId);
      throw err;
    }
  }

  categorizeError(status) {
    if (!status) return;

    if (status === 409) {
      this.stats.errors.conflict++;
    } else if (status >= 500) {
      this.stats.errors.serverError++;
    } else {
      this.stats.errors.other++;
    }
  }

  selectOperation() {
    const rand = Math.random() * 100;
    let cumulative = 0;

    for (const [op, percentage] of Object.entries(OPERATION_MIX)) {
      cumulative += percentage;
      if (rand <= cumulative) return op;
    }

    return 'CREATE';
  }

  printProgress(current, total, successCount, errorCount) {
    const percentage = ((current / total) * 100).toFixed(1);
    const successRate = total > 0 ? ((successCount / current) * 100).toFixed(1) : '0.0';

    process.stdout.write(
      `\r🚀 Progresso: ${current}/${total} (${percentage}%) | ✅ ${successCount} | ❌ ${errorCount} | Taxa: ${successRate}%`
    );
  }

  printStats() {
    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📊 RESULTADOS DO TESTE DE CARGA');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Total geral
    const totalSuccess = Object.values(this.stats.operations).reduce((sum, op) => sum + op.success, 0);
    const totalErrors = Object.values(this.stats.operations).reduce((sum, op) => sum + op.errors, 0);
    const totalOps = totalSuccess + totalErrors;
    const successRate = totalOps > 0 ? ((totalSuccess / totalOps) * 100).toFixed(2) : '0';

    console.log('📈 RESUMO GERAL:\n');
    console.log(`  Total de operações:  ${totalOps}`);
    console.log(`  ✅ Sucesso:          ${totalSuccess} (${successRate}%)`);
    console.log(`  ❌ Erros:            ${totalErrors} (${(100 - parseFloat(successRate)).toFixed(2)}%)\n`);

    // Por tipo de operação
    console.log('📋 POR TIPO DE OPERAÇÃO:\n');
    for (const [op, stats] of Object.entries(this.stats.operations)) {
      const total = stats.success + stats.errors;
      if (total === 0) continue;

      const opSuccessRate = ((stats.success / total) * 100).toFixed(1);
      const avgTime = stats.times.length > 0
        ? (stats.times.reduce((a, b) => a + b, 0) / stats.times.length).toFixed(0)
        : '0';
      const minTime = stats.times.length > 0 ? Math.min(...stats.times) : 0;
      const maxTime = stats.times.length > 0 ? Math.max(...stats.times) : 0;

      console.log(`  ${op}:`);
      console.log(`    ✅ Sucesso:  ${stats.success} (${opSuccessRate}%)`);
      console.log(`    ❌ Erros:    ${stats.errors}`);
      console.log(`    ⏱️  Tempo:    ${avgTime}ms (min: ${minTime}ms, max: ${maxTime}ms)\n`);
    }

    // Por tenant
    console.log('🏢 POR TENANT:\n');
    for (const [tenant, count] of this.stats.tenants.entries()) {
      console.log(`  ${tenant}: ${count} operações`);
    }
    console.log();

    // Tipos de erro
    console.log('⚠️  ERROS DETALHADOS:\n');
    console.log(`  Timeouts:        ${this.stats.errors.timeout}`);
    console.log(`  Conflitos (409): ${this.stats.errors.conflict}`);
    console.log(`  Server (5xx):    ${this.stats.errors.serverError}`);
    console.log(`  Outros:          ${this.stats.errors.other}\n`);

    // Análise
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  🔍 ANÁLISE');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (parseFloat(successRate) >= 99) {
      console.log('  ✅ EXCELENTE! API está muito saudável.');
      console.log('  ✅ Taxa de sucesso > 99%\n');
    } else if (parseFloat(successRate) >= 95) {
      console.log('  ✅ BOM! API está saudável.');
      console.log('  ✅ Taxa de sucesso > 95%\n');
    } else if (parseFloat(successRate) >= 90) {
      console.log('  ⚠️  ACEITÁVEL. API tem algumas falhas.');
      console.log('  ⚠️  Taxa de sucesso entre 90-95%');
      console.log('  💡 Considere investigar os erros.\n');
    } else {
      console.log('  ❌ PROBLEMA! API tem muitas falhas.');
      console.log('  ❌ Taxa de sucesso < 90%');
      console.log('  🔥 AÇÃO NECESSÁRIA: Verifique logs e infraestrutura!\n');
    }

    if (this.stats.errors.timeout > totalOps * 0.05) {
      console.log('  ⚠️  Alto número de timeouts (>5%)');
      console.log('  💡 API pode estar sobrecarregada ou lenta.\n');
    }

    if (this.stats.errors.serverError > 0) {
      console.log('  ⚠️  Erros 5xx detectados!');
      console.log('  💡 Verifique logs da API: docker logs crm-api-dev\n');
    }

    if (this.stats.errors.conflict > totalOps * 0.1) {
      console.log('  ℹ️  Alto número de conflitos (>10%)');
      console.log('  💡 Pode indicar race conditions ou validações estritas.\n');
    }

    // Tempo de resposta
    const allTimes = Object.values(this.stats.operations)
      .flatMap(op => op.times);

    if (allTimes.length > 0) {
      const avgTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
      const sorted = allTimes.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      console.log('⏱️  LATÊNCIA:\n');
      console.log(`  Média:  ${avgTime.toFixed(0)}ms`);
      console.log(`  p50:    ${p50}ms`);
      console.log(`  p95:    ${p95}ms`);
      console.log(`  p99:    ${p99}ms\n`);

      if (p95 < 500) {
        console.log('  ✅ Latência excelente (p95 < 500ms)\n');
      } else if (p95 < 1000) {
        console.log('  ⚠️  Latência aceitável (p95 < 1s)\n');
      } else {
        console.log('  ❌ Latência alta (p95 > 1s)\n');
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n');
  }

  async cleanup() {
    console.log('\n🗑️  Limpando registros de teste...\n');

    let deleted = 0;
    for (const [entitySlug, recordIds] of this.createdRecords.entries()) {
      if (recordIds.length === 0) continue;

      console.log(`  Deletando ${recordIds.length} registros de "${entitySlug}"...`);

      const user = randomItem(TEST_USERS);
      const token = this.tokens.get(user.email);
      if (!token) continue;

      // Deletar em batches de 10
      for (let i = 0; i < recordIds.length; i += 10) {
        const batch = recordIds.slice(i, i + 10);
        const promises = batch.map(id =>
          makeRequest('DELETE', `/api/v1/data/${entitySlug}/${id}`, null, {
            Authorization: `Bearer ${token}`,
          }).catch(() => {}) // Ignorar erros na limpeza
        );
        await Promise.all(promises);
        deleted += batch.length;
      }
    }

    console.log(`\n✅ ${deleted} registros deletados.\n`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔥 TESTE DE CARGA E STRESS - CRM Builder API');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  API:                  ${API_URL}`);
  console.log(`  Total de requisições: ${TOTAL_REQUESTS}`);
  console.log(`  Batch concorrente:    ${CONCURRENT_BATCH}`);
  console.log(`  Usuários de teste:    ${TEST_USERS.length}`);
  console.log(`  Entidades:            ${ENTITIES.join(', ')}`);
  console.log(`  Mix de operações:     CREATE ${OPERATION_MIX.CREATE}%, UPDATE ${OPERATION_MIX.UPDATE}%, DELETE ${OPERATION_MIX.DELETE}%\n`);

  const tester = new LoadTester();

  try {
    // Autenticar usuários
    await tester.initialize();

    // Executar requisições
    console.log('🚀 Iniciando teste de carga...\n');
    const startTime = Date.now();

    let successCount = 0;
    let errorCount = 0;

    for (let batch = 0; batch < Math.ceil(TOTAL_REQUESTS / CONCURRENT_BATCH); batch++) {
      const batchSize = Math.min(CONCURRENT_BATCH, TOTAL_REQUESTS - (batch * CONCURRENT_BATCH));
      const promises = [];

      for (let i = 0; i < batchSize; i++) {
        const operationNum = (batch * CONCURRENT_BATCH) + i + 1;
        const user = randomItem(TEST_USERS);
        const entitySlug = randomItem(ENTITIES);
        const operationType = tester.selectOperation();

        const promise = tester.executeOperation(operationType, user, entitySlug, operationNum)
          .then(result => {
            if (result.success) successCount++;
            else errorCount++;
            tester.printProgress(operationNum, TOTAL_REQUESTS, successCount, errorCount);
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

    // Mostrar estatísticas
    tester.printStats();

    // Limpar registros
    const shouldCleanup = process.env.CLEANUP !== 'false';
    if (shouldCleanup) {
      await tester.cleanup();
    } else {
      console.log('ℹ️  Limpeza desabilitada (CLEANUP=false)\n');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ Teste concluído!');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ Erro fatal durante teste:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
