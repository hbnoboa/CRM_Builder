# WebSocket Real-Time Updates - Debug Guide

## Arquitetura

### Fluxo Completo

```
User modifies data
↓
data.service.ts (create/update/delete)
↓
notificationService.emitDataChanged()
↓
notificationGateway.emitDataChanged()
↓
Socket.IO emit('data-changed') → tenant:${tenantId} room
↓
Frontend NotificationProvider receives 'data-changed'
↓
Dispatches window custom event 'entity-data-changed'
↓
useEntityDataSource listens for 'entity-data-changed'
↓
Updates local records state (create/update/delete)
↓
UI re-renders with new data
```

### Arquivos Envolvidos

**Backend:**
- `apps/api/src/modules/data/data.service.ts` - Emite eventos em create/update/delete
- `apps/api/src/modules/notification/notification.service.ts` - Encaminha para gateway
- `apps/api/src/modules/notification/notification.gateway.ts` - Emite via Socket.IO

**Frontend:**
- `apps/web-admin/src/providers/notification-provider.tsx` - Conecta ao WebSocket
- `apps/web-admin/src/components/entity-data/use-entity-data-source.ts` - Atualiza state
- `apps/web-admin/src/stores/tenant-context.tsx` - Dispara evento de troca de tenant

## Debug Logs

Os seguintes logs foram adicionados para diagnóstico. Abra o console do navegador (F12) e procure por:

### 1. Conexão ao WebSocket

```
🔌 Conectado ao WebSocket
```
**Onde:** notification-provider.tsx linha 91
**Significa:** Socket.IO conectou com sucesso ao servidor
**Se não aparecer:** Problema de conexão (CORS, URL errada, servidor offline)

### 2. Autenticação

```
✅ WebSocket autenticado: {userId: "...", tenantId: "..."}
```
**Onde:** notification-provider.tsx linha 103
**Significa:** JWT validado com sucesso
**Se não aparecer:** Token inválido ou expirado

### 3. Subscrição ao Tenant

```
📡 Subscribed to tenant room: abc123
```
**Onde:** notification-provider.tsx linha 110
**Significa:** Inscrito na sala do tenant para receber eventos
**Se não aparecer:** Problema na subscrição (apenas PLATFORM_ADMIN vê isso)

### 4. Evento Recebido do Servidor

```
🔔 [WebSocket] Evento data-changed recebido do servidor: {operation: "created", entitySlug: "...", record: {...}}
```
**Onde:** notification-provider.tsx linha 145
**Significa:** Servidor emitiu e cliente recebeu o evento
**Se não aparecer:** Backend não está emitindo OU cliente não está na sala correta

### 5. Processamento do Evento

```
[WebSocket] entity-data-changed recebido: {operation: "created", entitySlug: "..."}
```
**Onde:** use-entity-data-source.ts linha 109
**Significa:** Custom event foi disparado e capturado
**Se não aparecer:** window.dispatchEvent falhou

### 6. Filtragem por entitySlug

```
[WebSocket] Ignorando evento - entitySlug diferente: {received: "users", current: "tasks"}
```
**Onde:** use-entity-data-source.ts linha 112
**Significa:** Evento é de outra entidade, corretamente ignorado
**Normal:** Cada componente só processa eventos da própria entidade

### 7. Aplicação da Mudança

```
[WebSocket] Processando created para tasks
```
**Onde:** use-entity-data-source.ts linha 119
**Significa:** Aplicando a mudança ao estado local (created/updated/deleted)
**Se aparecer mas UI não atualizar:** Problema no React state update

## Como Testar

### Teste Básico (1 usuário, 2 abas)

1. Abra o sistema em **duas abas** do mesmo navegador
2. **Aba 1:** Abra o console (F12) e vá para uma lista de registros
3. **Aba 2:** Crie, edite ou delete um registro
4. **Aba 1:** Verifique se:
   - Apareceu "🔔 [WebSocket] Evento data-changed recebido"
   - Apareceu "[WebSocket] Processando {operation}"
   - A lista atualizou automaticamente

### Teste Multi-Usuário

1. **Usuário 1:** Login e abra uma lista (ex: Tarefas)
2. **Usuário 2:** Login em outra máquina/navegador
3. **Usuário 2:** Crie um novo registro
4. **Usuário 1:** Console deve mostrar os logs + UI atualizar

### Teste PLATFORM_ADMIN Cross-Tenant

1. Login como PLATFORM_ADMIN
2. Selecione Tenant A no seletor
3. Console deve mostrar: "📡 [PLATFORM_ADMIN] Subscribed to tenant room: {tenantId}"
4. Crie um registro no Tenant A em outra aba
5. Primeira aba deve atualizar automaticamente
6. Troque para Tenant B no seletor
7. Console deve mostrar nova subscrição: "📡 [PLATFORM_ADMIN] Tenant changed, subscribed to: {newTenantId}"

### Teste Multi-Tenant User

1. Login como usuário com acesso a múltiplos tenants
2. Console deve mostrar: "🔌 Conectado ao WebSocket" + "✅ WebSocket autenticado"
3. Troque de tenant no seletor
4. Console deve mostrar:
   - "🔄 [Multi-tenant] Reconnecting WebSocket with new JWT..."
   - "❌ Desconectado do WebSocket"
   - "[WebSocket] Iniciando conexão em 500ms..."
   - "🔌 Conectado ao WebSocket"
   - "✅ WebSocket autenticado: {novo tenantId}"
5. Crie um registro no novo tenant em outra aba
6. Primeira aba deve atualizar automaticamente

## Problemas Comuns

### WebSocket não conecta

**Sintomas:** Não aparece "🔌 Conectado ao WebSocket"

**Causas possíveis:**
- CORS bloqueado (verifique `CORS_ORIGIN` no backend)
- URL errada (`NEXT_PUBLIC_API_URL` no frontend)
- Backend não está rodando
- Firewall bloqueando WebSocket

**Solução:**
```bash
# Verificar variável de ambiente
echo $NEXT_PUBLIC_API_URL

# Backend deve ter
CORS_ORIGIN=http://localhost:3000,https://seudominio.com

# Testar conexão manual
curl http://localhost:3001/socket.io/
```

### Eventos não chegam

**Sintomas:** Conecta OK mas não aparece "🔔 [WebSocket] Evento data-changed"

**Causas possíveis:**
- Backend não está emitindo (verificar logs do servidor)
- Cliente não está na sala correta do tenant
- PLATFORM_ADMIN não subscreveu ao tenant selecionado

**Debug no backend:**
```bash
# Ver logs do NestJS (deve mostrar)
📡 data-changed: created tasks → tenant:abc123
```

**Solução:**
- Verificar que `selectedTenantId` em sessionStorage corresponde ao tenant dos dados
- PLATFORM_ADMIN: trocar de tenant força re-subscrição

### UI não atualiza

**Sintomas:** Eventos chegam mas interface não muda

**Causas possíveis:**
- React state não está atualizando
- Componente usa cache que não é invalidado
- Kanban tem `disableWebSocketUpdates={true}`

**Solução:**
- Verificar que o componente usa `useEntityData()` ou `useEntityDataSource()`
- Kanban tem WebSocket desabilitado propositalmente (comportamento esperado)
- Force refresh manual com `refresh()` do context

### Eventos duplicados

**Sintomas:** Cada mudança aparece múltiplas vezes

**Causas possíveis:**
- Múltiplas conexões WebSocket abertas
- useEffect sem cleanup correto

**Solução:**
- Verificar que NotificationProvider só está montado 1 vez (layout.tsx)
- Verificar array de dependências dos useEffect

## Arquitetura de Rooms

O sistema usa rooms do Socket.IO para broadcast eficiente:

```
tenant:abc123       → Todos os usuários do Tenant ABC
tenant:xyz789       → Todos os usuários do Tenant XYZ
user:user123        → Notificações diretas para usuário específico
```

### Troca de Tenant por Tipo de Usuário

**PLATFORM_ADMIN:**
1. Continua conectado ao WebSocket (mesmo JWT)
2. sessionStorage salva `selectedTenantId`
3. Dispara evento `tenant-changed`
4. NotificationProvider ouve e chama `socket.emit('subscribe', { channel: 'tenant:novo' })`
5. Entra na nova sala e sai implicitamente da antiga (Socket.IO automático)

**Multi-tenant users (não PLATFORM_ADMIN):**
1. Chama `/auth/switch-tenant` no backend
2. Recebe **NOVO JWT** com novo `tenantId` dentro
3. Salva novo token no localStorage
4. Dispara evento `tenant-changed`
5. NotificationProvider ouve e **DESCONECTA** o WebSocket
6. Reconecta automaticamente com o novo JWT
7. Backend adiciona à sala do novo tenant automaticamente

## Performance

- **Granular updates:** Eventos incluem `record` completo, frontend atualiza apenas 1 item
- **No full refetch:** Não precisa buscar toda a lista novamente
- **Fallback para refresh:** Se `record` não vier no payload, faz refetch da lista
- **Debounce:** Kanban desabilita WebSocket para evitar re-renders durante drag

## Monitoramento

Para ver estatísticas de conexões em produção:

```typescript
// Backend: NotificationGateway tem métodos auxiliares
isUserOnline(userId: string): boolean
getOnlineUsers(tenantId: string): string[]
```

Esses métodos podem ser expostos via endpoint admin para dashboard de usuários online.
