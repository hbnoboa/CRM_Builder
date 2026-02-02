# 🤖 CRM Builder - Instruções para Claude

## Sobre Este Projeto

O **CRM Builder** é uma plataforma SaaS multi-tenant que permite criar CRMs personalizados com:
- Entidades dinâmicas (sem código)
- Sistema de permissões granular (RBAC)
- Page Builder com Puck
- API Builder para endpoints customizados

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| **Backend** | NestJS 10 + Prisma 5 + PostgreSQL 16 |
| **Frontend** | Next.js 14 (App Router) + shadcn/ui + Tailwind |
| **State** | TanStack Query + Zustand |
| **Auth** | JWT + Refresh Tokens |
| **Realtime** | Socket.IO |
| **Monorepo** | pnpm + Turborepo |

## Arquitetura Multi-Tenant

```
Tenant (Empresa)
  └── Organization (Filial/Departamento)
       └── Workspace (Projeto/CRM)
            ├── Entities (Definições)
            ├── EntityData (Dados)
            ├── Pages (Puck)
            └── CustomEndpoints (APIs)
```

## Hierarquia de Usuários

1. **PLATFORM_ADMIN** - Super admin da plataforma
2. **ADMIN** - Admin do tenant
3. **MANAGER** - Gerente (vê equipe)
4. **USER** - Usuário padrão (vê próprios)
5. **VIEWER** - Apenas visualização

## Comandos Principais

```bash
# Desenvolvimento
pnpm dev              # Roda tudo
pnpm dev:api          # Só API
pnpm dev:admin        # Só frontend

# Banco de dados
pnpm db:migrate       # Criar migration
pnpm db:push          # Push direto (dev)
pnpm db:seed          # Popular banco
pnpm db:studio        # Prisma Studio

# Docker
pnpm docker:up        # Subir PostgreSQL + Redis
pnpm docker:down      # Parar containers
```

## Regras Gerais

1. **Sempre use TypeScript** - Nunca JavaScript puro
2. **Validação com Zod** - Frontend e backend
3. **class-validator no NestJS** - DTOs sempre validados
4. **Multi-tenancy obrigatório** - Sempre filtrar por tenantId
5. **Permissões em tudo** - Usar guards e decorators

## Referências

- Documentação: `.claude/docs/`
- Regras de código: `.claude/rules/`
- Skills (como fazer): `.claude/skills/`
- Comandos customizados: `.claude/commands/`
