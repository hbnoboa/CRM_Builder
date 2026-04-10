#!/usr/bin/env node

/**
 * Teste de Requisições Simultâneas - CRM Builder
 *
 * Simula múltiplos usuários fazendo updates no kanban simultaneamente
 * para verificar se a API trava ou causa race conditions.
 */

const https = require('https');
const http = require('http');

// ─── CONFIG ──────────────────────────────────────────────────────────

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOKEN = process.env.AUTH_TOKEN || '';
const ENTITY_SLUG = process.env.ENTITY_SLUG || 'leads'; // Altere conforme sua entidade
const RECORD_ID = process.env.RECORD_ID || ''; // ID de um registro para testar

const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT || '10', 10);
const TOTAL_REQUESTS = parseInt(process.env.TOTAL || '50', 10);

// ─── HELPERS ─────────────────────────────────────────────────────────

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
        'Authorization': `Bearer ${TOKEN}`,
        ...headers,
      },
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

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// ─── TESTS ───────────────────────────────────────────────────────────

async function testConcurrentUpdates() {
  console.log('\n🧪 Teste: Updates Simultâneos no Mesmo Registro\n');
  console.log(`Configuração:`);
  console.log(`  - API: ${API_URL}`);
  console.log(`  - Entidade: ${ENTITY_SLUG}`);
  console.log(`  - Record ID: ${RECORD_ID || '(será criado)'}`);
  console.log(`  - Requisições simultâneas: ${CONCURRENT_REQUESTS}`);
  console.log(`  - Total de requisições: ${TOTAL_REQUESTS}\n`);

  if (!TOKEN) {
    console.error('❌ ERRO: AUTH_TOKEN não configurado!');
    console.log('\nUso:');
    console.log('  AUTH_TOKEN="seu-token" node test-concurrent-requests.js\n');
    process.exit(1);
  }

  // Criar ou usar registro existente
  let recordId = RECORD_ID;
  if (!recordId) {
    console.log('📝 Criando registro de teste...');
    try {
      const createRes = await makeRequest('POST', `/api/v1/data/${ENTITY_SLUG}`, {
        data: {
          nome: `Teste Concorrência ${Date.now()}`,
          status: 'novo',
        },
      });

      if (createRes.status === 201 || createRes.status === 200) {
        recordId = createRes.body.id;
        console.log(`✅ Registro criado: ${recordId}\n`);
      } else {
        console.error(`❌ Falha ao criar registro: ${createRes.status}`, createRes.body);
        process.exit(1);
      }
    } catch (err) {
      console.error('❌ Erro ao criar registro:', err.message);
      process.exit(1);
    }
  }

  // Valores diferentes para simular mudanças de coluna no kanban
  const statuses = ['novo', 'em-andamento', 'concluido', 'cancelado'];

  const results = {
    success: 0,
    errors: 0,
    conflicts: 0,
    times: [],
  };

  console.log('🚀 Iniciando requisições simultâneas...\n');

  // Executar em batches de CONCURRENT_REQUESTS
  for (let batch = 0; batch < Math.ceil(TOTAL_REQUESTS / CONCURRENT_REQUESTS); batch++) {
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - (batch * CONCURRENT_REQUESTS));
    const promises = [];

    for (let i = 0; i < batchSize; i++) {
      const requestNum = (batch * CONCURRENT_REQUESTS) + i + 1;
      const status = statuses[requestNum % statuses.length];

      const startTime = Date.now();
      const promise = makeRequest('PATCH', `/api/v1/data/${ENTITY_SLUG}/${recordId}`, {
        data: { status, updated_by_test: requestNum },
      })
        .then((res) => {
          const duration = Date.now() - startTime;
          results.times.push(duration);

          if (res.status === 200) {
            results.success++;
            process.stdout.write(`✅`);
          } else if (res.status === 409) {
            results.conflicts++;
            process.stdout.write(`⚠️`);
          } else {
            results.errors++;
            process.stdout.write(`❌`);
          }
        })
        .catch((err) => {
          results.errors++;
          process.stdout.write(`❌`);
        });

      promises.push(promise);
    }

    await Promise.all(promises);
    console.log(` Batch ${batch + 1} completo`);
  }

  // Resultados
  console.log('\n\n📊 Resultados:\n');
  console.log(`  ✅ Sucesso:    ${results.success}`);
  console.log(`  ⚠️  Conflitos:  ${results.conflicts}`);
  console.log(`  ❌ Erros:      ${results.errors}`);
  console.log(`  📈 Total:      ${TOTAL_REQUESTS}\n`);

  if (results.times.length > 0) {
    const avg = results.times.reduce((a, b) => a + b, 0) / results.times.length;
    const min = Math.min(...results.times);
    const max = Math.max(...results.times);

    console.log(`⏱️  Tempos de Resposta:\n`);
    console.log(`  Média:   ${avg.toFixed(0)}ms`);
    console.log(`  Mínimo:  ${min}ms`);
    console.log(`  Máximo:  ${max}ms\n`);
  }

  // Análise
  console.log('🔍 Análise:\n');

  if (results.errors === 0 && results.conflicts === 0) {
    console.log('  ✅ API aguenta bem requisições simultâneas!');
    console.log('  ✅ Nenhum erro ou conflito detectado.\n');
  } else if (results.conflicts > 0) {
    console.log('  ⚠️  API detectou conflitos (esperado com race conditions)');
    console.log('  ℹ️  Isso é NORMAL se você tem tratamento de concorrência.\n');
  } else {
    console.log('  ⚠️  API teve erros durante requisições simultâneas!');
    console.log('  ⚠️  Verifique os logs da API para mais detalhes.\n');
  }

  // Limpar registro de teste
  if (!RECORD_ID) {
    console.log('🗑️  Deletando registro de teste...');
    try {
      await makeRequest('DELETE', `/api/v1/data/${ENTITY_SLUG}/${recordId}`);
      console.log('✅ Registro deletado.\n');
    } catch (err) {
      console.log(`⚠️  Não foi possível deletar: ${err.message}\n`);
    }
  }
}

async function testConcurrentCreates() {
  console.log('\n🧪 Teste: Criações Simultâneas\n');

  const results = { success: 0, errors: 0, times: [] };
  const promises = [];

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const startTime = Date.now();
    const promise = makeRequest('POST', `/api/v1/data/${ENTITY_SLUG}`, {
      data: {
        nome: `Teste Concorrência Create ${i + 1}`,
        status: 'novo',
      },
    })
      .then((res) => {
        const duration = Date.now() - startTime;
        results.times.push(duration);

        if (res.status === 201 || res.status === 200) {
          results.success++;
          process.stdout.write(`✅`);
        } else {
          results.errors++;
          process.stdout.write(`❌`);
        }
      })
      .catch(() => {
        results.errors++;
        process.stdout.write(`❌`);
      });

    promises.push(promise);
  }

  await Promise.all(promises);

  console.log('\n\n📊 Resultados:\n');
  console.log(`  ✅ Sucesso: ${results.success}`);
  console.log(`  ❌ Erros:   ${results.errors}\n`);

  if (results.times.length > 0) {
    const avg = results.times.reduce((a, b) => a + b, 0) / results.times.length;
    console.log(`⏱️  Tempo médio: ${avg.toFixed(0)}ms\n`);
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🧪 Teste de Concorrência - CRM Builder API');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // Teste 1: Updates simultâneos no mesmo registro (simula kanban)
    await testConcurrentUpdates();

    // Teste 2: Criações simultâneas
    await testConcurrentCreates();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ Testes concluídos!');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ Erro durante testes:', err);
    process.exit(1);
  }
}

main();
