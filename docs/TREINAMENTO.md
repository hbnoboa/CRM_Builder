# 📚 Manual de Treinamento - CRM Builder

## Índice

1. [Introdução](#introdução)
2. [Tipos de Usuários e Permissões](#tipos-de-usuários-e-permissões)
3. [Acesso ao Sistema](#acesso-ao-sistema)
4. [Guia por Perfil de Usuário](#guia-por-perfil-de-usuário)
   - [PLATFORM_ADMIN (Super Administrador)](#platform_admin-super-administrador)
   - [ADMIN (Administrador do Tenant)](#admin-administrador-do-tenant)
   - [MANAGER (Gerente)](#manager-gerente)
   - [USER (Usuário)](#user-usuário)
   - [VIEWER (Visualizador)](#viewer-visualizador)
5. [Funcionalidades Principais](#funcionalidades-principais)
6. [Operações CRUD](#operações-crud)
7. [Boas Práticas](#boas-práticas)

---

## Introdução

O **CRM Builder** é uma plataforma de construção de CRMs dinâmicos que permite criar e gerenciar entidades, páginas personalizadas e APIs customizadas. Este manual foi criado para orientar novos usuários sobre como utilizar todas as funcionalidades do sistema.

### URLs de Acesso

| Ambiente | URL |
|----------|-----|
| **Aplicação Web** | http://localhost:3000 |
| **API Backend** | http://localhost:3001/api/v1 |
| **Documentação API** | http://localhost:3001/docs |

---

## Tipos de Usuários e Permissões

O sistema possui **5 níveis de acesso**, cada um com permissões específicas:

| Cargo | Nível | Descrição |
|-------|-------|-----------|
| **PLATFORM_ADMIN** | 🔴 Máximo | Super administrador da plataforma. Gerencia todos os tenants. |
| **ADMIN** | 🟠 Alto | Administrador do tenant. Gerencia organizações, usuários e configurações. |
| **MANAGER** | 🟡 Médio | Gerente de equipe. Gerencia usuários da sua organização. |
| **USER** | 🟢 Básico | Usuário operacional. Cria e edita registros de dados. |
| **VIEWER** | 🔵 Mínimo | Apenas visualização. Não pode criar ou editar dados. |

### Matriz de Permissões

| Funcionalidade | PLATFORM_ADMIN | ADMIN | MANAGER | USER | VIEWER |
|----------------|----------------|-------|---------|------|--------|
| Gerenciar Tenants | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gerenciar Organizações | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gerenciar Usuários | ✅ | ✅ | ✅* | ❌ | ❌ |
| Criar Entidades | ✅ | ✅ | ❌ | ❌ | ❌ |
| Criar Páginas | ✅ | ✅ | ✅ | ❌ | ❌ |
| Criar APIs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Criar/Editar Dados | ✅ | ✅ | ✅ | ✅ | ❌ |
| Visualizar Dados | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |

> *MANAGER só gerencia usuários da sua própria organização

---

## Acesso ao Sistema

### Credenciais de Demonstração

| Cargo | Email | Senha |
|-------|-------|-------|
| PLATFORM_ADMIN | superadmin@platform.com | superadmin123 |
| ADMIN | admin@demo.com | admin123 |
| MANAGER | gerente@demo.com | gerente123 |
| USER | vendedor@demo.com | vendedor123 |
| VIEWER | viewer@demo.com | viewer123 |

### Passo a Passo - Login

1. Acesse a URL da aplicação: `http://localhost:3000/login`
2. Insira seu **email** no campo correspondente
3. Insira sua **senha**
4. Clique no botão **"Entrar"**
5. Você será redirecionado para o **Dashboard**

![Login](screenshots/login.png)

---

## Guia por Perfil de Usuário

---

### PLATFORM_ADMIN (Super Administrador)

O **PLATFORM_ADMIN** é o nível mais alto de acesso. Ele gerencia toda a plataforma, incluindo todos os tenants (clientes).

#### Funcionalidades Exclusivas

1. **Gerenciamento de Tenants**
2. **Visualização de estatísticas globais**
3. **Acesso a todos os recursos de todos os tenants**

#### Tutorial: Criar um Novo Tenant

```
1. Faça login como PLATFORM_ADMIN
2. No menu lateral, clique em "Tenants"
3. Clique no botão "+ Novo Tenant"
4. Preencha os dados:
   - Nome: Nome da empresa cliente
   - Slug: identificador-unico (sem espaços, minúsculas)
   - Plano: STARTER, PROFESSIONAL ou ENTERPRISE
   - Email do Admin: email do primeiro administrador
   - Nome do Admin: nome do administrador
   - Senha do Admin: senha inicial
5. Clique em "Criar Tenant"
```

#### Exemplo via API (cURL)

```bash
# Login para obter token
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@platform.com","password":"superadmin123"}' \
  | jq -r '.accessToken')

# Criar tenant
curl -X POST http://localhost:3001/api/v1/tenants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nova Empresa",
    "slug": "nova-empresa",
    "plan": "PROFESSIONAL",
    "adminEmail": "admin@novaempresa.com",
    "adminName": "Admin Nova Empresa",
    "adminPassword": "senha123456"
  }'

# Listar todos os tenants
curl -X GET http://localhost:3001/api/v1/tenants \
  -H "Authorization: Bearer $TOKEN"

# Suspender tenant
curl -X PATCH http://localhost:3001/api/v1/tenants/{id}/suspend \
  -H "Authorization: Bearer $TOKEN"

# Ativar tenant
curl -X PATCH http://localhost:3001/api/v1/tenants/{id}/activate \
  -H "Authorization: Bearer $TOKEN"

# Excluir tenant
curl -X DELETE http://localhost:3001/api/v1/tenants/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### ADMIN (Administrador do Tenant)

O **ADMIN** é o administrador principal de um tenant (empresa). Ele gerencia toda a estrutura do CRM.

#### Funcionalidades

1. **Gerenciar Organizações**
2. **Gerenciar Usuários**
3. **Criar e Configurar Entidades**
4. **Criar Páginas Personalizadas**
5. **Criar APIs Customizadas**
6. **Configurar Roles e Permissões**

---

#### Tutorial: Criar uma Entidade

Entidades são como "tabelas" do seu CRM. Por exemplo: Clientes, Produtos, Pedidos.

```
1. Faça login como ADMIN
2. No menu lateral, clique em "Entidades"
3. Clique em "+ Nova Entidade"
4. Preencha os dados:
   - Nome: Clientes (singular)
   - Slug: clientes (identificador único)
   - Descrição: Cadastro de clientes
   - Ícone: users
5. Adicione os campos:
   - nome (Texto, Obrigatório)
   - email (Email, Obrigatório)
   - telefone (Texto)
   - cidade (Texto)
   - valor_contrato (Número)
   - ativo (Booleano)
6. Clique em "Salvar"
```

#### Exemplo via API - CRUD de Entidades

```bash
# Login como ADMIN
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}' \
  | jq -r '.accessToken')

# CREATE - Criar entidade
curl -X POST http://localhost:3001/api/v1/entities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Clientes",
    "slug": "clientes",
    "description": "Cadastro de clientes",
    "icon": "users",
    "fields": [
      {"name": "nome", "label": "Nome", "type": "text", "required": true},
      {"name": "email", "label": "Email", "type": "email", "required": true},
      {"name": "telefone", "label": "Telefone", "type": "text"},
      {"name": "cidade", "label": "Cidade", "type": "text"},
      {"name": "valor_contrato", "label": "Valor Contrato", "type": "number"},
      {"name": "ativo", "label": "Ativo", "type": "boolean"}
    ]
  }'

# READ - Listar entidades
curl -X GET http://localhost:3001/api/v1/entities \
  -H "Authorization: Bearer $TOKEN"

# READ - Buscar entidade por ID
curl -X GET http://localhost:3001/api/v1/entities/{id} \
  -H "Authorization: Bearer $TOKEN"

# READ - Buscar entidade por slug
curl -X GET http://localhost:3001/api/v1/entities/slug/clientes \
  -H "Authorization: Bearer $TOKEN"

# UPDATE - Atualizar entidade
curl -X PUT http://localhost:3001/api/v1/entities/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Cadastro completo de clientes"
  }'

# DELETE - Excluir entidade
curl -X DELETE http://localhost:3001/api/v1/entities/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Tutorial: Criar Registros de Dados

Após criar uma entidade, você pode adicionar registros (dados).

```
1. No menu lateral, clique em "Dados"
2. Selecione a entidade (ex: Clientes)
3. Clique em "+ Novo Registro"
4. Preencha os campos definidos na entidade
5. Clique em "Salvar"
```

#### Exemplo via API - CRUD de Dados

```bash
# Primeiro, obtenha o workspaceId e o slug da entidade
# (você pode pegar do retorno da listagem de entidades)
WORKSPACE_ID="cml2i0hw4000bzf7yc8bfptby"
ENTITY_SLUG="clientes"

# CREATE - Criar registro
curl -X POST "http://localhost:3001/api/v1/data/${WORKSPACE_ID}/${ENTITY_SLUG}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "nome": "João Silva",
      "email": "joao@email.com",
      "telefone": "(11) 99999-9999",
      "cidade": "São Paulo",
      "valor_contrato": 5000.00,
      "ativo": true
    }
  }'

# READ - Listar registros
curl -X GET "http://localhost:3001/api/v1/data/${WORKSPACE_ID}/${ENTITY_SLUG}" \
  -H "Authorization: Bearer $TOKEN"

# READ - Buscar registro por ID
curl -X GET "http://localhost:3001/api/v1/data/${WORKSPACE_ID}/${ENTITY_SLUG}/{recordId}" \
  -H "Authorization: Bearer $TOKEN"

# UPDATE - Atualizar registro
curl -X PUT "http://localhost:3001/api/v1/data/${WORKSPACE_ID}/${ENTITY_SLUG}/{recordId}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "nome": "João Silva Santos",
      "valor_contrato": 7500.00
    }
  }'

# DELETE - Excluir registro
curl -X DELETE "http://localhost:3001/api/v1/data/${WORKSPACE_ID}/${ENTITY_SLUG}/{recordId}" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Tutorial: Criar Páginas Personalizadas

Páginas permitem criar interfaces customizadas usando um editor visual.

```
1. No menu lateral, clique em "Páginas"
2. Clique em "+ Nova Página"
3. Preencha:
   - Título: Dashboard de Vendas
   - Slug: dashboard-vendas
   - Descrição: Painel de indicadores de vendas
4. Use o editor visual para montar a página
5. Clique em "Salvar"
6. Para publicar, clique em "Publicar"
```

#### Exemplo via API - CRUD de Páginas

```bash
# CREATE - Criar página
curl -X POST http://localhost:3001/api/v1/pages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Dashboard de Vendas",
    "slug": "dashboard-vendas",
    "description": "Painel de indicadores",
    "content": {"root": {"children": []}},
    "isPublished": false
  }'

# READ - Listar páginas
curl -X GET http://localhost:3001/api/v1/pages \
  -H "Authorization: Bearer $TOKEN"

# READ - Buscar página por ID
curl -X GET http://localhost:3001/api/v1/pages/{id} \
  -H "Authorization: Bearer $TOKEN"

# READ - Buscar página por slug
curl -X GET http://localhost:3001/api/v1/pages/slug/dashboard-vendas \
  -H "Authorization: Bearer $TOKEN"

# UPDATE - Atualizar página
curl -X PUT http://localhost:3001/api/v1/pages/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Painel completo de indicadores"
  }'

# PUBLISH - Publicar página
curl -X PATCH http://localhost:3001/api/v1/pages/{id}/publish \
  -H "Authorization: Bearer $TOKEN"

# UNPUBLISH - Despublicar página
curl -X PATCH http://localhost:3001/api/v1/pages/{id}/unpublish \
  -H "Authorization: Bearer $TOKEN"

# DUPLICATE - Duplicar página
curl -X POST http://localhost:3001/api/v1/pages/{id}/duplicate \
  -H "Authorization: Bearer $TOKEN"

# DELETE - Excluir página
curl -X DELETE http://localhost:3001/api/v1/pages/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Tutorial: Criar APIs Customizadas

APIs customizadas permitem criar endpoints personalizados.

```
1. No menu lateral, clique em "APIs"
2. Clique em "+ Nova API"
3. Preencha:
   - Nome: Buscar Top Clientes
   - Path: /top-clientes
   - Método: GET
4. Configure a lógica da API
5. Clique em "Salvar"
```

#### Exemplo via API - CRUD de Custom APIs

```bash
# CREATE - Criar API customizada
curl -X POST http://localhost:3001/api/v1/custom-apis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Top Clientes",
    "path": "/top-clientes",
    "method": "GET"
  }'

# READ - Listar APIs
curl -X GET http://localhost:3001/api/v1/custom-apis \
  -H "Authorization: Bearer $TOKEN"

# READ - Buscar API por ID
curl -X GET http://localhost:3001/api/v1/custom-apis/{id} \
  -H "Authorization: Bearer $TOKEN"

# UPDATE - Atualizar API
curl -X PUT http://localhost:3001/api/v1/custom-apis/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Top 10 Clientes"
  }'

# TOGGLE - Ativar/Desativar API
curl -X PATCH http://localhost:3001/api/v1/custom-apis/{id}/toggle \
  -H "Authorization: Bearer $TOKEN"

# DELETE - Excluir API
curl -X DELETE http://localhost:3001/api/v1/custom-apis/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Tutorial: Gerenciar Usuários

```
1. No menu lateral, clique em "Usuários"
2. Clique em "+ Novo Usuário"
3. Preencha:
   - Nome: Maria Santos
   - Email: maria@empresa.com
   - Senha: senha123
   - Cargo: USER
4. Clique em "Criar"
```

#### Exemplo via API - CRUD de Usuários

```bash
# CREATE - Criar usuário
curl -X POST http://localhost:3001/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Santos",
    "email": "maria@empresa.com",
    "password": "senha123456",
    "role": "USER"
  }'

# READ - Listar usuários
curl -X GET http://localhost:3001/api/v1/users \
  -H "Authorization: Bearer $TOKEN"

# READ - Buscar usuário por ID
curl -X GET http://localhost:3001/api/v1/users/{id} \
  -H "Authorization: Bearer $TOKEN"

# READ - Meu perfil
curl -X GET http://localhost:3001/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN"

# UPDATE - Atualizar meu perfil
curl -X PUT http://localhost:3001/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Novo Nome"
  }'

# UPDATE - Atualizar usuário por ID
curl -X PUT http://localhost:3001/api/v1/users/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nome Atualizado"
  }'

# DELETE - Excluir usuário
curl -X DELETE http://localhost:3001/api/v1/users/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Tutorial: Gerenciar Organizações

```
1. No menu lateral, clique em "Organização"
2. Clique em "+ Nova Organização"
3. Preencha:
   - Nome: Filial São Paulo
   - Slug: filial-sp
4. Clique em "Criar"
```

#### Exemplo via API - CRUD de Organizações

```bash
# CREATE - Criar organização
curl -X POST http://localhost:3001/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Filial São Paulo",
    "slug": "filial-sp"
  }'

# READ - Listar organizações
curl -X GET http://localhost:3001/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN"

# READ - Buscar organização por ID
curl -X GET http://localhost:3001/api/v1/organizations/{id} \
  -H "Authorization: Bearer $TOKEN"

# UPDATE - Atualizar organização
curl -X PUT http://localhost:3001/api/v1/organizations/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Filial São Paulo - Centro"
  }'

# DELETE - Excluir organização
curl -X DELETE http://localhost:3001/api/v1/organizations/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Tutorial: Gerenciar Roles (Papéis)

```
1. No menu lateral, clique em "Configurações" > "Roles"
2. Clique em "+ Nova Role"
3. Preencha:
   - Nome: Supervisor de Vendas
   - Descrição: Acesso a relatórios de vendas
   - Permissões: selecione as permissões desejadas
4. Clique em "Criar"
```

#### Exemplo via API - CRUD de Roles

```bash
# CREATE - Criar role
curl -X POST http://localhost:3001/api/v1/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Supervisor de Vendas",
    "description": "Acesso a relatórios de vendas",
    "permissions": ["read:data", "read:entities", "read:stats"]
  }'

# READ - Listar roles
curl -X GET http://localhost:3001/api/v1/roles \
  -H "Authorization: Bearer $TOKEN"

# READ - Buscar role por ID
curl -X GET http://localhost:3001/api/v1/roles/{id} \
  -H "Authorization: Bearer $TOKEN"

# UPDATE - Atualizar role
curl -X PUT http://localhost:3001/api/v1/roles/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Acesso completo a relatórios de vendas"
  }'

# DELETE - Excluir role
curl -X DELETE http://localhost:3001/api/v1/roles/{id} \
  -H "Authorization: Bearer $TOKEN"
```

---

### MANAGER (Gerente)

O **MANAGER** gerencia sua equipe e pode criar páginas.

#### Funcionalidades

1. **Gerenciar usuários da sua organização**
2. **Criar e editar páginas**
3. **Criar e editar registros de dados**
4. **Visualizar dashboards e relatórios**

#### Limitações

- ❌ Não pode criar entidades
- ❌ Não pode criar APIs
- ❌ Não pode gerenciar usuários de outras organizações

#### Tutorial: Gerenciar Equipe

```
1. Faça login como MANAGER
2. No menu lateral, clique em "Usuários"
3. Você verá apenas os usuários da sua organização
4. Pode editar dados e alterar status
```

---

### USER (Usuário)

O **USER** é o usuário operacional do dia a dia.

#### Funcionalidades

1. **Criar e editar registros de dados**
2. **Visualizar entidades e dados**
3. **Visualizar páginas**
4. **Editar seu próprio perfil**

#### Limitações

- ❌ Não pode criar entidades, páginas ou APIs
- ❌ Não pode gerenciar usuários
- ❌ Não pode alterar configurações

#### Tutorial: Adicionar um Registro

```
1. Faça login como USER
2. No menu lateral, clique em "Dados"
3. Selecione a entidade desejada
4. Clique em "+ Novo Registro"
5. Preencha os campos
6. Clique em "Salvar"
```

---

### VIEWER (Visualizador)

O **VIEWER** tem acesso apenas para leitura.

#### Funcionalidades

1. **Visualizar dados**
2. **Visualizar dashboards**
3. **Visualizar páginas publicadas**

#### Limitações

- ❌ Não pode criar nada
- ❌ Não pode editar nada
- ❌ Não pode excluir nada

---

## Funcionalidades Principais

### Dashboard

O Dashboard mostra estatísticas gerais:

- Total de Entidades
- Total de Registros
- Total de Páginas
- Atividade Recente

```bash
# Obter estatísticas do dashboard
curl -X GET http://localhost:3001/api/v1/stats/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Obter registros ao longo do tempo
curl -X GET "http://localhost:3001/api/v1/stats/records-over-time?days=30" \
  -H "Authorization: Bearer $TOKEN"

# Obter distribuição por entidade
curl -X GET http://localhost:3001/api/v1/stats/entities-distribution \
  -H "Authorization: Bearer $TOKEN"
```

### Autenticação

```bash
# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}'

# Obter perfil atual
curl -X GET http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Refresh token
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"seu_refresh_token"}'

# Logout
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### Permissões

```bash
# Listar todas as permissões disponíveis
curl -X GET http://localhost:3001/api/v1/permissions \
  -H "Authorization: Bearer $TOKEN"

# Obter minhas permissões
curl -X GET http://localhost:3001/api/v1/permissions/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Operações CRUD

### Resumo de Endpoints

| Recurso | CREATE | READ | UPDATE | DELETE |
|---------|--------|------|--------|--------|
| Tenants | POST /tenants | GET /tenants | PUT /tenants/:id | DELETE /tenants/:id |
| Organizations | POST /organizations | GET /organizations | PUT /organizations/:id | DELETE /organizations/:id |
| Users | POST /users | GET /users | PUT /users/:id | DELETE /users/:id |
| Roles | POST /roles | GET /roles | PUT /roles/:id | DELETE /roles/:id |
| Entities | POST /entities | GET /entities | PUT /entities/:id | DELETE /entities/:id |
| Data | POST /data/:workspace/:entity | GET /data/:workspace/:entity | PUT /data/:workspace/:entity/:id | DELETE /data/:workspace/:entity/:id |
| Pages | POST /pages | GET /pages | PUT /pages/:id | DELETE /pages/:id |
| Custom APIs | POST /custom-apis | GET /custom-apis | PUT /custom-apis/:id | DELETE /custom-apis/:id |

---

## Boas Práticas

### Segurança

1. ✅ Use senhas fortes (mínimo 8 caracteres)
2. ✅ Não compartilhe suas credenciais
3. ✅ Faça logout ao sair
4. ✅ Use HTTPS em produção

### Nomenclatura

1. ✅ Use slugs descritivos (ex: `clientes`, `pedidos-venda`)
2. ✅ Use nomes em português para entidades
3. ✅ Evite caracteres especiais em slugs

### Organização

1. ✅ Crie entidades relacionadas (Cliente → Pedido → Item)
2. ✅ Configure campos obrigatórios
3. ✅ Use descrições claras

---

## Suporte

Em caso de dúvidas:

- 📧 Email: suporte@crmbuilder.com
- 📖 Documentação API: http://localhost:3001/docs
- 🐛 Issues: GitHub

---

**Versão do Manual:** 1.0  
**Última atualização:** Fevereiro 2026
