# Ponte do assistente de IA (só dev)

O assistente "Criar com IA" (`/gestao/entities/new`) chama a API em `/ai-builder/*`, e a API chama um **provedor** escolhido por `AI_BUILDER_PROVIDER`:

| Valor | Uso |
|---|---|
| (vazio) | assistente escondido (padrão, inclusive em produção) |
| `mock` | resposta fixa, sem rede: testes automatizados (`e2e/api/ai-builder.spec.ts`) |
| `claude-cli` | **só dev**: esta ponte roda `claude -p` com o login do Claude Code de quem administra a VM |
| `anthropic` | próxima etapa: API da Anthropic com chave própria (produção) |

A IA recebe só a estrutura (nomes de tabelas e campos), nunca registros. A resposta é validada e corrigida no servidor (`ai-proposal-normalizer.ts`) antes da prévia e de novo ao aplicar.

## Ligar em dev

1. Gere um token e guarde fora do repositório:
   ```bash
   openssl rand -hex 32 > ~/.ai-bridge-token && chmod 600 ~/.ai-bridge-token
   ```
2. Suba a ponte no IP da rede do Docker (não fica exposta para fora da VM):
   ```bash
   AI_BRIDGE_TOKEN=$(cat ~/.ai-bridge-token) AI_BRIDGE_HOST=172.17.0.1 \
     nohup node scripts/ai-bridge/claude-bridge.mts >> ~/ai-bridge.log 2>&1 &
   ```
   Opcionais: `AI_BRIDGE_PORT` (8787), `AI_BRIDGE_MODEL`, `AI_BRIDGE_EFFORT` (low), `CLAUDE_BIN`.
3. No `.env` da pasta do compose (não versionado):
   ```
   AI_BUILDER_PROVIDER_DEV=claude-cli
   AI_BRIDGE_URL_DEV=http://host.docker.internal:8787
   AI_BRIDGE_TOKEN_DEV=<o mesmo token>
   ```
4. Recrie o container: `docker compose -f docker-compose.prod.yml up -d api-dev`.

Conferir: `curl -s http://172.17.0.1:8787/health` → `{"ok":true}`; na tela **Nova tabela** aparece o cartão **Criar com IA**.

Desligar: pare a ponte e apague as três variáveis (o cartão some).

## Custos

Cada mensagem gasta o limite da conta do Claude Code logada na VM (o log da ponte mostra o custo equivalente em dólares). A API limita 15 mensagens por minuto por pessoa.
