#!/bin/bash

# Teste de Concorrência usando curl (versão simples)

API_URL="${API_URL:-http://localhost:3001}"
TOKEN="${AUTH_TOKEN:-}"
ENTITY_SLUG="${ENTITY_SLUG:-leads}"
CONCURRENT="${CONCURRENT:-10}"

if [ -z "$TOKEN" ]; then
  echo "❌ ERRO: AUTH_TOKEN não configurado!"
  echo ""
  echo "Uso:"
  echo "  AUTH_TOKEN=\"seu-token\" ./test-concurrent-curl.sh"
  echo ""
  exit 1
fi

echo "🧪 Teste de Concorrência com curl"
echo "=================================="
echo "API: $API_URL"
echo "Requisições simultâneas: $CONCURRENT"
echo ""

# Criar registro de teste
echo "📝 Criando registro de teste..."
CREATE_RESPONSE=$(curl -s -X POST \
  "$API_URL/api/v1/data/$ENTITY_SLUG" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"data\":{\"nome\":\"Teste Concorrência\",\"status\":\"novo\"}}")

RECORD_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$RECORD_ID" ]; then
  echo "❌ Falha ao criar registro"
  echo "$CREATE_RESPONSE"
  exit 1
fi

echo "✅ Registro criado: $RECORD_ID"
echo ""
echo "🚀 Executando $CONCURRENT updates simultâneos..."
echo ""

# Executar requests em paralelo
start_time=$(date +%s%3N)
for i in $(seq 1 $CONCURRENT); do
  (
    status=$((i % 4))
    case $status in
      0) STATUS_VALUE="novo" ;;
      1) STATUS_VALUE="em-andamento" ;;
      2) STATUS_VALUE="concluido" ;;
      3) STATUS_VALUE="cancelado" ;;
    esac

    response=$(curl -s -w "\n%{http_code}" -X PATCH \
      "$API_URL/api/v1/data/$ENTITY_SLUG/$RECORD_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"data\":{\"status\":\"$STATUS_VALUE\",\"request_num\":$i}}")

    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" = "200" ]; then
      echo -n "✅"
    elif [ "$http_code" = "409" ]; then
      echo -n "⚠️"
    else
      echo -n "❌"
    fi
  ) &
done

wait
end_time=$(date +%s%3N)
duration=$((end_time - start_time))

echo ""
echo ""
echo "📊 Resultados:"
echo "  Tempo total: ${duration}ms"
echo "  Média: $((duration / CONCURRENT))ms por request"
echo ""

# Limpar
echo "🗑️  Deletando registro de teste..."
curl -s -X DELETE \
  "$API_URL/api/v1/data/$ENTITY_SLUG/$RECORD_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "✅ Teste concluído!"
echo ""
