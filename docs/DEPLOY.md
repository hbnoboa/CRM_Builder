# 🚀 Deploy do CRM Builder

Este guia explica como fazer deploy do CRM Builder em produção.

## Arquitetura de Produção

```
┌─────────────────────┐     ┌─────────────────────┐
│   Vercel            │     │   Railway           │
│   (Frontend)        │────▶│   (API + WS)        │
│   Next.js 14        │     │   NestJS            │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                            ┌──────────▼──────────┐
                            │   PostgreSQL        │
                            │   (Railway/Neon)    │
                            └─────────────────────┘
```

## 📋 Pré-requisitos

1. Conta no [GitHub](https://github.com)
2. Conta no [Railway](https://railway.app) (para API)
3. Conta no [Vercel](https://vercel.com) (para Frontend)
4. Conta no [Google Cloud](https://cloud.google.com) (para GCS - opcional)

## 🔧 Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/crm-builder.git
cd crm-builder
```

### 2. Configure as variáveis de ambiente

Copie o arquivo `.env.production.example` para `.env`:

```bash
cp .env.production.example .env
```

Preencha todas as variáveis necessárias.

### 3. Deploy da API no Railway

#### Opção A: Via Railway CLI

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Criar projeto
railway init

# Criar banco de dados PostgreSQL
railway add --plugin postgresql

# Deploy
railway up
```

#### Opção B: Via Dashboard Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Selecione seu repositório
5. Adicione um serviço PostgreSQL
6. Configure as variáveis de ambiente

#### Variáveis de Ambiente Railway

```env
DATABASE_URL=<gerado automaticamente>
JWT_SECRET=<sua chave secreta>
JWT_REFRESH_SECRET=<sua chave refresh>
NODE_ENV=production
```

### 4. Deploy do Frontend no Vercel

#### Opção A: Via Vercel CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd apps/web-admin
vercel
```

#### Opção B: Via Dashboard Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em "Add New Project"
3. Importe seu repositório do GitHub
4. Configure:
   - **Framework**: Next.js
   - **Root Directory**: `apps/web-admin`
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `.next`
5. Adicione as variáveis de ambiente

#### Variáveis de Ambiente Vercel

```env
NEXT_PUBLIC_API_URL=https://sua-api.railway.app
```

### 5. Configurar CI/CD (GitHub Actions)

Adicione os seguintes secrets no GitHub:

1. Vá em `Settings > Secrets and variables > Actions`
2. Adicione:
   - `RAILWAY_TOKEN`: Token do Railway (Settings > Tokens)
   - `VERCEL_TOKEN`: Token do Vercel (Settings > Tokens)
   - `VERCEL_ORG_ID`: ID da organização Vercel
   - `VERCEL_PROJECT_ID`: ID do projeto Vercel

## 🗄️ Banco de Dados

### Migrações

As migrações são executadas automaticamente no deploy. Para executar manualmente:

```bash
# Via Railway CLI
railway run npx prisma migrate deploy

# Localmente conectado ao banco de produção
DATABASE_URL="sua-url-producao" npx prisma migrate deploy
```

### Seed (Dados Iniciais)

Para popular o banco com dados iniciais:

```bash
railway run npx prisma db seed
```

## 📊 Monitoramento

### Railway

- Dashboard com métricas em tempo real
- Logs da aplicação
- Alertas de erro

### Vercel

- Analytics integrado
- Logs de build e runtime
- Web Vitals

## 🔐 Segurança

1. **Nunca** comite arquivos `.env` no Git
2. Use **secrets** do GitHub Actions para tokens
3. Configure **CORS** corretamente em produção
4. Ative **HTTPS** em todos os serviços
5. Configure **Rate Limiting** adequado

## 📝 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados provisionado
- [ ] Migrações executadas
- [ ] Seed executado (se necessário)
- [ ] CORS configurado
- [ ] Health check funcionando
- [ ] CI/CD configurado
- [ ] Monitoramento ativo
- [ ] Backup configurado

## 🆘 Troubleshooting

### Erro de conexão com banco

```bash
# Verificar se a URL está correta
railway run npx prisma db push --dry-run
```

### Build falhando

```bash
# Verificar logs
railway logs

# Rebuild local
pnpm run build
```

### WebSocket não conectando

Verifique se o CORS está configurado para aceitar conexões WebSocket.

## 📞 Suporte

- Documentação: `/docs` na API
- Issues: GitHub Issues
- Email: suporte@seudominio.com


## Baseline das migrations (05/11/2026)

As 50 migrations antigas foram trocadas por `apps/api/prisma/migrations/00000000000000_baseline`
(schema completo do dev). As antigas ficam em `apps/api/prisma/migrations-archive/`.

- **Banco novo (CI, máquina nova, recuperação):** `npx prisma migrate deploy` cria tudo.
- **Dev:** já marcado como aplicado. Nada a fazer.
- **Prod (fazer no release, com backup antes):**
  1. Backup do banco de prod.
  2. Comparar o schema real de prod com o baseline:
     `npx prisma migrate diff --from-url "$PROD_URL" --to-migrations prisma/migrations --shadow-database-url "$SHADOW_URL" --script`
  3. Aplicar em prod só o que falta (revisar cada comando antes), até o diff ficar vazio.
  4. Marcar o baseline: `DATABASE_URL="$PROD_URL" npx prisma migrate resolve --applied 00000000000000_baseline`.
  5. Só então rodar o deploy de prod. Sem o passo 4, o `migrate deploy` do deploy tenta criar o
     schema de novo, falha e o deploy para antes de trocar o código (nada quebra, mas não sobe).
