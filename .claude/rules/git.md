# 🔀 Convenções Git

## Branches

```
main          → Produção (protegida)
develop       → Desenvolvimento
feature/*     → Novas funcionalidades
fix/*         → Correções de bugs
hotfix/*      → Correções urgentes em produção
refactor/*    → Refatorações
docs/*        → Documentação
```

### Exemplos
```bash
feature/user-avatar-upload
fix/login-redirect-loop
hotfix/payment-calculation
refactor/auth-module
docs/api-endpoints
```

## Commits

### Formato
```
<tipo>(<escopo>): <descrição>

[corpo opcional]

[rodapé opcional]
```

### Tipos
| Tipo | Uso |
|------|-----|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Documentação |
| `style` | Formatação (não afeta código) |
| `refactor` | Refatoração |
| `test` | Testes |
| `chore` | Tarefas de manutenção |
| `perf` | Melhorias de performance |
| `ci` | CI/CD |

### Escopos comuns
```
api, web, auth, user, entity, data, 
ui, db, config, deps, docker
```

### Exemplos
```bash
feat(api): adiciona endpoint de upload de avatar
fix(web): corrige redirect após login
docs(api): documenta endpoints de permissões
refactor(auth): extrai lógica de token para service
test(e2e): adiciona testes de fluxo de login
chore(deps): atualiza dependências
```

## Pull Requests

### Título
```
[TIPO] Descrição breve
```

### Template
```markdown
## Descrição
Breve descrição do que foi feito.

## Tipo de mudança
- [ ] Bug fix
- [ ] Nova feature
- [ ] Breaking change
- [ ] Documentação

## Checklist
- [ ] Código segue os padrões do projeto
- [ ] Testes foram adicionados/atualizados
- [ ] Documentação foi atualizada
- [ ] Self-review realizado

## Screenshots (se aplicável)

## Como testar
1. Passo 1
2. Passo 2
```

## Workflow

```bash
# 1. Criar branch
git checkout develop
git pull
git checkout -b feature/minha-feature

# 2. Desenvolver com commits frequentes
git add .
git commit -m "feat(api): implementa X"

# 3. Manter atualizado com develop
git fetch origin
git rebase origin/develop

# 4. Push
git push -u origin feature/minha-feature

# 5. Abrir PR para develop
# (via GitHub/GitLab)

# 6. Após aprovação, merge (squash preferido)
```

## .gitignore

Já configurado no projeto. Nunca commitar:
- `node_modules/`
- `.env` (usar `.env.example`)
- `dist/`, `.next/`
- Arquivos de IDE pessoais
- Logs
- Uploads de usuários
