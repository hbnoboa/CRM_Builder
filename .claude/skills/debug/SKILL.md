# 🐛 Skill: Debug

## Quando Usar
Quando algo não está funcionando como esperado.

## Debug por Área

### 🔐 Autenticação

**Sintomas:**
- "Unauthorized" (401)
- Token expirado
- Login não funciona

**Verificações:**

```bash
# 1. Testar login direto na API
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}'

# 2. Verificar se token é válido
# Copie o accessToken e decodifique em jwt.io

# 3. Verificar variáveis de ambiente
echo $JWT_SECRET
echo $JWT_EXPIRES_IN

# 4. Verificar se usuário existe no banco
docker exec -it crm-postgres psql -U postgres -d crm_builder \
  -c "SELECT id, email, status FROM \"User\" WHERE email = 'admin@demo.com'"
```

**Soluções comuns:**
- Token expirado → Fazer refresh ou login novamente
- Secret diferente → Verificar se frontend e backend usam mesmo `.env`
- Usuário não existe → Rodar seed: `pnpm db:seed`

---

### 🗄️ Banco de Dados

**Sintomas:**
- "Cannot connect to database"
- Queries lentas
- Dados não aparecem

**Verificações:**

```bash
# 1. Verificar se container está rodando
docker ps | grep postgres

# 2. Testar conexão
docker exec -it crm-postgres psql -U postgres -d crm_builder -c "SELECT 1"

# 3. Ver logs do container
docker logs crm-postgres

# 4. Verificar DATABASE_URL
cat apps/api/.env | grep DATABASE_URL

# 5. Testar conexão via Prisma
cd apps/api && npx prisma db pull

# 6. Abrir Prisma Studio
pnpm db:studio
```

**Soluções comuns:**
- Container parado → `pnpm docker:up`
- DATABASE_URL errada → Corrigir no `.env`
- Schema desatualizado → `pnpm db:push` ou `pnpm db:migrate`

---

### 🌐 API (NestJS)

**Sintomas:**
- 500 Internal Server Error
- Endpoint não encontrado (404)
- Resposta inesperada

**Verificações:**

```bash
# 1. Verificar logs da API
# (se rodando com pnpm dev:api, ver terminal)

# 2. Verificar se API está rodando
curl http://localhost:3001/api/v1/health

# 3. Testar endpoint específico
curl -X GET http://localhost:3001/api/v1/users \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Ver documentação Swagger
# Abrir http://localhost:3001/docs

# 5. Verificar erros de TypeScript
cd apps/api && pnpm exec tsc --noEmit
```

**Soluções comuns:**
- Import errado → Verificar paths no tsconfig
- Service não injetado → Verificar module imports/exports
- DTO inválido → Verificar validação class-validator

---

### 🎨 Frontend (Next.js)

**Sintomas:**
- Página em branco
- Erro de hydration
- Componente não renderiza

**Verificações:**

```bash
# 1. Verificar console do browser (F12)

# 2. Verificar logs do terminal Next.js

# 3. Verificar variáveis de ambiente
cat apps/web-admin/.env.local

# 4. Limpar cache
cd apps/web-admin && rm -rf .next && pnpm dev

# 5. Verificar TypeScript
cd apps/web-admin && pnpm exec tsc --noEmit
```

**Soluções comuns:**
- Hydration error → Verificar uso de `'use client'`
- API_URL undefined → Verificar `NEXT_PUBLIC_` prefix
- Módulo não encontrado → `pnpm install`

---

### 🔑 Permissões

**Sintomas:**
- "Forbidden" (403)
- Botão/menu não aparece
- Ação bloqueada

**Verificações:**

```bash
# 1. Verificar role do usuário
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.role'

# 2. Verificar permissões da role
docker exec -it crm-postgres psql -U postgres -d crm_builder \
  -c "SELECT permissions FROM \"Role\" WHERE slug = 'admin'"

# 3. Verificar decorator no controller
# Procurar por @RequirePermission no código

# 4. Debug no PermissionService
# Adicionar console.log temporário
```

**Soluções comuns:**
- Role sem permissão → Adicionar permissão no seed/database
- Escopo errado → Verificar se é `all`, `team` ou `own`
- Guard não aplicado → Verificar `@UseGuards()` no controller

---

### 🔌 WebSocket

**Sintomas:**
- Notificações não chegam
- Conexão não estabelece
- Desconecta frequentemente

**Verificações:**

```bash
# 1. Verificar se gateway está registrado
# Ver logs de "WebSocket Gateway initialized"

# 2. Testar conexão manual
# No console do browser:
const socket = io('http://localhost:3001', { 
  auth: { token: 'SEU_TOKEN' } 
});
socket.on('connect', () => console.log('Conectado!'));
socket.on('error', (e) => console.error(e));

# 3. Verificar CORS
# WebSocket precisa estar nas origins permitidas
```

**Soluções comuns:**
- Token não enviado → Verificar `auth` na conexão
- CORS blocking → Adicionar origin no CORS config
- Porta bloqueada → Verificar firewall

---

## Comandos Úteis

```bash
# Reiniciar tudo
pnpm docker:down && pnpm docker:up && pnpm dev

# Limpar e reinstalar
pnpm clean && pnpm install

# Reset completo do banco
pnpm --filter api prisma migrate reset

# Ver todos os logs
pnpm docker:logs

# Verificar portas em uso
lsof -i :3000
lsof -i :3001
lsof -i :5432
```

## Logs Importantes

```typescript
// Adicionar logs temporários para debug
console.log('🔍 Debug:', { 
  user, 
  tenantId: user.tenantId, 
  permissions: user.permissions 
});

// Remover depois de resolver!
```
