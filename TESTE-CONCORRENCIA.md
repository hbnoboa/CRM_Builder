# 🧪 Testes de Concorrência - CRM Builder API

Este documento explica como testar se a API aguenta requisições simultâneas sem travar.

## 📋 Pré-requisitos

1. **Obter um token de autenticação:**

```bash
# Fazer login e copiar o accessToken
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}' \
  | jq -r '.accessToken'
```

2. **Ter uma entidade para testar** (ex: `leads`, `clientes`, etc.)

---

## 🎯 Opção 1: Script Node.js (Recomendado)

**Mais completo, com estatísticas e análise.**

### Uso Básico:

```bash
# Teste padrão (10 requisições simultâneas, 50 total)
AUTH_TOKEN="seu-token-aqui" \
  node test-concurrent-requests.js
```

### Personalizar:

```bash
# 20 requisições simultâneas, 100 total
AUTH_TOKEN="seu-token" \
ENTITY_SLUG="leads" \
CONCURRENT=20 \
TOTAL=100 \
  node test-concurrent-requests.js
```

### Variáveis de Ambiente:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `AUTH_TOKEN` | *(obrigatório)* | Token JWT de autenticação |
| `API_URL` | `http://localhost:3001` | URL da API |
| `ENTITY_SLUG` | `leads` | Slug da entidade para testar |
| `RECORD_ID` | *(cria novo)* | ID de registro existente (opcional) |
| `CONCURRENT` | `10` | Requisições simultâneas por batch |
| `TOTAL` | `50` | Total de requisições a executar |

### Exemplo de Saída:

```
🧪 Teste: Updates Simultâneos no Mesmo Registro

Configuração:
  - API: http://localhost:3001
  - Entidade: leads
  - Requisições simultâneas: 10
  - Total de requisições: 50

🚀 Iniciando requisições simultâneas...

✅✅✅✅✅✅✅✅✅✅ Batch 1 completo
✅✅✅✅✅✅✅✅✅✅ Batch 2 completo
✅✅✅✅✅✅✅✅✅✅ Batch 3 completo
✅✅✅✅✅✅✅✅✅✅ Batch 4 completo
✅✅✅✅✅✅✅✅✅✅ Batch 5 completo

📊 Resultados:

  ✅ Sucesso:    50
  ⚠️  Conflitos:  0
  ❌ Erros:      0
  📈 Total:      50

⏱️  Tempos de Resposta:

  Média:   145ms
  Mínimo:  87ms
  Máximo:  312ms

🔍 Análise:

  ✅ API aguenta bem requisições simultâneas!
  ✅ Nenhum erro ou conflito detectado.
```

---

## ⚡ Opção 2: Script Curl (Rápido)

**Mais simples, usando apenas curl.**

### Uso:

```bash
# Teste com 10 requisições simultâneas
AUTH_TOKEN="seu-token" ./test-concurrent-curl.sh

# Personalizar quantidade
AUTH_TOKEN="seu-token" CONCURRENT=20 ./test-concurrent-curl.sh
```

### Exemplo de Saída:

```
🧪 Teste de Concorrência com curl
==================================
API: http://localhost:3001
Requisições simultâneas: 10

📝 Criando registro de teste...
✅ Registro criado: cm5abc123xyz

🚀 Executando 10 updates simultâneos...

✅✅✅✅✅✅✅✅✅✅

📊 Resultados:
  Tempo total: 1234ms
  Média: 123ms por request

✅ Teste concluído!
```

---

## 🔥 Opção 3: Apache Bench (Load Testing)

**Para testes de carga mais pesados.**

### Instalar Apache Bench:

```bash
# Ubuntu/Debian
sudo apt-get install apache2-utils

# macOS
brew install httpd
```

### Uso:

```bash
# 100 requests, 10 concurrent
ab -n 100 -c 10 \
  -H "Authorization: Bearer SEU-TOKEN" \
  -H "Content-Type: application/json" \
  -p /tmp/payload.json \
  http://localhost:3001/api/v1/data/leads
```

Onde `/tmp/payload.json`:
```json
{"data":{"nome":"Teste AB","status":"novo"}}
```

---

## 🎭 Opção 4: Teste Manual com Navegadores

**Simular dois usuários reais no kanban.**

### Passo a Passo:

1. **Navegador 1 (Chrome normal):**
   - Faça login como usuário A
   - Abra dashboard com kanban

2. **Navegador 2 (Chrome anônimo ou Firefox):**
   - Faça login como usuário B (ou mesmo usuário)
   - Abra MESMO dashboard com kanban

3. **Teste:**
   - Arraste cards rapidamente em ambos navegadores
   - Verifique se cards "pulam" ou voltam (loop infinito)
   - Verifique sincronização em tempo real

4. **Verificar console do navegador:**
   - Abra DevTools (F12) em ambos navegadores
   - Aba Console → procure por erros ou logs do WebSocket
   - Busque por: `[WebSocket]`, `[BarChartWidget]`, etc.

---

## 📊 O Que Observar

### ✅ Comportamento Esperado (API saudável):

- ✅ Todas requisições retornam **200 OK**
- ✅ Tempo de resposta **< 500ms** na maioria
- ✅ Nenhum erro **500** ou timeout
- ✅ Cards no kanban não "pular" de volta
- ✅ Sincronização entre navegadores funciona
- ✅ Logs da API sem erros de concorrência

### ⚠️ Sinais de Problema:

- ❌ Erros **500 Internal Server Error**
- ❌ Timeouts frequentes
- ❌ Tempo de resposta > 2 segundos
- ❌ Cards "pulando" entre colunas (loop infinito)
- ❌ Logs: `Error: Deadlock detected` ou `ECONNRESET`
- ❌ API trava e para de responder

---

## 🔍 Verificar Logs da API

**Enquanto roda os testes:**

```bash
# Logs do container Docker
docker logs -f crm-api-dev

# Buscar por erros
docker logs crm-api-dev 2>&1 | grep -i "error\|exception\|deadlock"

# Buscar por WebSocket
docker logs crm-api-dev 2>&1 | grep "data-changed"
```

---

## 💡 Dicas

### Para Teste do Kanban Especificamente:

```bash
# 1. Obter ID de um registro real do kanban
curl -X GET "http://localhost:3001/api/v1/data/leads?limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[0].id'

# 2. Testar updates nesse registro
AUTH_TOKEN="$TOKEN" \
RECORD_ID="id-copiado-acima" \
CONCURRENT=20 \
TOTAL=100 \
  node test-concurrent-requests.js
```

### Para Simular Carga Real:

```bash
# Executar testes em loop por 5 minutos
end_time=$(($(date +%s) + 300))
while [ $(date +%s) -lt $end_time ]; do
  AUTH_TOKEN="$TOKEN" node test-concurrent-requests.js
  sleep 5
done
```

---

## 🐛 Troubleshooting

### "❌ API teve erros durante requisições simultâneas"

**Possíveis causas:**
1. **Prisma não está configurado para pool de conexões**
   - Verificar `apps/api/prisma/schema.prisma`
   - Deve ter: `connection_limit = 20` ou mais

2. **PostgreSQL atingiu limite de conexões**
   - Verificar: `SHOW max_connections;` no PostgreSQL
   - Aumentar se necessário

3. **Race condition no código**
   - Verificar se há locks ou transactions onde necessário

### "⚠️ API detectou conflitos"

**Isso pode ser NORMAL** se você tem:
- Validações de versão (optimistic locking)
- Constraints únicos no banco
- Validações de business rules

### "Cards pulando no kanban"

**Se ainda acontecer após o fix:**
1. Verificar logs do backend: `docker logs crm-api-dev | grep "exceto"`
2. Verificar console do navegador: busque por eventos duplicados
3. Verificar se o userId está sendo enviado corretamente

---

## 🎯 Meta de Performance

**Para produção saudável:**

- ✅ **Latência p50:** < 200ms
- ✅ **Latência p95:** < 500ms
- ✅ **Latência p99:** < 1000ms
- ✅ **Taxa de erro:** < 0.1%
- ✅ **Throughput:** > 100 req/s (depende do hardware)

---

**Pronto para testar!** 🚀

Se encontrar problemas, verifique os logs e me envie os detalhes.
