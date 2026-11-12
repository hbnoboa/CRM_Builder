# Rollout de produção (develop → main): ensaio primeiro

Produção ainda roda o modelo antigo de usuários e cargos (`User.tenantId`,
`User.customRoleId`, `CustomRole.roleType`) e as migrations antigas. O código de
`develop` (PRs #31–#70) usa acesso por empresa (`UserTenantAccess`), nível de cargo,
dono da empresa e o baseline de migrations. Por isso o deploy precisa de migração de
**dados**, não só de schema, e é feito primeiro num **ensaio** com uma cópia de prod.

Scripts em `apps/api/prisma/data-migration/` (todos sem `DELETE`/`DROP TABLE` de dados):

| Arquivo | O que faz |
|---|---|
| `2026-11_prod_checks.sql` | Só leitura. Mostra o que vai mudar em cada empresa (usuários sem acesso, cargos antigos, duplicatas, automações, webhooks, painéis, valores padrão). |
| `2026-07_redesign_rollout.sql` | Etapas **A** (colunas e tabelas novas), **B** (acessos por empresa, nível, acesso total dos admins) e **C** (remove colunas antigas, cria únicos globais). |
| `2026-11_prod_backfill.sql` | O que o rollout não cobre: coringa `'*'` nos cargos antigos, escopos inválidos, dono da empresa, cargo padrão. Termina em `ROLLBACK`. |
| `2026-11_funcoes_baseline.sql` | Funções e triggers do modelo novo (o `migrate diff` não compara isso). Gerado por `gerar-funcoes-baseline.py`. Reaplicável. |
| `2026-11_prod_post_deploy.sql` | Põe todas as tabelas na fila de recálculo de visibilidade do app. |

## Ensaio (cópia de prod, sem tocar na produção)

1. **Backup de prod** (`pg_dump -Fc`) e restauração num banco separado (`crm_ensaio`).
2. **Neutralizar saídas da cópia** (o ensaio não pode avisar ninguém):
   `UPDATE "Webhook" SET status = 'INACTIVE';` e subir a API do ensaio **sem** SMTP,
   sem push e sem chaves de pagamento.
3. **Checagem**: `psql "$ENSAIO" -f 2026-11_prod_checks.sql > checagem.txt`. Duplicatas de
   e-mail/CPF/telefone (seção A8) precisam ser resolvidas antes da etapa C (decidir caso a caso).
4. **Rollout A + B** (até antes da etapa C):
   `sed -n '1,/^-- ================= C)/p' 2026-07_redesign_rollout.sql | psql "$ENSAIO" -v ON_ERROR_STOP=1`
5. **Complemento**: rodar `2026-11_prod_backfill.sql`, conferir os relatórios e as
   contagens; trocar `ROLLBACK` por `COMMIT` e rodar de novo.
6. **Rollout C**: `sed -n '/^-- ================= C)/,$p' 2026-07_redesign_rollout.sql | psql "$ENSAIO" -v ON_ERROR_STOP=1`
7. **Alinhar tabelas ao baseline** (banco auxiliar `shadow` **vazio a cada rodada**):
   `npx prisma migrate diff --from-url "$ENSAIO" --to-migrations prisma/migrations --shadow-database-url "$SHADOW" --script > alinhar.sql`
   Revisar linha a linha antes de aplicar. Tirar os índices `uq_ed_*` (são do dev) e
   **qualquer `DROP` de tabela com dados** (prod pode ter tabelas avulsas de manutenção:
   ficam). Depois de aplicar, o diff deve mostrar só esses `DROP` mantidos de propósito.
8. **Funções e triggers**: `psql "$ENSAIO" -v ON_ERROR_STOP=1 -f 2026-11_funcoes_baseline.sql`
   (cria as extensões `pg_trgm`/`unaccent`, remove triggers antigos e deixa exatamente os do
   baseline). Em seguida, as funções da migration do portal (o baseline traz a versão anterior):
   `sed -n '/^CREATE OR REPLACE FUNCTION/,$p' prisma/migrations/20261129000000_client_portal/migration.sql | psql "$ENSAIO" -v ON_ERROR_STOP=1`
9. **Migrations**: o alinhamento já levou o schema até a última; marcar **todas** como aplicadas:
   `for m in $(ls prisma/migrations | grep -v toml); do DATABASE_URL="$ENSAIO" npx prisma migrate resolve --applied $m; done`
   e conferir com `npx prisma migrate status` ("Database schema is up to date").
9b. **Ajustes por empresa** (decididos no ensaio; script gerado fora do repositório porque
    cita clientes e senha: `gerar-ajustes.mjs`, só hash da senha no SQL): cargos padrão onde
    não há cargo não-admin, administrador/dono onde não há. Rodar `ajustes.sql` e conferir o
    relatório de cargos e donos.
10. **API e web de `develop`** apontando para o ensaio (porta separada, sem tocar nos
    containers de prod), depois `2026-11_prod_post_deploy.sql`.
11. **Validação** (ver abaixo). Anotar o tempo de cada etapa: é a janela de manutenção.
12. Problema → corrigir os scripts e repetir do passo 1.

### Validação no ensaio
- Em cada empresa ativa: entrar com um usuário de cada cargo; ver as mesmas tabelas e a
  mesma quantidade de registros que em prod (comparar com contagens tiradas do backup).
- Painéis abrem e mostram os mesmos números; relatórios e PDFs saem iguais.
- Gerente/Usuário/Visualizador antigos: mesmas tabelas que viam antes.
- Dono de cada empresa definido; admins conseguem gerenciar a equipe.
- Automações e webhooks: lista do que muda (seção B da checagem) revisada com o cliente.
- App de celular: login e sincronização de um usuário de teste.

### O que observar (aprendido no primeiro ensaio)
- Empresa sem nenhum administrador fica sem dono: definir pelo console depois.
- Empresa só com cargos de administrador fica sem cargo padrão: decidir antes da produção.
- Cargos sem `templates.canGenerate` não geram PDF — igual ao comportamento antigo.
- App de celular (PowerSync) e envio de e-mail não são cobertos pelo ensaio local.
- Console da plataforma em prod: criar o dono (`prisma/create-platform-owner.ts`).

## Produção (depois do ensaio limpo)
Mesma sequência, com janela de manutenção avisada: backup imediatamente antes, passos
3 a 9 no banco de prod, merge `develop` → `main`, deploy de prod (o `migrate deploy` do
deploy não terá nada pendente), passo 10 e validação rápida. Plano de volta: restaurar o
backup do passo 1 e fazer deploy da `main` anterior.
