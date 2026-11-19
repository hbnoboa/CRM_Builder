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
| `2026-11_dados_pos_baseline.sql` | Dados das 3 migrations absorvidas pelo baseline (destinatário das mensagens do bot, cópia sem campos ocultos para o app e publicação do PowerSync, cartões antigos do chat). Reaplicável. |
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
8b. **Dados das migrations absorvidas pelo baseline**: `psql "$ENSAIO" -v ON_ERROR_STOP=1 -f 2026-11_dados_pos_baseline.sql`.
   Sem isso, cargos com campo oculto sincronizam o app sem nenhum registro (`EntityDataMasked`
   vazia e fora da publicação `powersync`). Conferir: `SELECT count(*) FROM "EntityDataMasked";`
   maior que zero nas empresas com campo oculto.
9. **Migrations**: o alinhamento já levou o schema até a última; marcar **todas** como aplicadas:
   `for m in $(ls prisma/migrations | grep -v toml); do DATABASE_URL="$ENSAIO" npx prisma migrate resolve --applied $m; done`
   e conferir com `npx prisma migrate status` ("Database schema is up to date").
9b. **Ajustes por empresa** (decididos no ensaio; script gerado fora do repositório porque
    cita clientes e senha: `gerar-ajustes.mjs`, só hash da senha no SQL): cargos padrão onde
    não há cargo não-admin, administrador/dono onde não há. Rodar `ajustes.sql` e conferir o
    relatório de cargos e donos.
10. **API e web de `develop`** apontando para o ensaio (porta separada, sem tocar nos
    containers de prod), depois `2026-11_prod_post_deploy.sql`.
10b. **Arquivos privados** (anexos e relatórios do chat, PDFs gerados, arquivamento e auditoria
    saem do endereço público). Com GCS, criar antes um bucket **sem acesso público** e pôr em
    `GCS_PRIVATE_BUCKET`; sem ele, os arquivos vão para o volume `uploads-private` da API.
    Dev tem bucket próprio: `GCS_PRIVATE_BUCKET_DEV=crm-builder-dev-private` no `.env` da VM
    (o compose passa para a API de dev; a de prod lê `GCS_PRIVATE_BUCKET`).
    Simular e depois aplicar, dentro do container da API:
    `node dist/prisma/move-private-files.js` → `node dist/prisma/move-private-files.js --aplicar`.
    O script só mexe nos arquivos das empresas do banco em que roda (dev e prod dividem o
    bucket `crm-builder-bucket`). Conferido um anexo antigo abrindo no chat, rodar de novo com
    `--aplicar --apagar-originais --bucket-so-deste-ambiente`, e só se o bucket público não for
    dividido com outro ambiente: empresas copiadas de prod para dev apontam para os mesmos
    arquivos. Em dev, com o bucket dividido, nunca apagar os originais.
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

## Release de 19/11/2026 (develop → main: #94, #95, #96, #97)

Prod já está no modelo novo (baseline aplicado em 12/11); da develop só falta a migration
`20261203000000_domain_ownership` (uma coluna, `ADD COLUMN IF NOT EXISTS`), que o deploy aplica.
O que pede passo manual: os arquivos que saem do endereço público (#94) e uma pendência
anterior encontrada ao preparar esta release (publicação do PowerSync).

Estado de prod conferido em 19/11 (só leitura):
- 296 PDFs gerados com link público; nenhum anexo nem relatório do chat público.
- Nenhum domínio próprio; nenhum cliente do portal com cargo de acesso total; nenhuma
  automação de e-mail ativa (os limites novos do #94 não atingem ninguém hoje).
- `DOMAIN_REGISTRAR` vazio: compra de domínio desligada (só ligar domínio existente). Fica assim.
- Dados do passo 8b já presentes (cópia sem campos ocultos preenchida, destinatário das
  mensagens do bot, nenhum cartão antigo), **exceto a publicação do PowerSync**: tem 6 das 13
  tabelas do baseline e o `crm-powersync` roda desde 06/05 com as regras daquela época.

### A. Antes do deploy (sem janela)
1. **Bucket privado de prod** (dev já tem o seu, `crm-builder-dev-private`):
   `gcloud storage buckets create gs://crm-builder-prod-private --project=ios-forms-299fb --location=US --uniform-bucket-level-access --public-access-prevention`
   e `gcloud storage buckets add-iam-policy-binding gs://crm-builder-prod-private --member=serviceAccount:35661851099-compute@developer.gserviceaccount.com --role=roles/storage.objectAdmin`.
   Testar gravar/ler/apagar um arquivo com as credenciais da API de prod; acesso anônimo deve dar 403.
2. No `.env` da VM: `GCS_PRIVATE_BUCKET=crm-builder-prod-private` (só a API de prod lê esta
   variável; a de dev lê `GCS_PRIVATE_BUCKET_DEV`). O código atual de prod ignora a variável:
   passa a valer no deploy.
3. **Backup** do banco de prod (`pg_dump -Fc`) logo antes do deploy.

### B. Deploy
4. PR `develop` → `main`, merge, deploy de prod. Conferir: saúde da API, log sem erro,
   `domain_ownership` aplicada, `docker exec crm-api-prod printenv GCS_PRIVATE_BUCKET`.
5. Teste rápido: gerar um PDF (o histórico grava `private:<chave>` e o download sai pela
   API); um PDF antigo continua abrindo pelo link antigo (o código novo aceita os dois).

### C. Arquivos antigos (depois do deploy, sem pressa)
6. Simular: `docker exec crm-api-prod node dist/prisma/move-private-files.js`. Esperado:
   destino `bucket crm-builder-prod-private`, ~296 PDFs mais as pastas de arquivamento e
   auditoria das empresas de prod, `faltando: 0`.
7. Aplicar: `... move-private-files.js --aplicar`. Conferir que nenhum `PdfGeneration.fileUrl`
   ficou sem `private:` e abrir um PDF antigo pela tela.
8. **Não** rodar `--apagar-originais`: o bucket público `crm-builder-bucket` é dividido com
   dev e 4 empresas existem nos dois bancos (mesmos arquivos). O script recusa sem
   `--bucket-so-deste-ambiente`. Apagar os originais só depois de separar os buckets.

### D. PowerSync (pendência anterior, com aviso aos usuários do app)
9. Publicação: `psql ... -v ON_ERROR_STOP=1 -f apps/api/prisma/data-migration/2026-11_powersync_publicacao.sql`
   (acrescenta `Channel`, `ChannelMember`, `CommandTemplate`, `EntityDataMasked`,
   `EntityFieldRule`, `Message`, `TeamAccessKey`; reaplicável; testado no ensaio).
10. Reiniciar `crm-powersync` fora do horário de uso, para ler a publicação e as regras atuais
    (`apps/mobile/powersync.yaml`). O app re-sincroniza. Conferir o log do PowerSync e o login
    e a sincronização de um usuário de teste (inclusive de um cargo com campo oculto).

### Volta
- Antes do passo 7: deploy da `main` anterior (`b16409aa`); nada a desfazer no banco.
- Depois do passo 7: o código antigo não entende `private:<chave>`. Voltar o código exige
  restaurar o backup do passo 3 (perde o que foi gravado depois) ou reescrever os
  `PdfGeneration.fileUrl` para o link público (os originais continuam no bucket).
- Passo 9: `ALTER PUBLICATION powersync DROP TABLE ...` das tabelas acrescentadas.
