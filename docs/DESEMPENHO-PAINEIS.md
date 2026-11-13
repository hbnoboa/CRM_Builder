# Desempenho dos painéis

Painéis e tabelas de empresas com tabelas grandes (dezenas de milhares de registros) baixavam
a tabela inteira para o navegador e, no servidor, cada estatística carregava todos os registros
na memória da API. Medido numa cópia de prod (29 mil veículos): 34 MB por abertura, ~10 s, a API
inteira travando por 2–4 s e até 1,3 GB de memória com 3 pessoas abrindo ao mesmo tempo.

## O que mudou

### Fase 0 — tempo real e segurança
- Aviso de registro alterado (chega só com o id): a tela busca só esse registro em vez da
  tabela inteira; números do painel recarregam no máximo uma vez a cada 10 s por tabela.
- Estatísticas e listagem respeitam campos ocultos do cargo (agrupar, filtrar ou ordenar por
  campo oculto responde vazio / ignora a ordenação).
- Teto de memória das APIs no `docker-compose.prod.yml` (prod 3 GB, dev 1,5 GB).

### Fase 1 — estatísticas calculadas no banco
- `apps/api/src/modules/stats/stats-sql.ts`. Quem entra na conta continua sendo o
  `EntityDataQueryService.buildWhere` (empresa, escopo, cargo, filtros); o banco devolve só o
  resultado. Recorte simples (empresa + tabela + não excluído) consulta direto; os demais pela
  lista de ids do `buildWhere`.
- Tempo máximo de 10 s por consulta (`STATS_TIMEOUT_MS`).
- `STATS_SQL`: `on` (padrão) | `shadow` (calcula dos dois jeitos, registra diferenças no log
  `[stats-sql]` e devolve o antigo) | `off` (caminho antigo, em JavaScript).

### Fase 2 — regra única dos números
Navegador (`aggregation-engine.ts`) e servidor calculam do mesmo jeito: vazio não conta,
lista conta item a item, objeto vale pelo rótulo, "Outros" acima do limite, dias e períodos
pelo dia local (a partir da meia-noite), contagem distinta com filtro devolve o filtrado.
Paridade conferida rodando o motor do navegador sobre os mesmos registros (98/98 iguais).

### Fase 3 — tabelas grandes no modo servidor
Acima de `SERVER_MODE_THRESHOLD` (3.000 registros, `packages/shared/src/pagination.ts`), a
página não baixa os registros:
- gráficos e KPIs pedem o resultado ao servidor (fases 1 e 2);
- a tabela pede só a página exibida, com ordenação, busca, filtros da tabela, filtros do
  painel e período aplicados no servidor; contador "1–10 de N (total)" vem do servidor;
- Excel e PDF em lote sem seleção mandam os filtros ("todos os que batem"), não ids;
- kanban mostra os N cartões mais recentes vindos do servidor;
- aviso em tempo real recarrega só a página exibida.

"Carregar tudo" (`all=true`) passou a ter teto de 5.000 linhas (`DASHBOARD_MAX_LIMIT`).

**Diferenças do modo servidor** (tabelas grandes) em relação ao modo navegador:
- a busca usa os campos de busca da tabela (`settings.searchFields`), não todos os textos;
- operadores de filtro que só existem no navegador (ex.: "contém algum", "antes de") não se
  aplicam;
- busca e filtros digitados na tabela filtram só a tabela (no modo navegador também mexiam
  nos gráficos da mesma tabela); filtros do painel (clique em gráfico, filtro da página,
  período) continuam valendo para tudo;
- "selecionar todos" marca a página exibida; sem seleção, Excel/PDF levam todos os filtrados.

### Fase 4 — cache curto
Resultado de cada estatística guardado por 10 s (`STATS_CACHE_TTL_MS`; `0` desliga) por
empresa + usuário + estatística + parâmetros. Gravar numa tabela muda a versão dela
(`bumpStatsVersion`, chamado no aviso "dados alterados") e descarta o guardado. Resultados
acima de 256 KB não são guardados.

**Índices:** não criados. Medido numa cópia de prod (29 mil veículos, filtro navio = Victoria,
4.136 resultados): sem índice a contagem filtrada leva 76–93 ms e a página de 10 linhas 6–10 ms;
com índice de expressão `(tenantId, entityId, data #> '{navio}')` a contagem cai para 25–36 ms.
Tudo já fica bem abaixo de 100 ms e cada índice pesa em toda gravação. Reavaliar com
`pg_stat_statements` quando alguma tabela passar de ~200 mil registros.

## Fase 5 — infraestrutura (a fazer, não executado)

A VM atual (2 vCPU, 12 GB) roda prod (API, web, Postgres, Redis, PowerSync), dev e o ensaio.
Passos sugeridos, em ordem:
1. **Tirar dev e ensaio da VM de prod**: subir uma VM pequena (e2-small/medium) só para dev;
   mover `crm-*-dev` e `crm-postgres-ensaio`; apontar o DNS de `dev.iossystem.com.br` para ela.
2. **Postgres de prod fora da VM da API**: Cloud SQL (Postgres 16) com backup automático e
   réplica de leitura opcional; migrar com `pg_dump`/`pg_restore` numa janela curta; trocar o
   `DATABASE_URL` do `docker-compose.prod.yml`.
3. **Limites de conexão**: `?connection_limit=` no `DATABASE_URL` conforme a CPU da nova VM
   (o padrão do Prisma é núcleos × 2 + 1).
4. **Observabilidade**: `pg_stat_statements` ligado; alerta de memória/CPU da VM e de tempo
   de resposta do `/api/v1/health`.
5. **Só se alguma tabela passar de ~500 mil registros**: pré-agregação (tabela de resumo por
   campo) ou tabela própria para essa entidade.
