# Execução do roteiro E2E em dev

Registro da rodada de 04/11/2026 de `docs/teste-e2e-completo.md` em `https://dev.iossystem.com.br`.

- **Commit testado:** `19e6f25` (`develop`, PR #28).
- **Como rodou:** testes HTTP e Playwright headless com o Chrome do sistema.
- **Não rodou:** o app no celular. Ver "O que não foi testado".

## Resumo

| Bloco | Arquivo | Testes | Resultado |
|---|---|---|---|
| Visibilidade, isolamento, permissões do console, link público | `e2e/api/*.spec.ts` | 34 | 34 passaram |
| Fluxos por API | `e2e/api/roteiro-flows.spec.ts` | 142 | 140 passaram; 2 falhas esperadas (roteiro errado, já corrigido) |
| Telas do cenário base | `e2e/ui/roteiro.spec.ts` | 15 | 13 passaram; 1 bug do app, 1 seletor errado do teste |
| Fluxos de tela | `e2e/ui/roteiro-flows.spec.ts` | 50 | 44 passaram; 6 falhas esperadas (4 bugs do app, 2 passos do roteiro) |

Alguns testes tiveram defeitos próprios, corrigidos antes das rodadas finais. O seletor de `P-11` foi corrigido, mas o teste ainda não rodou de novo: **`P-11` na tela segue sem confirmação**.

## Bugs encontrados nesta rodada

Todos corrigidos no código depois do commit testado. **A correção só vale em dev depois de novo deploy, e ainda não foi testada.**

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
- **Tela:** `P-11` (sem confirmação), `E-04/2,4,6`, `E-06/1-8,11-13`, `E-11/3-6`, `E-12/1-3`, `E-15/4-6`, `E-17`, `O-07/2` (Cards e Timeline), `O-09/1-7,10`, `O-12/6-8`, `O-13`, `O-14/1-7`, `O-18` e `P-13` na tela, `P-02`, `P-03`, `P-04`, `P-14` e `P-18` na tela, `E-19` com cargo Auditor.
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
- Em `qa-total-r1`: chamados "UI …" resolvidos, mensagens "UI …" no canal Clientes e na conversa Ana–Gil, auditoria e notificações, sessões extras do Gil.
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

Depois do próximo deploy, tire o `test.fail()` dos casos corrigidos em `e2e/ui/roteiro-flows.spec.ts`.
