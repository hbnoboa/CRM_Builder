# Dockerfile para API NestJS - Build completo no container

FROM node:20-alpine AS base

# Instalar dependências
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache openssl

# Copiar apenas o package.json do API e instalar com npm (não pnpm)
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma

# Instalar com npm para evitar symlinks do pnpm
RUN npm install --legacy-peer-deps

# Build
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copiar arquivos do API (exceto node_modules)
COPY apps/api/src ./src
COPY apps/api/nest-cli.json ./
COPY apps/api/tsconfig.json ./
COPY apps/api/package.json ./

RUN npm run build
RUN npx prisma generate

# Produção - imagem mínima
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copiar arquivos necessários
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

USER nestjs

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/src/main.js"]
