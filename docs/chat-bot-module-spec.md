# Módulo Chat + Bot — Especificação (v0, draft)

Branch: `feat/chat-bot-module` · Status: desenho aprovado, não implementado.

## 1. Visão

Um módulo de **chat por tabela** com dois trilhos:

- **Trilho A — comandos-formulário (`/avaria`)**: o usuário digita `/comando` no composer; ao dar Enter, o input **vira um formulário inline** (campos vindos de uma entidade). Ao enviar, posta um **card estruturado** visível a todos do canal e (opcional) **cria um registro** na tabela. Determinístico, **sem IA**.
- **Trilho B — bot conversacional (`@bot ...`)**: texto livre interpretado por um LLM (Claude) com **toolbelt fechado**. O bot mapeia o pedido para **exatamente uma ferramenta declarada** ou recusa. Roda `as_user` (dentro da permissão de quem pediu) ou `as_bot` (elevado, opt-in, com trilhos de segurança).

Princípio-chave: o chat é a porta; o valor é um **agente que opera o CRM respeitando (ou escalando de forma controlada) o RBAC**, com **histórico de quem pediu o quê**.

## 2. Conceitos

### Canais
- `group` vinculado a uma **entidade/tabela** (`entityId`): o "time" daquela tabela. Visibilidade amarrada à permissão da entidade (só entra/vê quem tem `canRead`).
- `dm`: 1:1 entre dois usuários do tenant.
- `record thread` (fase 2): canal vinculado a um **registro** (`recordId`) — "discussão deste veículo".

### Mensagens (tipos)
- `text` — mensagem normal.
- `form_submission` — submissão de um comando-formulário (renderiza como card campo→valor).
- `command` — invocação textual de comando ao bot.
- `bot` — resposta/ação do bot.
- `system` — eventos (entrou no canal, etc.).

## 3. O bot é fechado por construção (segurança)

Diferente de um agente interativo (toolbelt amplo + humano aprova em runtime), o **bot do chat**:

1. **Toolbelt fechado e tipado.** Só chama ferramentas declaradas (ex.: `reabrir_veiculo(id)`, `consultar_registros(...)`). Não existe "editar qualquer campo". Pedido sem ferramenta correspondente → **recusa**.
2. **Ferramentas estreitas com intenção** (`reabrir_veiculo`), não genéricas (`update_record`). Cada ferramenta tem **sua própria checagem de permissão**.
3. **Permissão pré-configurada, nunca solicitada.** O bot **não pede permissão em runtime**; ou pode (porque foi configurado) ou nega. Usa **só as permissões dele** (teto do bot), não as minhas/do operador.
4. **Dois "perguntar" distintos**: esclarecer o pedido ("qual veículo?") = permitido; escalar/ganhar permissão = **proibido**.
5. **Contrato de saída rígido**: request → 1 ferramenta declarada com args validados por schema, ou abstém. Uma intenção → uma ação (sem encadear o que não foi pedido).
6. **Confirmação** para escrita elevada/destrutiva + **audit completo** sempre.

### Modos de execução por comando
- `as_user`: roda com as permissões de quem pediu (RBAC + scope + dataFilters aplicam). Conveniência, **não escala**.
- `as_bot`: roda com as permissões do **bot** (teto próprio). Opt-in. Regra: executa se *(comando permite elevação)* E *(requisitante tem direito de pedir)* E *(teto do bot permite)*.

### Teto do bot
Cada tenant tem uma **identidade de bot** + um **cargo/policy de teto** (`CustomRole` dedicado): o máximo que o bot topa fazer. O bot nunca é "deus" — o teto é o limite duro.

## 4. Admin cria os comandos USANDO o próprio sistema (dogfooding) ✅

Os comandos do bot **não são código**: são **registros configuráveis por tenant**, montados no builder existente. O admin compõe, não programa.

- Um **`CommandTemplate`** (comando) é criado/editado pela UI como dado:
  - `slug` (`/avaria`, `reabrir_veiculo`), `description`, `icon`.
  - `targetEntitySlug` — a tabela alvo.
  - **campos**: herdados da entidade (reusa o **form builder**), com opção de subset/ordem/ocultar.
  - **`actionType`** escolhido de um conjunto de **primitivas pré-aprovadas** (não-código):
    - `create_record` (cria na tabela),
    - `update_field` (muda um campo específico — ex.: `concluido: true→false`),
    - `query` (consulta read-only),
    - `run_action_chain` (dispara uma automação já existente — integra com o módulo de **Automações**),
    - `post_only` (só posta o card, sem efeito de dados).
  - `execMode`: `as_user` | `as_bot`.
  - `elevation`: `requesterRoles[]` (quem pode pedir), `requireConfirmation: boolean`.
  - `llm`: `enabled` (Trilho B), `model`, `systemPrompt` (opcional).
- Cada `actionType` tem um **executor fixo no código** com a checagem de permissão embutida. O admin só **liga e parametriza** primitivas seguras → o toolbelt continua fechado, mas **cada tenant escolhe o próprio leque**.

Ou seja: o admin usa Entidades + Form Builder + Automações (que já existem) para **construir os comandos do bot** — o módulo só adiciona o "wrapper de comando" e os executores tipados.

## 5. Provider de LLM plugável (mock-first)

```ts
interface BotLlmProvider {
  decide(input: { message: string; tools: ToolDef[]; context: BotContext }): Promise<ToolCall | Abstain>;
}
```
- `BOT_LLM_PROVIDER=mock` → **MockProvider** determinístico (regra/keyword → ferramenta). Zero rede/custo, repetível em teste. Permite construir e testar TODO o fluxo (permissão, escalação, confirmação, audit) sem gastar crédito.
- `BOT_LLM_PROVIDER=anthropic` → **AnthropicProvider** (Claude Haiku, tool-use). Mesma assinatura.

O resto (toolbelt, teto, confirmação, audit) é idêntico nos dois — o provider só decide *qual* ferramenta.

## 6. Permissões e visibilidade

- Visibilidade do **canal** e dos **comandos disponíveis** = RBAC existente (`canRead`/`canCreate` na entidade alvo). Comando só aparece pra quem pode.
- **Mobile (offline)**: tabela `Message` sincroniza via **PowerSync** com sync rule por **membership do canal** — reaproveita o motor de visibilidade `_visibleToRolesJson` que já construímos.
- **Web (tempo real)**: **Socket.IO** (já no stack) para mensagens ao vivo, presença e "digitando".

## 7. Auditoria

Toda ação do bot grava no `auditService` existente, com campos adicionais:
- `actor = bot`, `requestedById = <usuário>`, `command`, `before → after`, **texto original do pedido**.
- Em escrita de registro: `updatedById = <bot identity>` + meta com `requestedById`.

## 8. Schema Prisma (rascunho)

```prisma
model Channel {
  id           String   @id @default(cuid())
  tenantId     String
  type         String   // 'group' | 'dm' | 'record'
  entityId     String?  // tabela dona (group)
  recordId     String?  // thread de registro (fase 2)
  name         String?
  createdById  String
  createdAt    DateTime @default(now())
  members      ChannelMember[]
  messages     Message[]
  @@index([tenantId, entityId])
}

model ChannelMember {
  id          String   @id @default(cuid())
  channelId   String
  userId      String
  role        String   @default("member") // 'admin' | 'member'
  lastReadAt  DateTime?
  @@unique([channelId, userId])
}

model Message {
  id           String   @id @default(cuid())
  tenantId     String
  channelId    String
  senderId     String?  // null = bot
  type         String   // text | form_submission | command | bot | system
  content      String?
  meta         Json?    // { templateSlug, values, recordId, requestedById, before, after }
  createdAt    DateTime @default(now())
  @@index([channelId, createdAt])
}

model CommandTemplate {
  id               String   @id @default(cuid())
  tenantId         String
  slug             String   // '/avaria', 'reabrir_veiculo'
  description       String?
  targetEntitySlug String?
  fields           Json?    // herda da entidade + subset/ordem
  actionType       String   // create_record | update_field | query | run_action_chain | post_only
  actionConfig     Json     // ex.: { field: 'concluido', value: false } | { actionChainId }
  execMode         String   @default("as_user") // as_user | as_bot
  elevation        Json?    // { requesterRoles: [...], requireConfirmation: true }
  llm              Json?    // { enabled, model, systemPrompt }
  isActive         Boolean  @default(true)
  @@unique([tenantId, slug])
}

model BotIdentity {
  id           String  @id @default(cuid())
  tenantId     String  @unique
  name         String  @default("Assistente")
  customRoleId String  // o "teto" do bot
  isActive     Boolean @default(true)
}
```

## 9. Exemplo de ponta a ponta (JBS — "reabrir veículo")

1. Inspetor (só edita `concluido=false`) digita no grupo da tabela Veículos: **"@bot reabre o veículo GSG0226-1234"**.
2. `MockProvider` (ou Claude) → escolhe a ferramenta `reabrir_veiculo` com `id`.
3. Engine valida: comando é `as_bot` + elevável; Inspetor está em `requesterRoles`; teto do bot permite `update_field concluido` em `concluido=true`.
4. `requireConfirmation` → bot pergunta no canal: *"Confirmar reabrir o veículo X? (sim/não)"*.
5. "sim" → executa via primitiva `update_field` (executor com checagem do teto do bot) → `updatedById = bot`.
6. Posta card no grupo (todos veem) + grava audit: *"Veículo X: concluído true→false — por @bot, a pedido de Fulano (Inspetor), via chat: 'reabre o veículo…'"*.
7. Pedir "apaga o veículo" → **não há ferramenta** `excluir_veiculo` no teto → recusa.

## 10. Plano de construção (fatias testáveis)

1. **Schema + canais**: `Channel`/`ChannelMember`/`Message` + group-por-tabela (visibilidade via `canRead`) + DM. Backend + lista no front.
2. **Trilho A — form-command** (`/avaria` → form inline → `create_record` + card). Sem IA.
3. **Toolbelt + `as_user` read-only** (`query`/`consultar_registros`) com **MockProvider**.
4. **Escalação `as_bot`** (BotIdentity + teto, opt-in, confirmação, audit `requestedById`) — `reabrir_veiculo`. Tudo no mock.
5. **Builder de comandos** no painel (admin cria `CommandTemplate` via sistema).
6. **Trocar mock → Claude (Haiku)** e validar.
7. (Fase 2) Mobile via PowerSync, record threads, aprovação por terceiro, cotas por plano.

## 11. Riscos / decisões

- **Prompt injection**: conteúdo de registros e texto do pedido entram como **dados**, nunca como instrução que altere regras de elevação/teto.
- **Custo**: cota de LLM por tenant (casa com planos SaaS) + modelo por comando (Haiku barato, Opus só p/ difícil).
- **Sem escalonamento em runtime**: bot nunca pede mais permissão; teto fixo pré-configurado.
- **Confirmação obrigatória** para `as_bot` com escrita.
- Decisões fechadas: (b) toolbelt configurável por tenant via primitivas pré-aprovadas; bot com teto próprio; elevação opt-in por comando + lista de requisitantes; confirmação no chat; MVP sem IA (mock-first), Claude na fatia 6.

---

## 12. Captura rápida (quick-capture) — evolução do Trilho A

Em vez de abrir um modal grande, o comando-formulário vira uma **lista de campos inline no próprio chat**, com **input por tipo** e **autocomplete**. Pensado para registro rápido em campo (mobile-first).

### Comportamento por tipo de campo
- **select / radio** → chips clicáveis (toca e escolhe), sem dropdown.
- **boolean** → toggle / dois botões.
- **text / number** → input com **autocomplete** dos valores já usados naquele campo.
- **date/datetime** → atalhos ("hoje"/"ontem") + picker.
- **relation / parent** → autocomplete buscando registros reais.
- **Campos pesados (zone-diagram, image)** → no modo rápido ficam **opcionais e colapsados** atrás de um gatilho ("Peça ▸", "Foto ▸"); só expandem se o usuário quiser.

### Hierarquia (a avaria é de um veículo)
`nao-conformidades` é filha de `veiculos`. O `/avaria` resolve o **pai** antes dos campos da avaria:
1. Campo "Veículo" com **autocomplete** por `chassi` (busca veículos existentes que o usuário pode ver) → escolhe → vira o `parentRecordId`.
2. Opção **"+ novo veículo"** → cria o pai inline com poucos campos; a avaria entra embaixo dele.

### Config no CommandTemplate (`actionConfig`)
```json
{
  "parentEntitySlug": "veiculos",
  "parentSearchField": "chassi",
  "quickFields": ["tipo","nivel","quadrante","medida","local"],
  "heavyFields": ["peca","imagem_longe","imagem_perto"]
}
```

### Backend (novos endpoints, com permissão)
- `GET /chat/search?entitySlug=&q=` → autocomplete de registros do pai (reusa `DataService.findAll` → canRead + filtros/scope).
- `GET /chat/field-suggestions?entitySlug=&field=&q=` → valores distintos já usados (autocomplete de texto).
- `POST /chat/channels/:id/commands/:slug` agora aceita `{ values, parentRecordId?, parent? }` — se `parent` (veículo novo) vier, cria o pai primeiro (mesma checagem de `canCreate`) e usa como `parentRecordId` da avaria.

Decisões fechadas: campos pesados **opcionais/colapsados**; veículo = **autocomplete de existentes + "novo veículo"**; autocomplete de texto = **valores distintos já existentes**.
