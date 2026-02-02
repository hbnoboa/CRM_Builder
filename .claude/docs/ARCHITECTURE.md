# 🏗️ Arquitetura do Sistema

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CRM BUILDER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐         ┌──────────────────┐         ┌─────────────┐ │
│  │   Next.js 14     │   HTTP  │   NestJS 10      │         │ PostgreSQL  │ │
│  │   (Frontend)     │────────▶│   (API)          │────────▶│ 16          │ │
│  │   Port 3000      │   REST  │   Port 3001      │ Prisma  │ Port 5432   │ │
│  └──────────────────┘         └──────────────────┘         └─────────────┘ │
│           │                            │                                    │
│           │ WebSocket                  │                                    │
│           └────────────────────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Camadas da API (NestJS)

```
Request
   │
   ▼
┌─────────────────┐
│   Controller    │  ← Recebe request, valida com DTO
├─────────────────┤
│   Guards        │  ← Autenticação (JWT) + Autorização (Permissions)
├─────────────────┤
│   Service       │  ← Lógica de negócio
├─────────────────┤
│   Repository    │  ← Acesso a dados (Prisma)
├─────────────────┤
│   Database      │  ← PostgreSQL
└─────────────────┘
```

## Módulos da API

```
src/
├── main.ts                 # Bootstrap da aplicação
├── app.module.ts           # Módulo raiz
│
├── common/                 # Código compartilhado
│   ├── decorators/         # @CurrentUser, @RequirePermission
│   ├── guards/             # JwtAuthGuard, PermissionsGuard
│   ├── filters/            # Exception filters
│   ├── interceptors/       # Logging, transform
│   └── pipes/              # Validação
│
├── prisma/                 # Prisma service
│   └── prisma.service.ts
│
└── modules/
    ├── auth/               # Autenticação
    ├── user/               # Gerenciamento de usuários
    ├── tenant/             # Multi-tenancy
    ├── organization/       # Organizações
    ├── workspace/          # Workspaces
    ├── role/               # Roles e permissões
    ├── entity/             # Definição de entidades
    ├── data/               # CRUD dinâmico
    ├── page/               # Pages (Puck)
    ├── custom-api/         # Endpoints customizados
    ├── stats/              # Estatísticas
    ├── upload/             # Upload de arquivos
    ├── notification/       # WebSocket
    └── health/             # Health checks
```

## Modelo de Dados

```
Tenant (Empresa)
│
├── Organizations[] (Filiais)
│   │
│   └── Workspaces[] (Projetos CRM)
│       │
│       ├── Entities[] (Definições)
│       │   └── EntityData[] (Registros)
│       │
│       ├── Pages[] (Puck Builder)
│       │
│       └── CustomEndpoints[] (APIs)
│
├── Users[]
│   └── UserRoles[]
│
└── Roles[]
    └── Permissions (JSON)
```

## Fluxo de Autenticação

```
1. Login (POST /auth/login)
   │
   ▼
2. Valida credenciais
   │
   ▼
3. Gera tokens
   ├── accessToken (15min)
   └── refreshToken (7dias)
   │
   ▼
4. Cliente armazena tokens
   │
   ▼
5. Requests subsequentes
   └── Header: Authorization: Bearer <accessToken>
   │
   ▼
6. Token expirado?
   └── POST /auth/refresh com refreshToken
```

## Fluxo de Permissões

```
Request chega
     │
     ▼
JwtAuthGuard
     │ Valida token JWT
     ▼
PermissionsGuard
     │
     ▼
Extrai @RequirePermission('recurso', 'ação', 'escopo')
     │
     ▼
Busca permissões do usuário (role + roles adicionais)
     │
     ▼
Verifica se tem permissão
     │
     ├── ✅ Permite → Controller executa
     │
     └── ❌ Nega → 403 Forbidden
```

## Formato de Permissões

```
{recurso}:{ação}:{escopo}

Recursos: cliente, produto, venda, user, role, entity, etc
Ações: create, read, update, delete, export, import, manage
Escopos: all, team, own, none

Exemplos:
- cliente:read:all     → Ver todos os clientes
- cliente:update:own   → Editar apenas seus clientes
- *:manage:all         → Admin total
```

## Frontend (Next.js)

```
src/
├── app/                    # App Router
│   ├── (auth)/            # Rotas públicas
│   │   ├── login/
│   │   └── register/
│   │
│   ├── (dashboard)/       # Rotas protegidas
│   │   ├── layout.tsx     # Layout com sidebar
│   │   ├── dashboard/
│   │   ├── data/[entity]/
│   │   ├── entities/
│   │   ├── pages/
│   │   ├── apis/
│   │   ├── users/
│   │   └── settings/
│   │
│   ├── layout.tsx         # Root layout
│   └── globals.css
│
├── components/
│   ├── ui/                # shadcn/ui
│   └── shared/            # Componentes do app
│
├── hooks/                 # Custom hooks
├── lib/                   # Utilitários
├── providers/             # Context providers
├── services/              # API calls
├── stores/                # Zustand stores
└── types/                 # TypeScript
```

## Comunicação Frontend ↔ API

```typescript
// lib/api.ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + '/api/v1'
});

// Interceptor adiciona token automaticamente
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor trata refresh de token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Tenta refresh
      // Se falhar, redireciona para login
    }
    return Promise.reject(error);
  }
);
```

## WebSocket (Notificações)

```typescript
// Cliente
const socket = io(API_URL, {
  auth: { token: accessToken }
});

socket.on('notification', (data) => {
  // Mostra notificação
});

// Servidor
@WebSocketGateway()
export class NotificationGateway {
  @SubscribeMessage('subscribe')
  handleSubscribe(client, payload) {
    client.join(`tenant:${payload.tenantId}`);
  }
  
  notifyTenant(tenantId: string, message: any) {
    this.server.to(`tenant:${tenantId}`).emit('notification', message);
  }
}
```
