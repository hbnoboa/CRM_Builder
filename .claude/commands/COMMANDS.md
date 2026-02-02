# 📝 Comandos Customizados

## Como Usar

Quando você precisar de algo específico, use estes padrões:

---

## `/create-entity [nome]`

Cria uma nova entidade dinâmica no sistema.

**Exemplo:**
```
/create-entity Produto
```

**O que faz:**
1. Sugere campos baseado no nome
2. Cria seed para dados de exemplo
3. Atualiza permissões padrão

---

## `/create-page [nome]`

Cria uma nova página no frontend.

**Exemplo:**
```
/create-page relatorio-vendas
```

**O que faz:**
1. Cria arquivo em `app/(dashboard)/[nome]/page.tsx`
2. Adiciona rota no sidebar se necessário
3. Cria componentes necessários

---

## `/create-endpoint [método] [path]`

Cria um novo endpoint na API.

**Exemplo:**
```
/create-endpoint POST /reports/sales
```

**O que faz:**
1. Cria controller method
2. Cria service method
3. Cria DTOs necessários
4. Adiciona no Swagger

---

## `/create-component [nome]`

Cria um componente React reutilizável.

**Exemplo:**
```
/create-component DataCard
```

**O que faz:**
1. Cria em `components/ui/` ou `components/shared/`
2. Define props com TypeScript
3. Aplica estilos com Tailwind

---

## `/add-permission [recurso] [ação]`

Adiciona nova permissão ao sistema.

**Exemplo:**
```
/add-permission relatorio export
```

**O que faz:**
1. Atualiza tipos de permissão
2. Adiciona no seed de roles
3. Documenta na referência

---

## `/debug [área]`

Ajuda a debugar um problema.

**Exemplo:**
```
/debug auth
/debug database
/debug api
```

**O que faz:**
1. Lista possíveis causas
2. Mostra comandos de diagnóstico
3. Sugere correções

---

## `/deploy [ambiente]`

Guia de deploy para ambiente específico.

**Exemplo:**
```
/deploy production
/deploy staging
```

**O que faz:**
1. Lista checklist de deploy
2. Mostra variáveis necessárias
3. Comandos de execução

---

## `/test [tipo] [área]`

Cria ou roda testes.

**Exemplo:**
```
/test e2e auth
/test unit user-service
```

**O que faz:**
1. Cria arquivo de teste se não existir
2. Define casos de teste
3. Mostra como executar
