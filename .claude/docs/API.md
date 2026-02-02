# 📚 Documentação da API

## Base URL

```
Desenvolvimento: http://localhost:3001/api/v1
Produção: https://api.seudominio.com/api/v1
```

## Autenticação

Todas as rotas (exceto auth) requerem header:
```
Authorization: Bearer <access_token>
```

---

## 🔐 Auth

### POST /auth/register
Registra novo usuário e tenant.

**Request:**
```json
{
  "email": "admin@empresa.com",
  "password": "senha123",
  "name": "Nome do Admin",
  "tenantName": "Minha Empresa"
}
```

**Response:** `201 Created`
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { ... }
}
```

### POST /auth/login
Autentica usuário existente.

**Request:**
```json
{
  "email": "admin@empresa.com",
  "password": "senha123"
}
```

### POST /auth/refresh
Renova tokens.

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

### GET /auth/me
Retorna usuário autenticado.

---

## 👥 Users

### GET /users
Lista usuários do tenant.

**Query params:**
- `page` (default: 1)
- `limit` (default: 20)
- `search` (busca por nome/email)
- `role` (filtro por role)
- `status` (ACTIVE, INACTIVE)

### POST /users
Cria novo usuário.

**Request:**
```json
{
  "email": "user@empresa.com",
  "password": "senha123",
  "name": "Nome",
  "role": "USER",
  "organizationId": "org_xxx"
}
```

### GET /users/:id
Detalhes do usuário.

### PATCH /users/:id
Atualiza usuário.

### DELETE /users/:id
Remove usuário (soft delete).

---

## 🏢 Tenants

### GET /tenants
Lista tenants (apenas PLATFORM_ADMIN).

### POST /tenants
Cria tenant.

### GET /tenants/:id
Detalhes do tenant.

### PATCH /tenants/:id
Atualiza tenant.

### PATCH /tenants/:id/suspend
Suspende tenant.

### PATCH /tenants/:id/activate
Reativa tenant.

---

## 🏛️ Organizations

### GET /organizations
Lista organizações do tenant.

### POST /organizations
Cria organização.

### GET /organizations/:id
Detalhes.

### PATCH /organizations/:id
Atualiza.

### DELETE /organizations/:id
Remove.

---

## 📂 Workspaces

### GET /workspaces
Lista workspaces da organização.

### POST /workspaces
Cria workspace.

### GET /workspaces/:id
Detalhes.

### PATCH /workspaces/:id
Atualiza.

### DELETE /workspaces/:id
Remove.

---

## 📋 Entities

### GET /entities
Lista entidades do workspace.

### POST /entities
Cria entidade.

**Request:**
```json
{
  "name": "Cliente",
  "namePlural": "Clientes",
  "slug": "cliente",
  "icon": "users",
  "color": "#3B82F6",
  "fields": [
    {
      "slug": "nome",
      "name": "Nome",
      "type": "text",
      "required": true
    },
    {
      "slug": "email",
      "name": "E-mail",
      "type": "email",
      "required": true
    }
  ]
}
```

### GET /entities/:id
Detalhes da entidade.

### PATCH /entities/:id
Atualiza entidade.

### DELETE /entities/:id
Remove entidade.

---

## 📊 Data (CRUD Dinâmico)

### GET /data/:entitySlug
Lista dados da entidade.

**Query params:**
- `page`, `limit` - Paginação
- `sort`, `order` - Ordenação
- `search` - Busca
- `filters` - JSON de filtros

### POST /data/:entitySlug
Cria registro.

**Request:**
```json
{
  "nome": "João Silva",
  "email": "joao@email.com"
}
```

### GET /data/:entitySlug/:id
Detalhes do registro.

### PATCH /data/:entitySlug/:id
Atualiza registro.

### DELETE /data/:entitySlug/:id
Remove registro.

---

## 🔐 Roles

### GET /roles
Lista roles do tenant.

### POST /roles
Cria role customizada.

**Request:**
```json
{
  "name": "Vendedor",
  "slug": "vendedor",
  "permissions": [
    "cliente:read:team",
    "cliente:create:all",
    "cliente:update:own"
  ]
}
```

### PATCH /roles/:id
Atualiza role.

### DELETE /roles/:id
Remove role (não-sistema).

---

## 📄 Pages

### GET /pages
Lista páginas do workspace.

### POST /pages
Cria página.

### GET /pages/:id
Detalhes.

### PATCH /pages/:id
Atualiza (conteúdo Puck).

### POST /pages/:id/publish
Publica página.

---

## 🔌 Custom Endpoints

### GET /custom-api
Lista endpoints customizados.

### POST /custom-api
Cria endpoint.

### GET /custom-api/:id
Detalhes.

### PATCH /custom-api/:id
Atualiza.

### POST /custom-api/:id/test
Testa endpoint.

---

## 📈 Stats

### GET /stats/dashboard
Estatísticas do dashboard.

**Response:**
```json
{
  "totalUsers": 15,
  "totalEntities": 4,
  "totalRecords": 1250,
  "recentActivity": [...]
}
```

### GET /stats/entity/:slug
Estatísticas de uma entidade.

---

## 📤 Upload

### POST /upload
Upload de arquivo.

**Request:** `multipart/form-data`
- `file` - Arquivo
- `folder` - Pasta destino (opcional)

**Response:**
```json
{
  "url": "https://storage.../file.jpg",
  "filename": "file.jpg",
  "size": 12345,
  "mimeType": "image/jpeg"
}
```

---

## ❤️ Health

### GET /health
Health check básico.

### GET /health/ready
Readiness check (inclui DB).
