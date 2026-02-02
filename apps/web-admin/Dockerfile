# Dockerfile para Web Admin (Next.js)

FROM node:20-alpine AS base
RUN npm install -g pnpm@9

# Instalar dependências
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web-admin/package.json ./apps/web-admin/
RUN pnpm install --frozen-lockfile --filter web-admin

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web-admin/node_modules ./apps/web-admin/node_modules
COPY . .

# Build arguments para variáveis de ambiente em build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build da aplicação
WORKDIR /app/apps/web-admin
RUN pnpm run build

# Produção
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar apenas o necessário para produção (standalone mode)
# O standalone já inclui a estrutura apps/web-admin
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-admin/.next/static ./apps/web-admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-admin/public ./apps/web-admin/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web-admin/server.js"]
