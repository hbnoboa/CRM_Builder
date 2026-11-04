# Teste E2E completo — CRM Builder (dev)

Roteiro manual de ponta a ponta de **tudo o que o sistema faz hoje**, do cadastro da empresa ao app offline.
Ele é organizado pelos **3 tipos de usuário** do produto:

| Camada | Quem é | Onde trabalha |
|---|---|---|
| **Plataforma** | equipe interna (Dono, Suporte, Financeiro, Somente leitura) | Console `/{locale}/admin` |
| **Administração da empresa** | dono e administradores do cliente | Área "Administração" (`/{locale}/{empresa}/gestao`) |
| **Operação** | todo mundo da empresa, conforme o cargo | Web operacional (`/{locale}/{empresa}/...`) **e** app celular |

- Ambiente: **dev** — `https://dev.iossystem.com.br`. Nada aqui toca prod.
- Tempo estimado: 1 dia inteiro para tudo. As partes dependem umas das outras: siga a ordem ou monte o cenário antes (seção 13).
- Teste rápido: use a trilha de smoke da seção 13.
- Convenções:
  - ✅ = resultado esperado.
  - 🔧 = ponto que era bug e **foi corrigido** (PR das correções E2E). Se falhar, é regressão: reporte com o ID.
  - 📧 = depende de e-mail (SMTP). Em dev **não há SMTP configurado**: pule ou use o link copiável quando existir.
  - IDs (`P-03`, `E-12`, `O-18`, `M-07`) servem para reportar o que falhou; passo dentro do bloco: `E-08/14`.
  - **Resultado:** registre cada ID numa planilha com ID, resultado, commit, data, evidência e bug. As tabelas não têm coluna própria.
  - **Repetição:** slugs, e-mails e domínio não são liberados. Em cada rodada use um sufixo (`qa-total-02`, `voce+dora02@…`).
- Mensagens de erro da API aparecem **sem acento** ("Credenciais invalidas"): isso é o texto atual, não é erro do teste.

---

## Índice

0. [Preparação](#0-preparação)
1. [Plataforma I — console, equipe e planos](#1-plataforma-i--console-equipe-e-planos)
2. [Cadastro self-service da empresa](#2-cadastro-self-service-da-empresa)
3. [Administração da empresa](#3-administração-da-empresa)
4. [Operação no web](#4-operação-no-web)
5. [Operação no app (celular)](#5-operação-no-app-celular)
6. [Escopos de visibilidade (todos × equipe × próprios)](#6-escopos-de-visibilidade-todos--equipe--próprios)
7. [Plataforma II — suporte, comunicados, pessoas, massa, situação](#7-plataforma-ii--suporte-comunicados-pessoas-massa-situação)
8. [Segurança da conta e sessões](#8-segurança-da-conta-e-sessões)
9. [LGPD — exportar e encerrar](#9-lgpd--exportar-e-encerrar)
10. [Matriz final por perfil](#10-matriz-final-por-perfil)
11. [Correções feitas (testar como regressão)](#11-correções-feitas-testar-como-regressão)
12. [Diagnóstico e limpeza](#12-diagnóstico-e-limpeza)
13. [Smoke e testes automatizados](#13-smoke-e-testes-automatizados)

---

## 0. Preparação

### 0.1 Ferramentas
- Navegador com **janelas anônimas / perfis separados** (vai ter muita gente logada ao mesmo tempo).
- **2 celulares ou emuladores** com o app apontando para dev:
  ```bash
  cd apps/mobile
  flutter run \
    --dart-define=API_URL=https://dev.iossystem.com.br/api/v1 \
    --dart-define=POWERSYNC_URL=https://dev.iossystem.com.br/sync
  ```
  Sem o `POWERSYNC_URL`, o app usa o padrão de **produção** como reserva.
- App autenticador (Google Authenticator, Authy…) para as duas etapas.
- Planilha `.xlsx` com colunas `Nome`, `Email`, `Telefone`: uma com 5 linhas, sendo 1 com e-mail inválido, e outra com 70 linhas e e-mails únicos (`O-08` e `O-09/10`).
- Uma imagem `.jpg`/`.png` pequena (logo e fotos).

### 0.2 Pessoas de teste
Use aliases do seu e-mail (`voce+dora@dominio`, etc.). Anote as senhas. Senha padrão sugerida: `Teste@2026qa` (12 caracteres, passa na política da E-05).

| Apelido | Camada | Papel | Como nasce |
|---|---|---|---|
| **Paula** | Plataforma | Dono do console | já existe em dev; sem acesso, crie com `apps/api/prisma/create-platform-owner.ts` |
| **Sérgio** | Plataforma | Suporte | Paula cria (P-05) |
| **Fábio** | Plataforma | Financeiro | Paula cria (P-05) |
| **Lia** | Plataforma | Somente leitura | Paula cria (P-05) |
| **Dora** | Administração | **Dono** da empresa "QA Total" | cadastro (`/register`) |
| **Alex** | Administração | Administrador (não é dono) | convite |
| **Gil** | Administração | Gerente | convite |
| **Ana** | Operação | Operador (escopo "só meus") | convite |
| **Bruno** | Operação | cargo "Equipe campo" (escopo "Minha equipe"), equipe **Norte** | convite |
| **Carla** | Operação | cargo "Equipe campo", equipe **Sul** | convite |
| **Vera** | Operação | Visualizador (só leitura, todos) | convite |

### 0.3 Antes de começar
- [ ] `https://dev.iossystem.com.br/health` responde 200.
- [ ] Console → *Saúde do sistema*: anotar o que está "Atenção". Esperado em dev: **E-mail = Atenção** ("Sem provedor de e-mail…"). PowerSync deve estar OK.

---

## 1. Plataforma I — console, equipe e planos

> Persona: **Paula** (Dono do console). URL: `https://dev.iossystem.com.br/pt-BR/admin/login`

### P-01 Login do console
| # | Ação | Esperado |
|---|---|---|
| 1 | Abrir `/pt-BR/admin/login` | ✅ "Console da plataforma" / "Acesso restrito à equipe" |
| 2 | Senha errada | ✅ "Credenciais invalidas" |
| 3 | E-mail que não existe | ✅ **mesma** mensagem e tempo parecido (não revela quem é da equipe) |
| 4 | Espere 1 min. 6 tentativas erradas seguidas com o **mesmo e-mail** | ✅ "Muitas tentativas. Aguarde um minuto e tente novamente." (o limite é por IP + e-mail) |
| 4b | 🔧 Via API: repetir o login com um `refreshToken` aleatório no corpo | ✅ o limite continua valendo (429 na 6ª) |
| 5 | Após 1 min, login correto | ✅ entra em "Visão geral"; cabeçalho com nome + papel "Dono" |
| 6 | Menu lateral | ✅ Visão geral, Métricas, Pessoas, Clientes, Planos, Equipe, Chamados, Comunicados, Saúde do sistema, Auditoria |

### P-02 Isolamento de sessão console × empresa
- [ ] Depois da E-01: no **mesmo navegador**, abra outra aba e faça login numa empresa (`/pt-BR/login`).
- ✅ As duas sessões convivem (o console usa token próprio). Sair de uma não derruba a outra.

### P-03 Trocar a própria senha (console)
| # | Ação | Esperado |
|---|---|---|
| 1 | Ícone de chave → "Trocar senha", senha atual errada | ✅ "Senha atual incorreta" |
| 2 | Nova senha com 9 caracteres | ✅ o navegador barra no campo (mínimo de 10) |
| 3 | Nova senha só minúsculas e 12 caracteres | ✅ toast "Erro de validacao" |
| 4 | Senha válida | ✅ toast "Senha alterada"; Auditoria registra "trocou a própria senha" |

### P-04 Visão geral
- [ ] 4 números: Clientes, Ativo, Em teste, Usuários ativos.
- [ ] Faixa das situações: clicar em "Em teste" → abre `/admin/tenants?lifecycle=TRIAL` já filtrado.
- [ ] Quadros "Testes terminando nos próximos 7 dias" e "Novos clientes (30 dias)" (vazio = "Nada por aqui.").

### P-05 Equipe do console (só Dono)
| # | Ação | Esperado |
|---|---|---|
| 1 | *Equipe* → "Adicionar pessoa": Sérgio, cargo **Suporte**, senha de 10+ | ✅ "Pessoa adicionada" |
| 2 | Repetir para Fábio (**Financeiro**) e Lia (**Somente leitura**) | ✅ 3 novas linhas |
| 3 | Adicionar de novo o e-mail do Sérgio | ✅ "Email ja cadastrado na equipe" |
| 4 | Na própria linha (Paula) | ✅ sem botões de ação, mostra "(você)" |
| 5 | Mudar o cargo da Lia para Suporte e voltar para Somente leitura | ✅ muda na hora, toast "Equipe atualizada" |
| 6 | "Nova senha" para o Fábio | ✅ "Senha redefinida" |
| 7 | "Desativar" Lia → logar como Lia em outra janela | ✅ "Credenciais invalidas"; "Ativar" de novo → login ok |
| 8 | Com Lia logada, Paula **desativa** Lia | ✅ na próxima ação da Lia: volta ao login, sem mensagem |
| 9 | Reativar a Lia | ✅ volta a entrar |

### P-06 Permissões de cada papel do console
> Faça depois da P-08 e, para "Responder chamado", depois da O-15.

Logue como cada um (janelas separadas) e confira. A mesma matriz é testada direto na API na seção 13:

| Item | Paula (Dono) | Sérgio (Suporte) | Fábio (Financeiro) | Lia (Leitura) |
|---|---|---|---|---|
| Menu "Métricas" | ✅ | ❌ (abrir a URL: "Não foi possível carregar as métricas…") | ✅ | ✅ |
| Menu "Equipe" | ✅ | ❌ | ❌ | ❌ |
| "Novo cliente" | ✅ | ✅ | ❌ | ❌ |
| Mudar situação / plano do cliente | ✅ | ❌ (seletor desabilitado) | ✅ | ❌ |
| Funções por cliente (switches) | ✅ | ✅ | ❌ | ❌ |
| "Entrar como" | ✅ | ✅ | ❌ | ❌ |
| Checkboxes de massa na lista | ✅ | ❌ | ✅ | ❌ |
| Novo/editar plano | ✅ | ❌ | ✅ | ❌ |
| Responder chamado | ✅ | ✅ | ✅ | ❌ |
| Criar/publicar comunicado | ✅ | ✅ | ❌ | ❌ |
| Pessoas: link de senha / desconectar / desligar 2 etapas | ✅ | ✅ | ❌ | ❌ |
| Saúde do sistema, Auditoria | ✅ | ✅ | ✅ | ✅ |

### P-07 Planos
| # | Ação | Esperado |
|---|---|---|
| 1 | *Planos* → "Novo plano": **"QA Básico"**, slug `qa-basico`, Usuários **8**, Registros **60**, Armazenamento **50**, funções: Chat ✔, PDF ✔, Automações ✔, Webhooks ✔, Links públicos ✔, App mobile ✔, **Ativo** ✔, **não** padrão | ✅ "Plano salvo"; cartão com limites e selos das funções |
| 2 | Criar outro com o mesmo slug | ✅ "Ja existe um plano com esse slug" |
| 3 | Criar **"QA Mínimo"** (`qa-minimo`): Usuários 2, Registros 5, Chat ❌, PDF ❌, Links públicos ❌, App mobile ✔ | ✅ funções desligadas aparecem riscadas |
| 4 | Editar "QA Básico": slug fica desabilitado | ✅ |
| 5 | **Não** marque nenhum como "Padrão do cadastro" (para não afetar outros cadastros de dev) | — |

### P-08 Criar cliente pelo console (fluxo assistido)
| # | Ação | Esperado |
|---|---|---|
| 1 | *Clientes* → "Novo cliente": "QA Console", slug automático, plano "QA Mínimo", situação **Em teste**, admin com e-mail `voce+consoleadmin@…` | ✅ "Cliente criado", abre o detalhe |
| 2 | Tentar slug `admin`, com e-mail de admin novo | ✅ "Slug reservado: admin" |
| 3 | Repetir o slug "qa-console", com e-mail de admin novo | ✅ "Slug já está em uso" |
| 4 | E-mail do admin já usado | ✅ "Email do administrador ja esta em uso" |
| 5 | Detalhe: cartão "Cargos" | ✅ Administrador, Gerente, Operador ("Padrão"), Visualizador |
| 6 | Cartão "Usuários" | ✅ o admin com selo "Dono" |

> "QA Console" é usado mais tarde para massa, suspensão e limites (seção 7).

---

## 2. Cadastro self-service da empresa

> Persona: **Dora** (vai virar dona). Janela anônima.

### E-01 Cadastro
| # | Ação | Esperado |
|---|---|---|
| 1 | `https://dev.iossystem.com.br/pt-BR/register` | ✅ 🔧 "Crie sua empresa e teste grátis por N dias" (N = `SIGNUP_TRIAL_DAYS` do servidor, padrão 14) |
| 2 | Enviar vazio | ✅ "Nome deve ter pelo menos 2 caracteres", "Empresa é obrigatória", "Email é obrigatório", "Senha deve ter pelo menos 8 caracteres" |
| 3 | Senha `abcdefgh` | ✅ (API) "Senha deve conter pelo menos uma letra maiuscula, uma minuscula e um numero" |
| 4 | E-mail já usado (ex.: o da Paula do console **não** conta; use o do admin da QA Console) | ✅ "Email ja esta em uso" |
| 5 | Dados válidos: Dora, empresa **"QA Total"** | ✅ entra logada em `/pt-BR/qa-total/home` |
| 6 | Faixa no topo | ✅ "Faltam 14 dias do seu período de teste." com link "Ver plano" |
| 7 | Console (Paula) → Clientes | ✅ "QA Total" em **Em teste**, plano = padrão do cadastro (ou "Sem plano") |
| 8 | Console → Métricas | ✅ "Novos cadastros (30 dias)" subiu e conta **"pelo site"** |

### E-02 Pós-cadastro
- [ ] Console (Paula) → detalhe "QA Total" → **Plano** = "QA Básico" → "Trocar plano" ✅ "Plano atualizado".
- [ ] Dora: *Administração › Plano* (pode levar até 30 s): limites 8 usuários / 60 registros / 50 MB.
- [ ] 🔧 Tela de login (`/pt-BR/login`): link "Não tem uma conta? Criar conta" leva para o cadastro.

---

## 3. Administração da empresa

> Persona principal: **Dora** (dono). Entre em *Administração* pelo menu (botão escuro "Administração").

### E-03 Painel da administração
- [ ] Título "Olá, Dora" e "Administração da QA Total…".
- [ ] Medidores Usuários / Registros / Armazenamento / Tabelas.
- [ ] "Precisa de atenção": aparece "O período de teste…" (trial).
- [ ] "Primeiros passos": "Crie sua primeira tabela", etc. com contador "0 de N concluídos".
- [ ] Botão "Voltar para a operação" volta para a área operacional.

### E-04 Organização
| # | Ação | Esperado |
|---|---|---|
| 1 | *Organização* → nome "Q" | ✅ salvar desabilitado (mín. 2) |
| 2 | Enviar logo (PNG) | ✅ prévia; conta no armazenamento do plano |
| 3 | Cor da marca `#12ab34`, depois `12ab` | ✅ com cor inválida: "Use uma cor no formato #RRGGBB." |
| 4 | Tema padrão "Escuro" → Salvar | ✅ "Organização atualizada"; nome/cor na lateral mudam na hora |
| 5 | Bloco "Endereço" | ✅ só leitura: slug e "Domínio próprio: Nenhum" |
| 6 | Voltar a cor padrão e tema "Seguir o sistema" | — |

### E-05 Política de segurança da empresa
| # | Ação | Esperado |
|---|---|---|
| 1 | *Segurança* → "Tamanho mínimo da senha" = 10, "Exigir símbolo" ✔ → "Salvar regras" | ✅ "Regras de acesso salvas" |
| 2 | Ligar "Exigir verificação em duas etapas" **sem** a Dora ter 2 etapas | ✅ "Ative a verificacao em duas etapas na sua conta antes de exigir da equipe" |
| 3 | Deixe a exigência de 2 etapas **desligada** por enquanto (testada na seção 8) | — |

### E-06 Tabelas (estrutura)
> O editor só funciona em tela de computador (no celular: "Edite no computador").

| # | Ação | Esperado |
|---|---|---|
| 1 | *Tabelas* → "Nova tabela", template **Contato** (CRM), nome **"Clientes"**, categoria "CRM" → "Criar Tabela" | ✅ "Tabela criada!", abre o editor |
| 2 | No editor, "+ Campo": adicionar **Imagem** ("Foto"), **Seleção única** ("Status": Novo/Em contato/Fechado), **Sim/Não** ("VIP"), **CPF** | ✅ campos no canvas, arrastar reordena |
| 3 | Marcar "Nome" como **Obrigatório** e "Email" como **Único** → "Salvar" | ✅ salvo |
| 4 | Criar tabela **"Visitas"** do zero com campos Data, Texto ("Resumo") | ✅ |
| 5 | Em "Clientes", adicionar campo **Sub-entidade** apontando para `visitas` | ✅ Visitas vira sub-tabela de Clientes |
| 6 | Criar tabela pelo template **Ordem de Servico** ("Operações") | ✅ tabela + automações do template |
| 7 | Mesmo nome de tabela de novo | ✅ "Entidade com este slug ja existe" |
| 8 | Lista *Tabelas* | ✅ cartões "N campos · N registros · categoria" |
| 9 | Abrir o editor no celular (largura pequena) | ✅ "Edite no computador" |
| 10 | 🔧 Abas do editor: **Campos**, **Regras de campo**, **Filtro global**, **Automações**, **Excluir** | ✅ todas aparecem; trocar de aba não perde campos não salvos |
| 11 | 🔧 *Filtro global* em Clientes: "VIP Igual a Não" → "Salvar filtro" | ✅ "Filtro global salvo"; **ninguém** (nem a Dora) vê clientes VIP na lista, no dashboard e no app; remover o chip e salvar volta tudo |
| 12 | 🔧 *Regras de campo*: regra "obrigatório" em Email | ✅ o formulário do **app** passa a exigir Email; no web a regra ainda não é aplicada |
| 13 | 🔧 Criar tabela "Lixo" → editor → aba *Excluir* → digitar o nome → "Excluir tabela" | ✅ botão só habilita com o nome certo; volta para *Tabelas* sem "Lixo" |

### E-07 Cargos
| # | Ação | Esperado |
|---|---|---|
| 1 | *Cargos* | ✅ Administrador (10), Gerente (30), Operador (50, "Padrão"), Visualizador (70); dica "A ordem define quem gerencia quem…" |
| 2 | "Novo Cargo" **"Equipe campo"**: aba *Módulos* → Dashboard Ler, Chat (padrão); aba *Permissões por Tabela* → Clientes e Visitas: Ler ✔ Criar ✔ Editar ✔, **Escopo = Minha equipe** | ✅ "Cargo criado com sucesso" |
| 3 | Nome repetido "Gerente" | ✅ "Já existe uma role com este nome" |
| 4 | "Novo Cargo" **"Auditor"**: só *Auditoria* (logs Ler) e Clientes Ler | ✅ criado (usado na E-19) |
| 5 | Abrir **Operador** e salvar **sem mudar nada** | ✅ continua Ler/Criar/Editar com escopo **Apenas meus** (regressão do coringa `*`) |
| 6 | No Operador, aba *Permissões por Tabela* → Clientes → **Filtros de Dados**: campo "VIP" Igual a "Não" → Adicionar → Salvar | ✅ Operador **não verá** clientes VIP (testado em O-06/5) |
| 7 | 🔧 Em Clientes no Operador: **Permissões por Campo** → um clique em "Ver" do CPF | ✅ desmarca na hora e Editar desliga junto; só o CPF some para o Operador, os demais campos seguem visíveis e editáveis |
| 8 | Setas "Subir/Descer" em Visualizador e Operador | ✅ reordena ranks abaixo do seu |
| 9 | "Acesso total ao tenant" num cargo de teste e desmarcar um módulo | ✅ desliga o modo automático |
| 11 | 🔧 Módulo **Chaves de API** no formulário (Ver / Criar / Excluir) | ✅ aparece; um cargo com "Ver" e "Criar" em Chaves de API consegue criar chave em *Integrações* |

### E-08 Convites e usuários
| # | Ação | Esperado |
|---|---|---|
| 1 | *Usuários* → "Convidar": Alex → **Administrador** | ✅ "O e-mail não está configurado: copie o link…" + campo com link + "Copiar link" |
| 2 | Abrir o link (janela anônima) | ✅ "Entrar na QA Total" / "Dora convidou você como Administrador." |
| 3 | Senha `abc` / senhas diferentes | ✅ "A senha precisa de 8+ caracteres…" / "As senhas não conferem." |
| 4 | Senha sem símbolo (política da E-05) | ✅ erro da política (mín. 10 + símbolo) |
| 5 | Senha válida → "Criar conta e entrar" | ✅ cai em `/qa-total/home` |
| 6 | Reabrir o mesmo link | ✅ "Este convite já foi usado. Entre com seu e-mail e senha." |
| 7 | Convidar Gil (**Gerente**), Ana (**Operador**), Bruno e Carla (**Equipe campo**), Vera (**Visualizador**) e aceitar todos | ✅ 7 pessoas ativas |
| 8 | Convidar o Alex de novo | ✅ "Esta pessoa ja faz parte da empresa" |
| 9 | Convidar `voce+x@…` → em "convites pendentes" → "Reenviar" | ✅ "Link novo do convite"; o link antigo vira "inválido" |
| 10 | "Cancelar" esse convite → abrir o link | ✅ "Este convite foi cancelado." |
| 11 | Convidar, como **Operador**, alguém já com conta em **outra** empresa (o admin da QA Console) | ✅ página pede "Sua senha" ("Você já tem uma conta…"); ao aceitar, entra direto na QA Total e ganha o seletor de empresas |
| 12 | Lista de usuários | ✅ cartões com cargo, "Dono" (coroa) na Dora, busca por nome/e-mail |
| 13 | "Novo Usuário" (sem convite) **sem senha** | ✅ erro da API (senha obrigatória) |
| 14 | 🔧 Editar o **próprio** usuário (Dora): trocar o nome e salvar | ✅ salva (trocar a própria situação continua bloqueado) |
| 15 | 🔧 Editar a Vera e só trocar o nome | ✅ salva |
| 16 | Limite do plano: com o admin da QA Console já são **8** pessoas ativas (limite 8) → convidar mais 1 | ✅ "Limite de usuarios do plano atingido (8)" já no convite (se não bater, conte os ativos em *Plano*) |
| 17 | 🔧 Desativar a Vera (7 ativos) → convidar `voce+temp@…` e aceitar (8 ativos) → reativar a Vera | ✅ desativar libera a vaga; reativar dá "Limite de usuarios do plano atingido" |
| 18 | Excluir a pessoa do passo 17 e reativar a Vera | ✅ excluir libera a vaga; Vera volta (ela é usada nas próximas seções) |
| 19 | *Cargos* → excluir cargo **com usuários** | ✅ "Esta role esta atribuida a N usuario(s)…" |

### E-09 Proteções do dono (como **Alex**, administrador não-dono)
- [ ] Na lista, a Dora **não tem** "Editar"/"Excluir".
- [ ] Alex também **não consegue** gerir outro Administrador (mesmo rank) — sem botões. Crie um segundo Administrador temporário para ver isso e exclua depois.
- [ ] *Cargos* → editar o cargo **Administrador** → salvar. ✅ "Acesso negado: voce so age sobre cargos de rank inferior…" (o botão aparece; a API recusa).
- [ ] *Plano* → card "Dono da empresa": Alex vê quem é o dono, **sem** o botão de transferir.
- [ ] *Dados e privacidade*: Alex **pode** exportar (acesso total), mas **não** encerrar ("Somente o dono da empresa pode encerrar a conta.").

### E-10 Equipes
| # | Ação | Esperado |
|---|---|---|
| 1 | *Equipes* → "Nova equipe" **Norte** (cor azul) | ✅ "Equipe salva" |
| 2 | Nome repetido | ✅ "Ja existe uma equipe com esse nome" |
| 3 | Criar **Sul** | ✅ |
| 4 | Norte → "Membros": **Ana** e **Bruno** (Bruno "Líder") → Salvar | ✅ "Membros salvos"; coroa no Bruno |
| 5 | Sul → "Membros": **Carla** | ✅ |
| 6 | *Usuários* | ✅ selos das equipes; filtro "Todas as equipes / Norte / Sul" funciona |

### E-11 Modelos de PDF
| # | Ação | Esperado |
|---|---|---|
| 1 | *Modelos de PDF* → novo: "Ficha do cliente", slug `ficha-cliente`, **Individual**, fonte Clientes, A4 | ✅ "Criar e Continuar" abre o editor |
| 2 | Slug com maiúscula | ✅ "Slug deve conter apenas letras minusculas…" |
| 2b | 🔧 "Criar e Continuar" | ✅ abre o editor em `/{idioma}/{empresa}/gestao/pdf-templates/:id` |
| 3 | No editor: Texto (título), Campo (Nome), Grupo de Campos, Divisor → "Preview" → "Salvar" → **Publicar** | ✅ selo muda de "Rascunho" para publicado |
| 4 | Criar "Lista de clientes" **Lote** e publicar | ✅ |
| 5 | Lista → "Duplicar" e "Excluir" a cópia | ✅ "Template duplicado…" / "Template excluido…" |
| 6 | "Gerar" num modelo publicado (depois de ter registros) | ✅ contador "N registro(s)…"; gera PDF |

### E-12 Dashboards por cargo
| # | Ação | Esperado |
|---|---|---|
| 1 | *Dashboards* → "Novo Template" **"Painel campo"**: widgets KPI Card (total de Clientes), Pizza (Status), Tabela de Dados (Clientes, permitir criar/editar/excluir/exportar) | ✅ |
| 2 | "Configurações do Template" → Cargos: **Equipe campo** e **Operador**, Ativo ✔ → salvar | ✅ |
| 3 | Criar um segundo template para Clientes (outro nome) atribuído ao Operador | ✅ (Operador verá botões para alternar em O-05) |
| 4 | Nome vazio | ✅ "Informe o nome do template" |

### E-13 Links públicos
| # | Ação | Esperado |
|---|---|---|
| 1 | *Links públicos* → "Novo Link": "Cadastro de visitantes", entidade Clientes, "Criar role automaticamente" ✔, Max usuários **2** | ✅ cartão com `/p/{slug}` |
| 2 | "Copiar URL" | ✅ "Link copiado!" (usado em O-18) |
| 3 | 🔧 Novo link, sem criar role, com o cargo **Administrador** ou **Gerente** | ✅ "Link publico nao pode usar cargo com acesso a administracao" |

### E-14 Integrações — chaves de API
| # | Ação | Esperado |
|---|---|---|
| 1 | *Integrações › Chaves de API* → "Nova chave": "ERP QA", cargo **Gerente**, validade 30 dias | ✅ "Chave criada — Copie agora…"; copie a chave |
| 2 | Com pelo menos 1 cliente criado, no terminal: `curl -H "X-API-Key: <chave>" https://dev.iossystem.com.br/api/v1/data/clientes` | ✅ lista registros |
| 3 | `curl -H "X-API-Key: <chave>" https://dev.iossystem.com.br/api/v1/users` | ✅ 403 "Chave de API so acessa registros, tabelas e upload" |
| 4 | "Revogar" → repetir o passo 2 | ✅ 401 "Chave de API invalida ou revogada" |

### E-15 Integrações — webhooks (inclui bloqueio de endereço interno)
| # | Ação | Esperado |
|---|---|---|
| 1 | "Novo webhook" URL `http://localhost:8080/x` | ✅ "A URL aponta para um endereco interno" |
| 2 | URL `http://169.254.169.254/latest` | ✅ mesmo bloqueio |
| 3 | URL `ftp://exemplo.com` | ✅ "A URL precisa comecar com http:// ou https://" |
| 4 | URL de teste pública (ex.: um endereço do webhook.site), tabela Clientes, eventos Criado + Editado | ✅ "Webhook salvo" |
| 5 | "Testar" | ✅ "Teste enviado: o destino respondeu 200." |
| 6 | Criar/editar um cliente (O-06) → "Envios" | ✅ envios listados; no destino chega o POST com header `X-Webhook-Signature` |

### E-16 Integrações — automações
- [ ] Aba *Automações*: lista as automações criadas pelo template "Ordem de Servico".
- [ ] 🔧 "Editar na tabela" abre o editor direto na aba **Automações** (Automações de evento e agendadas).
- [ ] 🔧 Ação "Executar Script" não aparece mais. Via API, criar automação com `run_script` → ✅ "Tipo de acao invalido". Automação antiga com essa ação → ✅ falha na execução com "A acao run_script foi desativada por seguranca".

### E-17 Plano
- [ ] *Plano*: "QA Básico", dias restantes de teste, uso com barras, funções do plano.
- [ ] Console muda o plano da QA Total para "QA Mínimo" → depois de até 30 s, Chat/PDF/Links públicos aparecem como "não incluída no plano" e **somem** os menus correspondentes (*Modelos de PDF*, *Links públicos*).
- [ ] 🔧 Na **operação** (shell verde) o item "Chat" também some com o chat fora do plano.
- [ ] Voltar o plano para "QA Básico".

### E-18 Transferência de dono (faça por último nesta seção e desfaça)
| # | Ação | Esperado |
|---|---|---|
| 1 | Dora → *Plano* → "Escolha o novo dono" = **Gil** (Gerente) → Transferir | ✅ "O novo dono precisa estar num cargo com acesso total" |
| 2 | Escolher **Alex** → Transferir | ✅ "Propriedade transferida"; coroa vai para o Alex |
| 3 | Agora Dora (não-dona) tenta excluir o Alex | ✅ sem botão / "O dono da empresa so pode ser alterado por ele mesmo" |
| 4 | Alex transfere de volta para Dora | ✅ |

### E-19 Auditoria e Execuções
- [ ] *Auditoria*: aparecem criação de usuários, convites, equipes, cargos, organização. Filtros por ação/recurso/data funcionam.
- [ ] 🔧 Filtro com data final de hoje traz os registros de hoje.
- [ ] 🔧 "Exportar JSON" baixa `audit-logs-AAAA-MM-DD.json` **com os mesmos filtros** da tela (ação, recurso, busca, datas).
- [ ] Logar como alguém com o cargo **Auditor** (troque a Vera temporariamente): vê *Administração* só com Auditoria/Execuções.
- [ ] *Execuções*: aparecem os envios do webhook (E-15) com Sucesso/Erro.

### E-20 Acesso à Administração por cargo
| Cargo | Entra em "Administração"? | Seções visíveis |
|---|---|---|
| Dora (dono) / Alex | ✅ | todas |
| Gil (Gerente) | ✅ | Painel, Usuários, Equipes, Cargos, Guia, Modelos de PDF, Segurança (só leitura) |
| Ana / Bruno / Carla / Vera | ❌ (shell "Operacional", sem o botão) | — |

- [ ] Ana digitando `/pt-BR/qa-total/gestao/users` na barra → ✅ volta para `/home`.
- [ ] Gil digitando `/gestao/organization` → ✅ volta para `/gestao`.
- [ ] 🔧 Gil em *Cargos*: vê a lista, sem botões de edição.
- [ ] 🔧 Gil **não** vê *Links públicos* (a API exige "Gerenciar"); digitar a URL volta para `/gestao`.
- [ ] 🔧 Gil **não** vê *Dashboards* (configurar dashboards exige criar/editar/excluir no módulo Painel); digitar a URL volta para `/gestao`.

---

## 4. Operação no web

### O-01 Casca operacional × administrativa
| Persona | Esperado |
|---|---|
| Ana / Vera / Bruno / Carla | ✅ faixa verde no topo, selo "Operacional", menu: Início, Dashboard, Chat, Registros (lista de tabelas com contagem), Suporte, Configurações. **Sem** "Administração". |
| Ana / Vera / Bruno / Carla | ✅ **sem** "Lixeira" (não excluem) |
| Gil / Dora | ✅ casca administrativa com botão "Administração" |
| Todos | ✅ sino de notificações, "Olá, {nome}", faixa de teste (sem "Ver plano" para quem não é admin) |

### O-02 Início (`/home`)
- [ ] 🔧 Ana: cartões **Registros**, **Relatórios**, **Configurações** apenas.
- [ ] Dora: + Nova Tabela, Usuários, Cargos, Templates PDF, Dashboards, Links Públicos, Auditoria.

### O-03 Rotas da própria conta abrem para todos
- [ ] 🔧 Ana abre `/pt-BR/qa-total/profile` e `/settings` → as páginas abrem (são da própria conta).
- [ ] Ana abre `/pt-BR/qa-total/gestao/entities` → volta para `/home`.

### O-04 Dashboard geral (`/dashboard`)
- [ ] Ana: KPIs "Registros" e "Atividade" (sem "Tabelas"/"Usuários").
- [ ] "Atualizar" recarrega; com 0 registros: "Nenhum registro criado ainda".

### O-05 Registros — dashboard da tabela por cargo
- [ ] Ana em *Registros › Clientes*: com 2 templates atribuídos, aparecem botões para alternar (lembra a escolha ao recarregar).
- [ ] Clicar numa fatia da pizza → cria filtro (barra "Filtros"; a contagem aparece com 2 ou mais); clicar no chip remove; "Limpar".

### O-06 Criar, editar, validar
| # | Ação (Ana) | Esperado |
|---|---|---|
| 1 | "Criar" em Clientes sem preencher Nome | ✅ "Nome é obrigatório" |
| 2 | Email `abc` | ✅ o navegador barra no campo. Com `abc@x`: "Email inválido" |
| 3 | 🔧 CPF — só esse campo **não aparece** (permissão por campo, E-07/7); os outros aparecem e salvam | ✅ |
| 4 | Criar "Cliente A1" (VIP = Não) e "Cliente A2" (VIP = **Sim**) | ✅ salvos; webhook dispara (E-15) |
| 5 | Lista | ✅ Ana vê **A1**; **A2 some** (filtro de dados VIP = Não) |
| 6 | 🔧 Editar A1 → mudar Status | ✅ "Registro atualizado…"; a lista mostra o rótulo ("Em contato") |
| 7 | Email repetido com outro cliente (campo Único) | ✅ erro de valor único |
| 8 | Dora cria "Cliente D1" | ✅ Ana **não** vê D1 (Operador = só os próprios) |

### O-07 Sub-registros
- [ ] No formulário **novo**: "💡 Salve o registro primeiro para adicionar Visitas".
- [ ] Editando A1: seção Visitas → "Novo" → cria visita; vistas Tabela / Cards / Timeline; ordenação.
- [ ] 🔧 Excluir a visita: confirmação fala da lixeira e o toast tem **Desfazer** (10 s).

### O-08 Busca, filtros, colunas, paginação
- [ ] Busca "A1" filtra.
- [ ] "Filtrar" → Status Igual a "Novo" → chip; "Limpar filtros".
- [ ] 🔧 "Colunas" → esconder Email → recarregar: continua escondida (salvo neste navegador, por tabela).
- [ ] Depois da O-09 (planilha de 70 linhas): paginação 25 por página, "1–25 de N".

### O-09 Importar e exportar (Dora, exceto onde indicado)
| # | Ação | Esperado |
|---|---|---|
| 1 | "Importar" → arquivo `.csv` | ✅ "Formato não suportado. Use .xlsx ou .json" |
| 2 | `.xlsx` de 5 linhas → mapear colunas → "Importar 5 registro(s)" | ✅ "4 importado(s)", "1 erro(s)", "Linha X: …" |
| 3 | "Exportar" → Excel | ✅ `Clientes_AAAA-MM-DD.xlsx`; "N registros exportados" |
| 4 | Selecionar 2 linhas → Exportar JSON | ✅ só os 2 |
| 5 | Exportar → PDF "Ficha do cliente" sem seleção | ✅ desabilitado ("selecione") |
| 6 | Selecionar 1 → PDF individual | ✅ "PDF gerado com sucesso" |
| 7 | PDF "Lista de clientes" (lote) | ✅ "PDF em lote gerado com sucesso" |
| 8 | 🔧 Gil (Gerente) clica em "Exportar" → Excel | ✅ o arquivo baixa (web e API respeitam o coringa `*`; Gil não importa) |
| 9 | Ana | ✅ sem Importar/Exportar |
| 10 | Limite do plano: importar a planilha de 70 linhas | ✅ "Limite de registros do plano atingido (60)". Depois exclua e esvazie a lixeira até sobrar espaço: as próximas seções criam registros |

### O-10 Excluir e desfazer
| # | Ação (Dora) | Esperado |
|---|---|---|
| 1 | 🔧 Excluir "Cliente D1" | ✅ confirmação: "Ele vai para a lixeira e pode ser restaurado."; depois toast "Registro excluído. Ele fica na lixeira." com **Desfazer** (10 s) |
| 2 | Clicar "Desfazer" | ✅ D1 volta |
| 3 | Excluir de novo e esperar 10 s | ✅ vai para a Lixeira |
| 4 | Excluir um cliente **com visitas** | ✅ sub-registros vão junto |

### O-11 Lixeira
| # | Ação | Esperado |
|---|---|---|
| 1 | Dora → *Lixeira* | ✅ itens com "Excluído por Dora em …", "+ N sub-registros" |
| 2 | Busca e filtro por tabela | ✅ |
| 3 | "Restaurar" o cliente com visitas | ✅ "N registros restaurados (com sub-registros)" |
| 4 | Excluir só a visita de um cliente, depois o cliente; restaurar o cliente | ✅ o cliente volta e a visita aparece como item separado na lixeira. Via API, restaurar a visita antes do pai → "O registro principal tambem esta na lixeira: restaure ele primeiro" |
| 5 | "Apagar de vez" um item | ✅ "Apagado de vez"; some definitivamente |
| 6 | Prazo "Apagar após 30 dias" | ✅ "Prazo da lixeira salvo"; subtítulo cita os 30 dias |
| 7 | "Esvaziar lixeira" | ✅ "Esvaziar toda a lixeira?" → "N registro(s) apagado(s)" |
| 8 | Ana abre `/pt-BR/qa-total/trash` direto | ✅ lista vazia (ela não exclui) |
| 9 | Restaurar com o plano no limite de registros | ✅ "Limite de registros do plano atingido" |

### O-12 Chat — canais e threads (web)
| # | Ação | Esperado |
|---|---|---|
| 1 | Dora → *Chat* → seção "Tabelas" → Clientes | ✅ cria o canal de grupo da tabela |
| 2 | Ana → *Chat* | ✅ vê o canal "Clientes" (antes de existir: "Nenhum canal disponível ainda") |
| 3 | Mensagem "oi time" | ✅ aparece para Dora em até ~4 s |
| 4 | Ana: menu ⋯ de A1 → "Abrir chat" | ✅ thread do registro em "Registros" |
| 5 | "Novo chat" → escolher tabela e registro | ✅ abre o thread |
| 6 | Dora renomeia e exclui um thread | ✅ "Excluir chat?" → "Chat excluído." (histórico preservado) |
| 7 | Buscar mensagens (lupa) | ✅ resultados; clicar pula para a mensagem com destaque |
| 8 | No canal Clientes: `@bot quantos clientes?` | ✅ "Você pode ver N registro(s)" |
| 9 | 🔧 Ana → "Conversa direta" → buscar "gil" → escolher | ✅ abre a conversa; Gil vê em "Diretas" com o nome **Ana**; só os dois veem |

### O-13 Chat — comandos
| # | Ação | Esperado |
|---|---|---|
| 1 | Dora → "Comandos do bot" → criar comando de **captura rápida** `/novocliente` (Clientes, campos Nome/Email) | ✅ |
| 2 | Comando de **consulta** `/clientes` (formatos Excel e PDF) | ✅ |
| 3 | Ana digita `/` no canal | ✅ lista de comandos; ↑↓, Tab/Enter |
| 4 | Como Dora: `/novocliente` → "Salvar e adicionar outra" 2x | ✅ "✓ 2 registro(s) adicionado(s)…" a cada salvamento; aparecem na tabela |
| 5 | `/clientes` → Excel | ✅ "Relatório gerado — clique na mensagem para baixar" |
| 6 | Comando de **consulta** restrito ao cargo Gerente: Vera não vê | ✅ |

### O-14 Notificações e preferências
| # | Ação | Esperado |
|---|---|---|
| 1 | Dora cria um cliente → Gil (escopo todos) | ✅ toast de 5 s + sino com contador |
| 2 | Dora **não** recebe aviso do que ela mesma fez | ✅ |
| 3 | Gil → *Configurações › Notificações* → "Avisos na tela" off | ✅ "Preferências salvas"; próximo aviso só no sino, sem toast |
| 4 | Gil → "Registro alterado" off | ✅ edições não avisam |
| 5 | Gil → "Minhas próprias ações" on → Gil cria algo | ✅ ele recebe |
| 6 | 🔧 Gil → seção "Tabelas" | ✅ lista Clientes, Visitas…; desligar uma tabela para de avisar dela |
| 7 | Ana (só os próprios) quando Dora cria | ✅ **não** recebe (não enxerga o registro) |
| 8 | 🔧 Recarregar a página | ✅ o sino mantém as notificações (vêm do servidor); lida/removida/limpa continua assim depois de recarregar |
| 9 | "Marcar todas" e lixeira do sino | ✅ |

### O-15 Suporte (cliente)
| # | Ação | Esperado |
|---|---|---|
| 1 | Ana → *Suporte* → "Novo chamado": assunto "Não consigo exportar", mensagem "Erro ao exportar", tipo Problema, prioridade Alta | ✅ "Chamado #N aberto" |
| 2 | Assunto com 2 letras | ✅ "Enviar" desabilitado |
| 3 | Dora → *Suporte* | ✅ vê **todos** os chamados da empresa (com o nome de quem abriu) |
| 4 | Vera tenta abrir o chamado da Ana pela URL | ✅ "Chamado nao encontrado" |
| 5 | (depois da resposta do suporte, P-12) Ana vê "· nova resposta" e "Aguardando você" | ✅ |
| 6 | Ana "Marcar como resolvido" | ✅ "Chamado marcado como resolvido" |
| 7 | Ana responde num chamado **Resolvido** | ✅ volta para "Aguardando suporte" |
| 8 | Sérgio marca outro chamado como **Encerrado** (depois da P-12) | ✅ sem caixa de resposta para a Ana: "Chamado encerrado. Se precisar, abra um novo." |

### O-16 Configurações pessoais
- [ ] *Perfil*: alterar nome → "Salvar". Trocar senha com confirmação diferente → "As senhas não coincidem".
- [ ] 🔧 *Idioma*: English → interface em inglês, URL `/en/{empresa}/settings`; voltar para Português.
- [ ] *Tema*: Claro / Escuro / Sistema.
- [ ] *Segurança* e *Privacidade*: ver seções 8 e 9.

### O-17 Várias empresas
- [ ] O admin da QA Console (aceitou convite em E-08/11): seletor com prédio no cabeçalho, as duas empresas, ✓ na atual.
- [ ] Trocar → vai para `/qa-console/home`; a lista de tabelas muda.
- [ ] 🔧 Na QA Total esse admin é Operador: vê só os próprios registros e sem CPF, mesmo sendo Administrador na QA Console.
- [ ] Digitar na URL o slug de uma empresa onde **não** tem acesso → a API responde 401 "Sem acesso a este tenant".

### O-18 Link público
| # | Ação | Esperado |
|---|---|---|
| 1 | Abrir a URL do link (E-13) em janela anônima | ✅ abas "Entrar" / "Cadastro" |
| 2 | Cadastro com CPF inválido | ✅ "CPF invalido" |
| 3 | Cadastro válido | ✅ entra em `/p/{slug}/app`: "Nenhum registro encontrado…" + "Novo registro" |
| 4 | "+" → criar registro | ✅ aparece no app público e no web da Dora |
| 5 | Segundo cadastro | ✅ ok; **terceiro**: "Limite de registros atingido para este link" |
| 6 | Dora desativa o link → recarregar | ✅ "Este link esta desativado" |
| 7 | Cadastros do link **não** contam no limite de usuários do plano | ✅ (Plano continua com o mesmo número) |
| 8 | 🔧 Conta com duas etapas entra pelo link | ✅ "Esta conta usa verificacao em duas etapas. Entre pelo login normal." |
| 9 | 🔧 6 logins errados em 1 min no link | ✅ 429 "Muitas tentativas…" |
| 10 | 🔧 Vera entra pelo link | ✅ o cargo Visualizador continua igual em *Cargos* |

---

## 5. Operação no app (celular)

> Aparelho 1: **Bruno**. Aparelho 2: **Ana** (depois Carla/Vera).

### M-01 Primeira abertura e login
| # | Ação | Esperado |
|---|---|---|
| 1 | Abrir o app | ✅ tela de login |
| 2 | Login com senha errada | ✅ mensagem de erro |
| 3 | Login correto | ✅ tela "Permissoes necessarias" (Localização, Câmera, Notificações) → "Conceder Permissoes" → Dashboard na cor da empresa |
| 4 | Ícone de nuvem no topo | ✅ "Sincronizando..." → "Sincronizado" |
| 5 | Tocar no ícone | ✅ diálogo "PowerSync" (Conectado: Sim, Último sync) |
| 6 | Menu lateral → "Sincronizacao" | ✅ contagens locais de Entity, EntityData, CustomRole, User |

### M-02 Permissões no app
| Persona | Abas | Esperado |
|---|---|---|
| Bruno | Dashboard, Dados, Chat | ✅ cria/edita em Clientes e Visitas; não exclui |
| Ana | Dashboard, Dados, Chat | ✅ cria/edita; CPF não aparece; não vê VIP |
| Vera | Dashboard, Dados, Chat | ✅ sem "+" e sem editar |
| Vera | 🔧 Dashboard → "Acoes Rapidas" | ✅ **sem** "Novo Clientes" (só "Ver Dados"); abrir `/data/clientes/new` volta para a lista |

### M-03 Registros
| # | Ação | Esperado |
|---|---|---|
| 1 | *Dados* → buscar entidade "Cli" | ✅ Clientes |
| 2 | Lista → busca | ✅ |
| 3 | "+" → salvar sem Nome | ✅ "Campos obrigatorios: Nome" |
| 4 | Criar "Cliente B1" (Bruno) | ✅ "Registro criado"; aparece no web em segundos |
| 5 | Tocar no registro | ✅ abre a edição (Bruno edita) |
| 6 | Sair com alterações | ✅ "Descartar alteracoes?" |
| 7 | Detalhe → "Compartilhar" | ✅ "Registro copiado para area de transferencia" |
| 8 | Sub-registro (Visitas) dentro de B1 | ✅ "Adicionar Visitas" |
| 9 | Dora exclui algo no web | ✅ some do app em segundos |
| 10 | 🔧 Botão de filtro ao lado da busca → adicionar "Status igual a Novo" | ✅ lista e contador filtram (também offline); o número aparece no botão; campo oculto (CPF para a Ana) não aparece na lista de filtros |
| 11 | 🔧 Dora: arrastar para excluir um registro no app | ✅ some no app e **no web**, vai para a Lixeira e não volta depois do sync |

### M-04 Offline
| # | Ação | Esperado |
|---|---|---|
| 1 | Modo avião | ✅ ícone "Offline" |
| 2 | Navegar por tabelas e registros | ✅ tudo continua (SQLite local) |
| 3 | Criar "Cliente OFF1" e editar B1 | ✅ "Registro criado/atualizado" na hora |
| 4 | Campo Imagem → Câmera | ✅ selo "Pendente"; contador no ícone de sync |
| 5 | Mensagem no chat de grupo | ✅ aparece local |
| 6 | Desligar o modo avião | ✅ sobe tudo; foto vira imagem real; no web aparece OFF1, a edição e a mensagem |
| 7 | 🔧 Offline: criar um cliente com **Email repetido** (regra do servidor) → voltar online | ✅ aviso "Uma alteração não foi sincronizada: …" e o registro some da lista |
| 8 | Offline: criar registro com a empresa no **limite do plano** → online | ✅ snackbar "Uma alteração não foi sincronizada: Limite de registros…" |
| 9 | 🔧 Offline: criar um registro e editá-lo → online | ✅ no web, um único registro, já com a edição |
| 10 | 🔧 Offline: criar um registro, fotografar e adicionar sub-registro → online | ✅ foto real e sub-registro ligado ao pai no web, sem duplicar |
| 11 | 🔧 Matar o app durante o envio e reabrir | ✅ nada duplica nem se perde |

### M-05 Chat no app
- [ ] Aba *Chat*: canais com subtítulos "Tabela" / "Chat do registro" / "Direta".
- [ ] Mensagem de texto ida e volta com o web.
- [ ] `/` → comando `/novocliente` → "Salvar e adicionar outra" → "Enviar (2)".
- [ ] Fechar um comando preenchido → "Descartar rascunho?".
- [ ] Offline: comandos, `@bot` e busca **não** funcionam (precisam de rede); texto funciona.
- [ ] Detalhe do registro → 💬 "Chat do registro" (só online; offline: "Nao foi possivel abrir o chat.").
- [ ] Renomear/excluir canal: só para quem criou o canal.

### M-06 Push
> **Quem cria é a Ana**: Bruno só enxerga colegas da Norte (X-01).
- [ ] Bruno com "Notificação no celular" **ligado** (web › Configurações › Notificações).
- [ ] Ana cria um registro.
- [ ] App em primeiro plano: snackbar de 4 s. App fechado: push do sistema; tocar abre o registro.
- [ ] 🔧 Push sem registro ligado → abre o app no Dashboard (ou Dados).

### M-07 Duas etapas, sessão e bloqueios no app
> Faça depois das seções 7 e 8. Passos 3 e 4 na QA Console com o admin dela, para não derrubar a QA Total. Os passos 2 a 4 apagam o cache do aparelho: faça o 6 antes, ou entre online de novo.
| # | Ação | Esperado |
|---|---|---|
| 1 | Conta com 2 etapas (seção 8) faz login | ✅ pede "Código" de 6 dígitos |
| 2 | Web → *Configurações › Segurança* → "Encerrar" a sessão "App CRM no celular", depois criar um registro ou puxar para atualizar no Dashboard | ✅ no app: "Sua sessão foi encerrada (por você em outro aparelho ou pelo administrador). Entre de novo." |
| 2b | 🔧 Repetir com o app **fechado** e reabrir | ✅ pede login; não entra sozinho |
| 3 | Empresa suspensa (P-16) | ✅ "O acesso desta empresa está suspenso…" e volta ao login |
| 4 | Plano sem "App mobile" | ✅ "O app mobile não está incluído no plano da sua empresa…" |
| 5 | 🔧 30 min sem tocar no app, depois fechar e reabrir | ✅ sai sozinho (sem aviso antes) e pede login ao reabrir |
| 6 | Modo avião: "Sair" e entrar com a senha salva | ✅ entra; senha errada: "Senha incorreta." |
| 6b | Modo avião: fechar o app sem sair e reabrir | ✅ entra sem pedir senha (sessão ainda ativa) |
| 7 | Sair (menu) | ✅ "Deseja realmente sair da sua conta?" |
| 8 | 🔧 Sair, fechar e reabrir, online e em modo avião | ✅ pede login nos dois casos |
| 9 | 🔧 Resposta 401 durante o envio (expirar a sessão com a fila pendente) | ✅ a alteração continua na fila e sobe depois do novo login |

---

## 6. Escopos de visibilidade (todos × equipe × próprios)

> O coração do RBAC. Faça com **web + app** ao mesmo tempo.
> Lembrete: equipes **Norte** = Ana + Bruno; **Sul** = Carla. Cargo "Equipe campo" (escopo Minha equipe) = Bruno e Carla. Ana = Operador (só meus).

### X-01 Matriz de quem vê o quê
Crie um registro por pessoa em Clientes: **D** (Dora), **A** (Ana), **B** (Bruno), **C** (Carla).

| Quem olha | D | A | B | C | Por quê |
|---|---|---|---|---|---|
| Dora / Alex / Gil | ✅ | ✅ | ✅ | ✅ | escopo todos |
| Vera (Visualizador) | ✅ | ✅ | ✅ | ✅ | todos, só leitura |
| Ana (Operador) | ❌ | ✅ | ❌ | ❌ | só os próprios |
| **Bruno** (equipe, Norte) | ❌ | ✅ | ✅ | ❌ | colegas da Norte (Ana) + os dele |
| **Carla** (equipe, Sul) | ❌ | ❌ | ❌ | ✅ | ninguém mais na Sul |

Conferir em: **lista web**, **contagem na lateral**, **dashboard**, **busca**, **app**, **PDF por ID**, **`/data/clientes/:id` direto**, **`/data/clientes/archived`**, **sugestões de campo no chat**.

Para a **exportação**, crie um cargo "Equipe campo + Exportar" e dê ao Bruno temporariamente: os cargos deste roteiro com escopo restrito não exportam. Ver também a seção 13, que cobre esta matriz na API.

🔧 Com o socket aberto, Ana não recebe `data` de registros que não vê: o evento `data-changed` leva só o id. Assinar `user:<id de outra pessoa>` → "Acesso negado".

### X-02 Mudanças ao vivo
| Ação (Dora) | Esperado para Bruno (web e app) |
|---|---|
| Mover a **Ana** da Norte para a Sul | ✅ registro A **some** para o Bruno; **aparece** para a Carla |
| Colocar **Carla** na Norte (além da Sul) | ✅ Bruno passa a ver C; Carla vê B e A |
| Excluir a equipe Norte | ✅ "Os registros continuam…"; Bruno volta a ver só os dele |
| Recriar a Norte com Ana + Bruno e **tirar a Ana da Sul** e a **Carla da Norte** | ✅ volta ao X-01 |
| Trocar o cargo do Bruno para Operador | ✅ após logout/login no app, Bruno vê só os dele |
| **Voltar o Bruno para Equipe campo** (necessário para a X-03) | ✅ após logout/login, volta ao X-01 |

> No app, mudança de **cargo** exige sair e entrar (o token do sync guarda o cargo por até 1 h). Mudança de **equipe** chega sozinha.

### X-03 Chat do registro por equipe (app)
| # | Ação | Esperado |
|---|---|---|
| 1 | Ana abre o chat do registro A e manda "oi equipe" | ✅ |
| 2 | Bruno (app) → *Chat* | ✅ thread de A aparece com a mensagem (também em modo avião depois de sincronizar) |
| 3 | Bruno responde | ✅ Ana vê no web |
| 4 | Carla (app) | ✅ thread **não** aparece |
| 5 | Dora remove a Ana da Norte | ✅ thread e registro somem para o Bruno |
| 6 | Dora coloca a Ana de volta | ✅ voltam com o histórico |
| 7 | Dora exclui o chat do registro | ✅ some para todos da equipe |

### X-04 Notificações respeitam o escopo
- [ ] Carla cria registro → Bruno **não** recebe aviso (não enxerga); Dora/Gil recebem.
- [ ] Ana cria registro → Bruno recebe (mesma equipe).

### X-05 Filtro de dados + escopo
- [ ] Ana cria "Cliente A3" com VIP = Sim → ✅ Ana não vê (filtro do cargo), Dora vê.
- [ ] Pedir o PDF ou `/data/clientes/archived` como Ana → ✅ A3 também não vem.

---

## 7. Plataforma II — suporte, comunicados, pessoas, massa, situação

### P-10 Clientes — lista, filtros, detalhe
- [ ] Busca "qa" (sem diferenciar maiúsculas), filtros Situação e Plano, `?lifecycle=TRIAL` na URL.
- [ ] Detalhe "QA Total": Uso (usuários/registros/MB) bate com a *Administração › Plano*; "recalcular" → "Armazenamento recalculado: X MB".
- [ ] "Histórico da equipe neste cliente": as ações do console aparecem.
- [ ] Funções: desligar **Chat** só para a QA Total → selo "Só deste cliente"; na empresa o Chat some da administração; "voltar ao plano" → volta.
- [ ] "Dados": domínio próprio `crm.qa.com.br` → "Dados atualizados"; slug desabilitado.
- [ ] Cargos: remover um cargo sem uso (crie um vazio antes) → "Confirmar remoção" → "Cargo removido".
- [ ] "Tornar dono": só aparece em membro com acesso total. Via API em outro membro → erro de acesso total.
- [ ] Tentar remover o cargo padrão: o botão não aparece. Via API → recusado.
- [ ] "Adicionar membro" na QA Console com uma pessoa nova da QA Total → "Membro adicionado".
- [ ] 🔧 "Adicionar membro" com o e-mail da Dora na QA Total → ✅ "Esta pessoa ja e membro desta empresa"; o cargo dela não muda.

### P-11 Entrar como (impersonação)
| # | Ação (Sérgio) | Esperado |
|---|---|---|
| 1 | Detalhe QA Total → Bruno → "Entrar como" | ✅ abre `/qa-total/home` como Bruno com faixa laranja "Você está impersonando Bruno (por Sérgio (equipe))" |
| 2 | Ver registros | ✅ exatamente o que o Bruno vê (X-01) |
| 3 | Configurações › Segurança → trocar senha | ✅ "Acao sensivel bloqueada em sessao de impersonacao: trocar a senha" |
| 4 | Bruno (na conta dele) → Aparelhos conectados | ✅ sessão com selo "Suporte: Sérgio (equipe)" |
| 5 | 🔧 "Sair da impersonação" | ✅ volta para `/admin/tenants/{id}`; a sessão some dos aparelhos do Bruno. Com a sessão aberta, desativar o Sérgio → ✅ o próximo refresh falha ("Sessao de suporte encerrada") |
| 6 | Auditoria do console | ✅ "entrou como usuário" com IP |
| 7 | Como Dora impersonada: Exportar / Encerrar conta / gerir cargos | ✅ bloqueados ("Nao disponivel ao entrar como outra pessoa" / ação sensível) |

### P-12 Chamados (suporte)
| # | Ação (Sérgio) | Esperado |
|---|---|---|
| 1 | Menu "Chamados" | ✅ contador laranja com os abertos |
| 2 | Filtros: busca "#N", situação, prioridade, "Meus"/"Sem responsável" | ✅ |
| 3 | Abrir o chamado da Ana → **Nota interna** "verificar export" | ✅ amarelo com cadeado; Ana **não** vê |
| 4 | Resposta pública | ✅ "Resposta enviada"; situação vira "Aguardando o cliente"; Sérgio vira responsável; Ana recebe notificação no sino (📧 e e-mail) |
| 5 | Prioridade → Urgente | ✅ silencioso |
| 6 | Situação → Resolvido | ✅ mensagem de sistema visível para a Ana; notificação "Chamado #N resolvido" |
| 7 | Lia (leitura) abre o chamado | ✅ vê, mas sem caixa de resposta |
| 8 | Fábio (Financeiro) responde | ✅ pode |

### P-13 Comunicados
| # | Ação (Sérgio) | Esperado |
|---|---|---|
| 1 | "Novo comunicado": título "Manutenção sábado", um texto, nível Atenção, público **Empresas específicas** = QA Total, link `https://exemplo.com`, "Pode ser fechado" ✔ | ✅ "Vai aparecer para 1 empresa"; "Comunicado salvo" (Rascunho) |
| 2 | Link `exemplo.com` (sem http) | ✅ "O link precisa comecar com http:// ou https://" |
| 3 | Fim antes do início | ✅ "O fim precisa ser depois do inicio" |
| 4 | "Publicar" | ✅ "No ar"; na QA Total aparece a faixa (pode levar até ~10 min; recarregue) |
| 5 | Ana fecha o aviso | ✅ some para ela; continua para a Dora; contador "N fecharam" |
| 6 | Comunicado **Crítico** "não pode ser fechado" + "Só para quem administra", público **QA Total** → "Publicar" | ✅ aparece para Dora/Alex; **não** para Ana/Vera; sem X |
| 7 | 🔧 "Tirar do ar" e "Excluir" | ✅ excluir pede confirmação ("Excluir o comunicado …?"); Cancelar mantém |

### P-14 Pessoas
| # | Ação (Sérgio) | Esperado |
|---|---|---|
| 1 | Buscar "bru" / e-mail / telefone | ✅ Bruno com etiqueta "QA Total · Equipe campo" |
| 2 | Detalhe → empresas, aparelhos conectados, últimas ações | ✅ |
| 3 | "Desconectar de tudo" | ✅ "Pessoa desconectada…"; Bruno cai no login no web **e no app** |
| 4 | "Enviar link de nova senha" | ✅ "Link de nova senha enviado" (📧) |
| 5 | "Desligar duas etapas" (pessoa com 2 etapas, seção 8) | ✅ "Duas etapas desligadas" + desconecta |
| 6 | Lia | ✅ vê, sem botões |

### P-15 Ações em massa (Fábio)
| # | Ação | Esperado |
|---|---|---|
| 1 | Clientes → marcar QA Total e QA Console → "Prorrogar teste" 7 dias → "Ver prévia" | ✅ "2 empresas vão mudar" com "de → para" |
| 2 | Mudar os dias | ✅ a prévia é descartada |
| 3 | "Aplicar a 2 empresas" | ✅ "2 empresas atualizadas"; faixa de teste da QA Total soma 7 dias |
| 4 | "Trocar plano" para "QA Básico" | ✅ QA Total "fica de fora: já está nesse plano"; QA Console muda |
| 5 | *Planos* → "QA Mínimo" → "Mover clientes" → "QA Básico" | ✅ "Todas as empresas do plano QA Mínimo" → aplicar |
| 6 | 🔧 Com uma empresa **Ativa**: "Mudar situação → Em teste" | ✅ o calendário não deixa escolher antes de hoje; data passada pela API: "Fim do trial precisa ser no futuro" já na prévia |
| 7 | Sérgio | ✅ não vê os botões de massa |

### P-16 Situação do cliente (bloqueio e reativação) — use a **QA Console**
| # | Ação (Fábio) | Esperado |
|---|---|---|
| 1 | Logue o admin da QA Console no web e no app | — |
| 2 | Detalhe → Situação **Pagamento pendente** → Salvar | ✅ "Situação atualizada"; na empresa: faixa "Há um pagamento pendente…"; acesso continua |
| 3 | Situação **Suspenso** | ✅ web: vai para `/login?reason=suspended` com aviso amarelo; app: "O acesso desta empresa está suspenso…" |
| 4 | Login de novo (empresa principal suspensa) | ✅ "Tenant suspenso ou inativo" |
| 5 | Sérgio tenta "Entrar como" | ✅ no detalhe do cliente, sem botão e com "Reative o cliente para entrar como usuário."; em *Pessoas*, "Tenant suspenso ou cancelado: reative antes de entrar como usuario" |
| 6 | Situação **Em teste** com data passada | ✅ "Fim do trial precisa ser no futuro" |
| 7 | Situação **Ativo** | ✅ volta a entrar; dados intactos |
| 8 | Métricas: "Conversões" sobe ao ir de Em teste → Ativo pela 1ª vez | ✅ |

### P-17 Limites do plano no "QA Mínimo"
- [ ] Preparo: na QA Console, crie uma tabela e 5 registros, e aceite 1 convite (2 pessoas ativas).
- [ ] Mover só a QA Console para "QA Mínimo" (2 usuários, 5 registros).
- [ ] Criar o 6º registro → "Limite de registros do plano atingido (5)" (web) / snackbar no app.
- [ ] Convidar 3ª pessoa → "Limite de usuarios do plano atingido (2)" já no convite. Convite criado antes de lotar também recebe esse erro no aceite.
- [ ] Chat, PDF e Links públicos somem dos menus da administração.

### P-18 Métricas, Saúde, Auditoria
- [ ] Métricas (Paula/Fábio/Lia): período 6/12/24 meses; "Ver em tabela"; "Por plano"; "Clientes sem uso há 30 dias".
- [ ] Saúde: atualiza a cada 30 s; "Atualizar"; cartões Banco, Redis, Filas, API, PowerSync, E-mail (Atenção), Push, Arquivos; "Problemas recentes".
- [ ] 🔧 Auditoria: as ações de hoje aparecem **traduzidas** ("prorrogou o teste", "respondeu chamado", "publicou comunicado"…); a coluna Alvo mostra o tipo técnico.

---

## 8. Segurança da conta e sessões

### S-01 Duas etapas (Dora)
| # | Ação | Esperado |
|---|---|---|
| 1 | *Configurações › Segurança* → "Ativar verificação em duas etapas" (o botão é clicado **2 vezes**: no cartão e no fluxo) | ✅ QR code + chave manual |
| 2 | Código errado | ✅ "Codigo invalido. Confira o horario do celular…" |
| 3 | Código certo | ✅ "Verificação em duas etapas ativada." + 10 códigos; "Copiar códigos" |
| 4 | Sair e entrar | ✅ pede o código de 6 dígitos |
| 5 | Usar um **código de recuperação** | ✅ entra; o mesmo código de novo → "Codigo invalido" |
| 6 | Esperar 5 min na tela do código | ✅ "Etapa de verificacao expirada. Entre de novo." |
| 7 | "Gerar novos códigos" | ✅ os antigos deixam de valer |

### S-02 Exigir 2 etapas da equipe
| # | Ação | Esperado |
|---|---|---|
| 1 | Dora (já com 2 etapas) → *Administração › Segurança* → "Exigir…" → Salvar | ✅ |
| 2 | Vera no app, antes de ativar | ✅ "Sua empresa exige verificação em duas etapas. Ative pelo navegador…" |
| 3 | Vera no web faz qualquer ação | ✅ vai para "Ative a verificação em duas etapas" (`/security-setup`) |
| 4 | Vera ativa | ✅ segue para `/home` |
| 5 | Desligar a exigência no fim | — |

### S-03 Aparelhos conectados
| # | Ação | Esperado |
|---|---|---|
| 1 | Gil logado em 2 navegadores + app → *Segurança* | ✅ 3 aparelhos, "Este aparelho" no atual |
| 2 | "Encerrar" o outro navegador | ✅ "Sessão encerrada"; o outro cai no login (até ~10 s) |
| 3 | "Sair de todos os outros" | ✅ "N aparelhos desconectados"; o app pede login com a mensagem de sessão encerrada |
| 4 | Dora → *Administração › Segurança* → "Desconectar" o Gil | ✅ "Desconectado de N aparelho(s)" |
| 5 | Depois de o Gil entrar de novo: trocar a senha | ✅ derruba os **outros** aparelhos; o atual continua |

### S-04 Política de senha aplicada
- [ ] Com mín. 10 + símbolo (E-05): trocar senha para `Abcdefgh12` → erro da política; `Abcdefgh1!` → ok.
- [ ] Aceite de convite novo também exige a política.

### S-05 Esqueci a senha (📧)
- [ ] `/forgot-password` com qualquer e-mail → sempre "Se o email existir, você receberá instruções…".
- [ ] Sem SMTP nada chega: alternativa → console › Pessoas → "Enviar link de nova senha" também depende de e-mail. **Pule em dev** até configurar o SMTP.

### S-06 Limites de tentativas
- [ ] 6 logins errados em 1 min no `/login` → "Muitas tentativas…". (Não existe bloqueio de conta, só a espera.)
- [ ] 4 cadastros em 1 min no mesmo IP → "Muitas tentativas…".

---

## 9. LGPD — exportar e encerrar

### L-01 Meus dados (qualquer pessoa)
- [ ] Ana → *Configurações › Privacidade* → "Baixar meus dados" → `meus-dados.json`.

### L-02 Excluir minha conta
| # | Ação | Esperado |
|---|---|---|
| 1 | Dora tenta excluir a própria conta | ✅ "Voce e dono de QA Total. Passe a propriedade…" |
| 2 | Pessoa descartável: senha errada | ✅ "Senha incorreta" |
| 3 | Pessoa descartável com 2 etapas, sem o código | ✅ "Informe o codigo de verificacao em duas etapas" |
| 4 | Use uma pessoa descartável com registros: senha + "EXCLUIR" | ✅ "Sua conta foi excluída"; sai; os registros dela ficam com conta anonimizada |

### L-03 Exportar a empresa
| # | Ação | Esperado |
|---|---|---|
| 1 | Dora → *Administração › Dados e privacidade* → "Baixar tudo (ZIP)" | ✅ "Preparando o arquivo…" → "Arquivo pronto"; ZIP com CSVs (registros ativos, arquivados e lixeira), equipe/cargos (sem senhas), estrutura, configurações (sem segredos), auditoria |
| 2 | Baixar de novo em menos de 2 min | ✅ "Uma exportacao acabou de ser gerada. Aguarde alguns minutos." |
| 3 | Gil | ✅ "Somente o dono ou quem tem acesso total pode exportar…" |

### L-04 Encerrar a empresa (use uma empresa descartável, ex.: cadastre "QA Encerrar")
| # | Ação | Esperado |
|---|---|---|
| 1 | Admin não-dono | ✅ "Somente o dono da empresa pode encerrar a conta." |
| 2 | Dono → "Encerrar a conta" → nome errado | ✅ botão desabilitado / "Digite o nome da empresa exatamente…" |
| 3 | Senha errada | ✅ "Senha incorreta" |
| 4 | Tudo certo → "Encerrar definitivamente" | ✅ "Conta encerrada. Os dados serão apagados em {data}." e logout |
| 5 | Qualquer membro tenta entrar | ✅ "Tenant suspenso ou inativo" |
| 6 | Console → detalhe | ✅ alerta "Encerramento pedido pelo dono", data da exclusão, motivo |
| 7 | Console → Situação **Ativo** | ✅ alerta some; empresa volta a funcionar (desistência) |
| 8 | Encerrar de novo e **deixar** | ✅ apagada definitivamente em 30 dias (job diário às 05:00). Para conferir no dia, use `ACCOUNT_CLOSURE_GRACE_DAYS=1` em dev |

---

## 10. Matriz final por perfil

Marque ✅/❌ na sua execução.

### Plataforma
| Capacidade | Dono | Suporte | Financeiro | Leitura |
|---|---|---|---|---|
| Login console / trocar senha | | | | |
| Equipe do console | | | | |
| Criar cliente | | | | |
| Situação / plano / massa | | | | |
| Funções por cliente | | | | |
| Entrar como | | | | |
| Planos (editar) | | | | |
| Chamados (responder) | | | | |
| Comunicados (publicar) | | | | |
| Pessoas (ações) | | | | |
| Métricas | | | | |
| Saúde / Auditoria | | | | |

### Empresa
| Capacidade | Dora (dono) | Alex (admin) | Gil (gerente) | Ana (operador) | Bruno/Carla (equipe) | Vera (visualizador) |
|---|---|---|---|---|---|---|
| Entrar em Administração | | | | | | |
| Organização / Plano / Privacidade | | | | | | |
| Usuários / convites | | | | | | |
| Equipes | | | | | | |
| Cargos | | | | | | |
| Tabelas (estrutura) | | | | | | |
| Integrações | | | | | | |
| Ver registros (escopo) | todos | todos | todos | próprios | equipe | todos |
| Criar / editar | | | | | | |
| Excluir / Lixeira | | | | | | |
| Importar / Exportar | | | | | | |
| PDF | | | | | | |
| Chat / comandos | | | | | | |
| Suporte (ver todos) | | | | | | |
| App: dados / chat / offline | | | | | | |
| Transferir dono / encerrar | | | | | | |

---

## 11. Correções feitas (testar como regressão)

Os problemas achados na montagem e na auditoria deste roteiro foram corrigidos (marcados com 🔧 nos passos). Se algum voltar, reporte com o ID.

| # | Onde | O que mudou | Passos |
|---|---|---|---|
| B-01 | Administração › Usuários | Editar a si mesmo (nome) e editar outros sem mudar cargo/situação funcionam; reativar respeita o limite do plano | E-08/14-15b |
| B-02 | Administração › Cargos | Gerente (e quem escolhe cargo em convite, chave de API, link público ou dashboard) vê a lista de cargos | E-20 |
| B-03 | Administração › Usuários | Lista mostra todas as pessoas (sem corte de 20) | crie 21+ |
| B-04 | Web — coringa `*` | Cargos padrão (Gerente, Operador, Visualizador) têm Exportar e a lista de tabelas nos avisos | O-09/8, O-14/6 |
| B-05 | Tabelas | Abas Regras de campo, Filtro global, Automações e Excluir no editor; regras de campo só mudam com "Tabelas: editar" (antes qualquer usuário alterava pela API) | E-06/10-13 |
| B-06 | Cargos | Módulo "Chaves de API" no formulário | E-07/11 |
| B-07 | Dashboards | Tela usa a mesma permissão da API (módulo Painel) | E-20 |
| B-08 | Operação | "Chat" some do menu operacional fora do plano | E-17 |
| B-09 | Operação | Perfil e Configurações abrem para qualquer pessoa | O-03 |
| B-10 | Registros | Colunas salvas; textos de exclusão e do formulário corretos; Desfazer também em sub-registros | O-07, O-08, O-10 |
| B-11 | Sino | Notificações vêm do servidor (recarregar não apaga); lida/remover/limpar persistem | O-14/8 |
| B-12 | Chat web | "Conversa direta" com qualquer colega, com o nome da pessoa | O-12/9 |
| B-13 | App | Filtros na lista; atalho "Novo" e rota de criação respeitam permissão; alteração recusada avisa; push sem registro abre o Dashboard; marcar notificação como lida funciona | M-02, M-03/10, M-04/7, M-06 |
| B-14 | Console | Auditoria traduzida; excluir comunicado pede confirmação | P-13, P-18 |
| B-15 | Console | "Mudar situação → Em teste" não aceita data passada (já na prévia) | P-15/6 |
| B-16 | Cadastro/Login | Dias de teste vêm do servidor; login com link "Criar conta" | E-01, E-02 |
| B-17 | Equipes | Só pessoas ativas, todas (sem corte de 100) | E-10 |
| B-18 | Auditoria (empresa) | "Exportar JSON" respeita os filtros da tela | E-19 |
| B-19 | Automações | Ação `run_script` desligada | E-16 |
| B-20 | Links públicos | Sem cargo de gestão, sem login sem duas etapas, com limite de tentativas; login não altera cargo da empresa | E-13/3, O-18/8-10 |
| B-21 | Limite de tentativas | `refreshToken` no corpo não troca mais a chave | P-01/4b |
| B-22 | Permissão por campo | Negar um campo esconde só aquele campo (API, web e app) | E-07/7, O-06/3 |
| B-23 | Várias empresas | Permissões vêm do cargo na empresa ativa | O-17 |
| B-24 | Vazamentos | PDF, sugestões do chat e arquivados seguem escopo e campos; socket envia só o id e recusa sala alheia | X-01, X-05 |
| B-25 | Console | "Adicionar membro" não muda cargo de quem já é membro; "Entrar como" dura 1 dia e cai com o staff desativado | P-10, P-11/5 |
| B-26 | App | Excluir chega ao servidor; POST idempotente; 401 mantém a fila; "Sair" e sessão encerrada não voltam sozinhos | M-03/11, M-04/9-11, M-07/2b, /8, /9 |
| B-28 | Web | Coluna e formulário escondem o campo negado; idioma mantém a empresa; "Criar e Continuar" abre o editor; lista mostra o rótulo da seleção; data final da auditoria inclui o dia | O-06/3, /6, O-16, E-11/2b, E-19 |
| B-27 | Plano e menus | Desativar ou excluir libera vaga; Gerente exporta; cartões e menu seguem a permissão real | E-08/17-18, O-09/8, O-02, E-20 |

> App (B-13): as mudanças são em Dart e precisam de `flutter analyze` + teste no aparelho (não há Flutter no servidor de build).

---

## 12. Diagnóstico e limpeza

### Consultas úteis (somente leitura, no servidor)
```bash
# Situação e plano das empresas de teste
docker exec crm-postgres-dev psql -U postgres -d crm_builder_dev -c \
  "select name, slug, lifecycle, \"trialEndsAt\" from \"Tenant\" where name like 'QA %' order by 1;"

# Chaves de equipe por pessoa (escopo "Minha equipe" no app)
docker exec crm-postgres-dev psql -U postgres -d crm_builder_dev -c \
  "select u.email, k.key from \"TeamAccessKey\" k join \"User\" u on u.id=k.\"userId\" order by 1;"

# Logs do PowerSync de dev (sync do app)
docker logs --tail 80 crm-powersync-dev
```

| Sintoma | Causa provável |
|---|---|
| App não sincroniza | app apontando para prod (`API_URL`), ou ver `docker logs crm-powersync-dev` |
| Web mostra e app não | filtro de dados/global, primeiro sync em andamento, ou mudança de cargo sem relogar |
| Plano/funções não mudaram | cache de até 30 s; recarregue |
| Comunicado não aparece | cache de até 10 min; recarregue |
| Convite não chega | sem SMTP em dev — use o link copiável |
| Reset de senha não chega | sem SMTP em dev não há link copiável: pule |
| Alteração do app não sobe | ver a fila local em `ps_crud` e `file_upload_queue`; foto quebrada no web guarda `local://` no campo |

### Limpeza
- [ ] Desligar "Exigir 2 etapas" na QA Total; desligar 2 etapas das contas de teste.
- [ ] Revogar chaves de API e excluir o webhook de teste.
- [ ] Console: comunicados de teste → "Tirar do ar" e "Excluir".
- [ ] Console: equipe Sérgio/Fábio/Lia → "Remover".
- [ ] Encerrar as empresas "QA Total" (dono atual, ver E-18) e "QA Console" (admin da P-08) em *Dados e privacidade* — somem em 30 dias. "QA Encerrar" já foi encerrada na L-04/8.
- [ ] Os e-mails ficam ocupados até a purga: a próxima rodada usa aliases novos.
- [ ] Desinstalar o app dos aparelhos de teste: dados locais e senha salva ficam lá.
- [ ] Planos "QA Básico"/"QA Mínimo": desmarcar "Ativo" (não há exclusão de plano).

---

## 13. Smoke e testes automatizados

### Trilha de smoke
Depois de cada deploy, antes do roteiro completo:

`/health` → `P-01/5` → `E-01/5` → `E-08/1-5` → `E-06/1` → `E-07/2` → `E-10/4` → `O-06/4` → `X-01` (Dora, Ana e Bruno) → `M-03/4` → `P-11/1` → `P-16/3`

### Testes de API
Os blocos abaixo rodam sem navegador. Eles montam o próprio cenário, com sufixo novo a cada execução, e recusam o host de produção:

| Bloco | Cobre |
|---|---|
| `e2e/api/visibility.spec.ts` | X-01, X-05 e permissão por campo em lista, leitura por ID, arquivados, PDF e sugestões do chat |
| `e2e/api/platform-permissions.spec.ts` | P-06 direto nas rotas do console |
| `e2e/api/tenant-isolation.spec.ts` | IDs e slug de outra empresa |
| `e2e/api/public-link.spec.ts` | E-13/3, O-18/8-10 |
| `e2e/api/roteiro-flows.spec.ts` | Fluxos com mensagens literais das seções 1, 3, 4, 7, 8 e 9 |
| `e2e/ui/roteiro.spec.ts` e `e2e/ui/roteiro-flows.spec.ts` | Telas, sobre o cenário do seed (`pnpm test:seed`, `pnpm test:ui-roteiro`) |

Resultado da última rodada: `docs/teste-e2e-execucao.md`.

```bash
BASE_URL=https://dev.iossystem.com.br \
PLATFORM_EMAIL=... PLATFORM_PASSWORD=... \
pnpm test:api
```
