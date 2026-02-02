# 📏 Regras de Código

## Índice

- [code-style.md](code-style.md) - Padrões de formatação
- [git.md](git.md) - Convenções Git
- [multi-tenancy.md](multi-tenancy.md) - Regras de isolamento
- [security.md](security.md) - Práticas de segurança
- [testing.md](testing.md) - Padrões de testes

## Regras Fundamentais

### 1. TypeScript Sempre
- Nunca usar `any` (exceto em casos extremos documentados)
- Definir tipos para todas as funções
- Usar interfaces para objetos complexos

### 2. Validação Obrigatória
- Backend: `class-validator` nos DTOs
- Frontend: `zod` nos forms
- Nunca confiar em dados do usuário

### 3. Multi-tenancy Sempre
- Toda query DEVE filtrar por `tenantId`
- Guards validam tenant do usuário
- Nunca expor dados de outros tenants

### 4. Permissões em Tudo
- Usar `@RequirePermission()` em endpoints
- Usar `<PermissionGate>` no frontend
- Verificar escopo (all, team, own)

### 5. Tratamento de Erros
- Backend: Exception filters
- Frontend: Error boundaries
- Sempre logar erros
- Nunca expor stack traces em produção

### 6. Código Limpo
- Funções pequenas (< 50 linhas)
- Nomes descritivos
- Comentários quando necessário
- Extrair lógica repetida
