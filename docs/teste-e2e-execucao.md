# Execução do roteiro E2E em dev

Registro das rodadas de `docs/teste-e2e-completo.md`. Este arquivo é atualizado a cada etapa.

- **Ambiente:** `https://dev.iossystem.com.br` e, antes de cada PR, o ambiente local em cópia do banco.
- **Como roda:** testes HTTP e Playwright headless com o Chrome do sistema.
- **Não rodou:** o app no celular. Ver "O que não foi testado".

## Situação atual (04/11/2026)

- **Em dev:** PR #29 (`f399d44`) confirmado: 63 de 63 nas telas e 174 de 174 na API.
- **Em andamento:** terceira leva de correções (8 bugs), na branch `fix/e2e-round3`. Passou no teste local e segue para PR, merge e deploy. A confirmação em dev entra aqui quando terminar.
- **Atenção:** existe a conta "QA Claude (temporario)" ativa como dona do console de dev. Não foi criada nestas rodadas nem alterada. Falta decidir se continua ativa.

## Histórico

| Etapa | O que aconteceu |
|---|---|
| PR #28 | Correções da auditoria: segurança, vazamentos, app, roteiro e testes de API. Merge e deploy em dev (`19e6f25`) |
| Rodada 1 em dev | Testes abaixo, em `19e6f25` |
| PR #29 | 5 bugs de tela e throttle. Teste local, depois merge e deploy em dev (`f399d44`) |
| Telas pendentes | 52 testes em `19e6f25`: 8 bugs novos e ajustes no roteiro |
| Confirmação em dev (`f399d44`) | Telas 63 de 63 e API 174 de 174. Inclui `O-06/3`, `O-06/6`, `E-11/2b`, `O-16`, `E-19`, "Não" e `P-11` |
| `fix/e2e-round3` no local | Telas pendentes: 46 de 49 na rodada, e `P-11/3` passou depois de corrigir o hook. `P-18` só falha na cópia local (sem `_prisma_migrations`). `E-15/4-6` falhou no local e fica para conferir em dev |

## Resumo da rodada 1 (`19e6f25`)

| Bloco | Arquivo | Testes | Resultado |
|---|---|---|---|
| Visibilidade, isolamento, permissões do console, link público | `e2e/api/*.spec.ts` | 34 | 34 passaram |
| Fluxos por API | `e2e/api/roteiro-flows.spec.ts` | 142 | 140 passaram; 2 falhas esperadas (roteiro errado, já corrigido) |
| Telas do cenário base | `e2e/ui/roteiro.spec.ts` | 15 | 13 passaram; 1 bug do app, 1 seletor errado do teste |
| Fluxos de tela | `e2e/ui/roteiro-flows.spec.ts` | 50 | 44 passaram; 6 falhas esperadas (4 bugs do app, 2 passos do roteiro) |

Alguns testes tiveram defeitos próprios, corrigidos antes das rodadas finais. O seletor de `P-11` foi corrigido, mas o teste ainda não rodou de novo: **`P-11` na tela segue sem confirmação**.

## Telas pendentes (`19e6f25`)

Arquivo: `e2e/ui/roteiro-pendentes.spec.ts`. A versão final tinha 52 testes, 12 com falha esperada: 9 por bugs do app e 3 por passos errados do roteiro. A última alteração do spec só foi conferida nos 3 testes afetados.

Passaram: `P-02`, `P-03`, `P-04`, `P-11/1,2,4-7`, `P-13`, `P-14`, `P-18`, `E-04/2,4,6`, `E-06/1-5,8,11-13`, `E-11/4-6`, `E-12/1-3`, `E-15/4-5`, `E-17`, `O-07/2`, `O-09/1,4-7`, `O-12/6-8`, `O-13/1-3,5,6`, `O-14/1-7`, `O-18/1-7,9,10`.

| Bug | Onde aparece | Correção (`fix/e2e-round3`) |
|---|---|---|
| Cargo com pessoa excluída continua contando e não pode ser removido | `E-08/19` | Excluir encerra o vínculo; a contagem ignora pessoa excluída |
| Comando criado pela tela nunca abre a captura rápida | `O-13/4` | Abre com `formFields` ou `quickFields` |
| Auditor vê os menus, mas as telas de log dizem "Acesso Restrito" | `E-19` | A tela segue a regra da API: o sub-módulo herda do grupo |
| O resultado da importação some | `O-09/2` | O diálogo continua aberto com as linhas com erro |
| Erro de limite na importação mostra "Request failed…403" | `O-09/10` | Mostra a mensagem da API |
| Troca de senha mostra a mesma mensagem genérica | `P-11/3` | Mostra a mensagem da API |
| Nome de tabela repetido mostra mensagem genérica | `E-06/7` | Mostra a mensagem da API |
| Plural errado: "Clientess" | `O-14/6` | Nome terminado em "s" não ganha outro; a tela mostra o nome da tabela |

Passos do roteiro ajustados: `P-11/3`, `E-06/6`, `E-16`, `E-11/3`, `O-09/3`, `E-15/4`.

Não testados nesta tela: a parte final de `P-11/5`, `O-18/8` (passou por API), `P-14/1` por telefone e o header `X-Webhook-Signature` de `E-15/6`, por falta de receptor.

## Bugs da rodada 1

Corrigidos no PR #29 e confirmados em dev (`f399d44`).

| ID | Problema | Correção |
|---|---|---|
| `O-06/3` | Coluna e campo CPF aparecem vazios para quem não vê o campo | Tabela, seletor de colunas, filtros e formulário escondem o campo |
| `E-11/1` | "Criar e Continuar" abre uma tela em branco, sem idioma e empresa na URL | `useRouter` de `tenant-navigation`; também em 3 componentes com o mesmo padrão |
| `E-19` | A data final da auditoria exclui o próprio dia | Data sem hora vai até 23:59:59 de Brasília, na tela e na exportação |
| `O-06/6` | A lista mostra o valor cru da seleção (`contato`) | A lista mostra o rótulo da opção |
| `O-16` | Trocar o idioma leva a uma tela em branco, sem a empresa | Troca só o idioma na URL atual |
| Extra | Booleano aparece como "Nao" | "Não" |
| Extra | `@Throttle` sem efeito em privacidade e suporte (visto no código, não testado) | Guard aplicado nessas rotas |

## Passos do roteiro corrigidos

| ID | Era | É |
|---|---|---|
| `E-08/16-18`, `P-17` | O limite aparece no aceite do convite | O limite já bloqueia ao convidar, e também no aceite de convite anterior |
| `O-05` | Barra "Filtros (1)" | Com 1 filtro mostra "Filtros"; a contagem aparece com 2 ou mais |
| `O-06/2` | `abc` mostra "Email inválido" | O navegador barra `abc`; `abc@x` mostra "Email inválido" |

## O que foi coberto

- **Por API:** `P-05`, `P-06`, `P-07`, `P-08`, `P-12`, `P-13`, `P-14/3`, `P-15`, `P-16`, `P-17`, `E-05`, `E-07/3`, `E-08/6,8,9,10,13,16-19`, `E-09`, `E-10`, `E-13/3`, `E-14`, `E-15/1-3`, `E-16` (recusa do `run_script`), `E-18`, `O-09/8`, `O-11`, `O-15`, `O-17`, `O-18`, `X-01`, `X-05`, `S-01` a `S-04`, `S-06`, `L-01` a `L-03`, `L-04/1-7`, isolamento entre empresas.
- **Na tela:** `P-01/1-2,6`, `P-06` (menu), `P-10`, `E-01/1`, `E-02`, `E-03`, `E-04/1,3,5`, `E-06/9-10`, `E-07/1,2,7`, `E-08/12`, `E-10/6`, `E-11/1-2`, `E-12/4`, `E-13/1-2`, `E-16`, `E-19`, `E-20`, `O-01` a `O-08`, `O-09/8-9`, `O-10/1-3`, `O-11/1-3,8`, `O-12/1-5,9`, `O-14/8-9`, `O-15/1-3`, `O-16`, `S-03/1`, `X-01`.

## O que não foi testado

- **App:** toda a seção 5 (`M-*`), `X-03`, `S-02/2`, a sessão de app em `S-03/1` e `P-16/3` no app. Exige build novo apontando para dev.
- **Tela:** só restam os casos listados em "Telas pendentes".
- **E-mail:** `S-05`, `P-14/4` e os passos com 📧: dev não tem SMTP.
- **Cron:** `L-04/8`, que apaga a empresa depois do prazo.

## Problemas conhecidos, ainda abertos

- CPF oculto ainda chega ao SQLite do celular (o sync envia `data` inteiro).
- Resultados de `/consulta` e `@bot` ficam visíveis para todo o canal.
- `PATCH /users/me` troca a senha sem pedir a atual; o app guarda a senha em texto puro no Keychain/Keystore.
- Cargo com `roles.*` cria cargo com permissão por tabela maior que a dele.
- O app não tem refresh único de token nem reconecta ao abrir offline.
- As migrations não sobem do zero em banco vazio, o que impede um job de CI para estes testes.

## Contas de teste

Criadas em dev pelo seed. A senha não fica neste documento: `QA_PASSWORD` em `e2e/.env.dev.local`, arquivo local fora do git. A dona do console usa `PLATFORM_EMAIL` e `PLATFORM_PASSWORD` no mesmo arquivo.

| Pessoa | Papel | E-mail |
|---|---|---|
| Paula | Dona do console | `paula.qa@example.com` |
| Sérgio | Suporte | `sergio.r1@example.com` |
| Fábio | Financeiro | `fabio.r1@example.com` |
| Lia | Somente leitura | `lia.r1@example.com` |
| Dora | Dona da QA Total | `dora.r1@example.com` |
| Alex | Administrador | `alex.r1@example.com` |
| Gil | Gerente | `gil.r1@example.com` |
| Ana | Operador, equipe Norte | `ana.r1@example.com` |
| Bruno | Equipe campo, Norte | `bruno.r1@example.com` |
| Carla | Equipe campo, Sul | `carla.r1@example.com` |
| Vera | Visualizador | `vera.r1@example.com` |
| Admin Console | Dono da QA Console | `consoleadmin.r1@example.com` |

Empresas: `qa-total-r1` (plano QA Básico r1) e `qa-console-r1` (plano QA Mínimo r1).

## O que ficou em dev

- Empresas e pessoas "QA API …" de cada rodada, porque não há rota para excluir empresa.
- 20 planos `qa-api-*`, todos inativos.
- Em `qa-total-r1`: chamados "UI …" resolvidos, mensagens "UI …" no canal Clientes e na conversa Ana–Gil, auditoria e notificações, sessões extras do Gil, 161 KB de armazenamento de logos de teste.
- O cargo `UI PEND residuo Publico - Clientes…` e contas excluídas `ui.pend.*`. Depois do deploy da terceira leva, o cargo pode ser removido.
- Equipe de teste do console: Paula, Sérgio, Fábio e Lia continuam ativos. Os staff temporários dos testes foram removidos.

## Como repetir

```bash
# e2e/.env.dev.local precisa de BASE_URL, PLATFORM_EMAIL, PLATFORM_PASSWORD, QA_PASSWORD e SEED_SUFFIX.
# Troque SEED_SUFFIX a cada rodada: slugs e e-mails não são liberados.
set -a; . ./e2e/.env.dev.local; set +a
pnpm test:api
pnpm test:seed
pnpm test:ui-roteiro
```

Para testar no ambiente local, use `e2e/.env.localtest.local` (API `:3101`, web `:3100`) com a cópia `crm_e2e` do banco e um Redis próprio. A cópia veio por `db push`, sem `_prisma_migrations`, por isso `P-06 saude` falha só nela.
