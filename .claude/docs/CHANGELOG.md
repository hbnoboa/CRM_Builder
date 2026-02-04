# 📝 Changelog

## [0.1.0] - 2026-01-31

### Adicionado
- ✅ Estrutura inicial do monorepo (pnpm + Turborepo)
- ✅ Backend NestJS completo
  - Autenticação JWT com refresh tokens
  - Sistema RBAC de permissões
  - Multi-tenancy (Tenant → Organization → Organization)
  - CRUD dinâmico de entidades
  - WebSocket para notificações
  - Upload de arquivos
  - Rate limiting
  - Swagger documentation
- ✅ Frontend Next.js 14
  - App Router
  - Autenticação (login/register)
  - Dashboard
  - Listagem de entidades e dados
  - Gerenciamento de usuários
  - Organization switcher
  - Notificações realtime
- ✅ DevOps
  - Docker Compose (dev + prod)
  - Dockerfiles (API + Web)
  - Nginx config
  - Scripts de deploy
  - GitHub Actions CI/CD
  - Configs Railway + Vercel
- ✅ Documentação
  - DEPLOY.md
  - Swagger API docs
  - Contexto para Claude (.claude/)

### Em Progresso
- 🔄 Page Builder (Puck)
- 🔄 API Builder
- 🔄 Testes E2E

### Planejado
- ⏳ Importação/Exportação CSV
- ⏳ Webhooks
- ⏳ Integrações externas
- ⏳ Multi-idioma (i18n)
- ⏳ PWA/Mobile

---

## Próximas Versões

### [0.2.0] - Planejado
- Page Builder completo
- API Builder completo
- Testes E2E com Playwright
- Monitoramento (Prometheus/Grafana)

### [0.3.0] - Planejado
- Importação/Exportação CSV
- Webhooks
- Templates de entidades

### [1.0.0] - Planejado
- Versão estável para produção
- Documentação completa
- Integrações (Zapier, Make)
- Multi-idioma
