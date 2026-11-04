# 🧪 Padrões de Testes

## Framework: Playwright

Usamos Playwright para testes E2E.

## Estrutura

```
e2e/
├── api/                 # Testes HTTP atuais, sem navegador (projeto "api")
│   ├── helpers.ts       # Monta o cenario pela API
│   ├── visibility.spec.ts
│   ├── platform-permissions.spec.ts
│   ├── tenant-isolation.spec.ts
│   └── public-link.spec.ts
└── *.spec.ts            # Specs antigos: usam contas e rotas que nao existem mais
```

## Comandos

```bash
# Testes de API contra dev (o config recusa o host de producao)
BASE_URL=https://dev.iossystem.com.br \
PLATFORM_EMAIL=... PLATFORM_PASSWORD=... \
pnpm test:api
```

Local: API em `:3101`, web em `:3100` (`CORS_ORIGIN`). Sem `BASE_URL`, os testes usam esses endereços.

O roteiro manual fica em `docs/teste-e2e-completo.md`.

## Boas Práticas

1. **Isolamento**: Cada teste deve ser independente
2. **Setup/Teardown**: Usar `beforeEach`/`afterEach` para estado limpo
3. **Seletores estáveis**: Preferir `data-testid` ou texto visível
4. **Waits explícitos**: Usar `waitForURL`, `waitForSelector`
5. **Assertions claras**: Verificar o que é importante
6. **Dados de teste**: Usar fixtures ou seed do banco
