# Teste completo — da empresa nova ao chat por equipe no app (dev)

Ambiente: **dev** (`https://dev.iossystem.com.br`). Nada disso toca prod.

## 0. Pré-requisitos

- **App apontando para dev:**
  ```bash
  cd apps/mobile
  flutter run --dart-define=API_URL=https://dev.iossystem.com.br/api/v1
  ```
  O endereço do PowerSync vem da API (`/sync/credentials`). Deve ser `https://dev.iossystem.com.br/sync`.
- **4 e-mails de teste.** Não precisam receber nada: os convites geram um link para copiar.
  - Use aliases, ex.: `seuemail+dono@...`, `+ana`, `+bruno`, `+carla`.

| Pessoa | Papel no teste |
|---|---|
| **Dono** | abre a empresa e configura tudo |
| **Ana** | cria os registros |
| **Bruno** | cargo "Equipe teste", **na mesma equipe** da Ana |
| **Carla** | cargo "Equipe teste", **fora** da equipe |

> Dica: use 2 aparelhos/emuladores (Bruno e Carla), o web para Dono/Ana e janelas anônimas para logar várias pessoas ao mesmo tempo.

---

## 1. Abrir a empresa e configurar (web)

### 1.1 Cadastro da empresa
1. Acesse `https://dev.iossystem.com.br/pt-BR/register`.
2. Preencha **nome**, **empresa** ("QA Equipes <data>"), **e-mail do Dono** e **senha** → criar conta.

✅ Esperado:
- Você cai logado na empresa nova, em **teste (trial)**. O banner do período de teste aparece.
- Os cargos padrão já existem: Administrador, Gerente, Operador, Visualizador.

### 1.2 Tabela de teste
1. *Administração › Tabelas › Nova Tabela*: crie **"Clientes"** com um campo de texto **"Nome"**.
2. Não configure filtro global nem filtro de dados.

### 1.3 Cargo com escopo "Minha equipe"
1. *Administração › Cargos › Novo Cargo* → **"Equipe teste"**.
2. Módulo **Chat** ligado.
3. Tabela **Clientes**: **Ler** ✔ (e Criar, se quiser), escopo **Minha equipe**.
4. Salvar.
5. Confira que o cargo **Operador** (o da Ana) pode **criar** em Clientes e tem o módulo **Chat** ligado.

### 1.4 Convidar as pessoas
Em *Administração › Usuários › Convidar*, convide:

| Pessoa | Cargo |
|---|---|
| Ana | **Operador** |
| Bruno | **Equipe teste** |
| Carla | **Equipe teste** |

Para cada convite:
1. **Copie o link** que aparece no diálogo.
2. Abra o link numa janela anônima.
3. Defina nome e senha e aceite o convite.

✅ Esperado: os três aparecem como ativos em *Usuários*, cada um com o cargo certo.

### 1.5 Equipe
*Administração › Equipes › Nova equipe* → **"Time QA"**, membros: **Ana** e **Bruno** (Carla fica de fora).

✅ Esperado: o badge "Time QA" aparece em Ana e Bruno na lista de usuários.

---

## 2. Registros por equipe (web)

1. Logado como **Ana**, crie o registro **"QA Equipe 1"** na tabela de teste.
2. Logado como **Bruno** (web) → abra a tabela.
3. Logado como **Carla** (web) → abra a tabela.

| Quem | Esperado |
|---|---|
| Bruno | vê "QA Equipe 1" |
| Carla | **não** vê "QA Equipe 1" (só os próprios registros) |

---

## 3. Registros por equipe (app)

1. Faça login no app como **Bruno** e espere a sincronização terminar.
2. Abra a tabela de teste.
3. Repita com **Carla** no outro aparelho.

| Quem | Esperado |
|---|---|
| Bruno | "QA Equipe 1" aparece (também em modo avião, depois de sincronizar) |
| Carla | não aparece |

---

## 4. Chat do registro (o que entrou nesta entrega)

1. **Ana** (web): *Chat* → abra o chat do registro "QA Equipe 1" e mande **"oi equipe"**.
   - Ou pelo app: abra o registro e toque no ícone 💬 **Chat do registro**.
2. **Bruno** (app): aba **Chat**.
   - ✅ O thread **"Chat do registro"** de "QA Equipe 1" aparece na lista, com a mensagem "oi equipe".
3. **Bruno** responde **"recebido"** pelo app.
   - ✅ Ana vê a resposta no web.
4. **Bruno** liga o **modo avião**, fecha e reabre o app.
   - ✅ O thread e as mensagens continuam lá (vêm do SQLite local).
5. **Carla** (app): aba **Chat**.
   - ✅ O thread **não** aparece.
   - ✅ Se ela tentar abrir pelo registro, não consegue, porque o registro nem aparece para ela.

---

## 5. Mudanças ao vivo (sem deslogar)

Faça cada passo e olhe o app do **Bruno** (online). As mudanças devem chegar em poucos segundos.

| Ação (web, admin) | Esperado no app do Bruno |
|---|---|
| Ana manda nova mensagem no thread | mensagem chega |
| *Administração › Equipes*: **remover a Ana** do "Time QA" | registro **e** thread somem |
| *Administração › Equipes*: **adicionar a Ana** de volta | registro e thread voltam (com o histórico) |
| *Administração › Equipes*: **adicionar a Carla** ao "Time QA" | no app da **Carla**, registro e thread aparecem |
| Excluir o chat do registro (web, quem criou/admin) | thread some para Bruno e Carla |

> **Trocar o cargo** de alguém: depois de salvar, faça **logout/login no app** dessa pessoa. O token do PowerSync guarda o cargo e vale por até 1 h.

---

## 6. Regressão rápida (não pode ter quebrado)

- [ ] Usuário com cargo de escopo **Todos** vê todos os registros e threads da tabela (web e app).
- [ ] Usuário com escopo **Próprio** vê só os próprios registros e os threads deles.
- [ ] **DM** entre duas pessoas continua funcionando e só elas veem.
- [ ] Chat de **grupo** da tabela continua visível para quem lê a tabela.
- [ ] Criar/editar registro pelo app sobe e aparece no web.

---

## 7. Se algo não bater

Diagnóstico (só leitura) no servidor:

```bash
# Chaves de equipe do usuario (formato "equipeId:cargoId")
docker exec crm-postgres-dev psql -U postgres -d crm_builder_dev -c \
  "select u.email, k.key from \"TeamAccessKey\" k join \"User\" u on u.id=k.\"userId\" order by 1;"

# Chaves no registro, no thread e nas mensagens (troque o id do registro)
docker exec crm-postgres-dev psql -U postgres -d crm_builder_dev -c \
  "select 'registro', \"_visibleTeamKeysJson\" from \"EntityData\" where id='<ID_DO_REGISTRO>'
   union all select 'thread', \"_visibleTeamKeysJson\" from \"Channel\" where \"recordId\"='<ID_DO_REGISTRO>'
   union all select 'msg', \"_visibleTeamKeysJson\" from \"Message\" m join \"Channel\" c on c.id=m.\"channelId\" where c.\"recordId\"='<ID_DO_REGISTRO>';"

# Logs do PowerSync de dev
docker logs --tail 50 crm-powersync-dev
```

| Sintoma | Causa provável |
|---|---|
| Bruno não tem chave em `TeamAccessKey` | não está na equipe, ou o cargo dele não é o "Equipe teste" |
| Registro sem chave (`[]`) | a Ana não está na equipe, o cargo não está com escopo "Minha equipe" nessa tabela, ou o registro foi criado por outra pessoa |
| Chaves certas no banco, mas não chega no app | app apontando para prod (confira o `API_URL`), ou sync travada: veja `docker logs crm-powersync-dev` |
| Web mostra e o app não | filtro de dados/global na tabela, ou o app ainda não terminou o primeiro sync |

---

## 8. Limpeza

- Apague o registro "QA Equipe 1" (vai para a Lixeira).
- Para descartar tudo: como Dono, *Administração › Dados e privacidade* → encerrar a empresa (os dados são apagados após o prazo de carência).
