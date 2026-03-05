# Dockerfile para API NestJS
# Usa artefatos pre-compilados pelo pnpm build (sem rebuild no Docker)

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copiar shared package (pre-compilado)
COPY packages/shared/package.json ./shared/package.json
COPY packages/shared/dist ./shared/dist

# Copiar package.json e prisma schema
COPY apps/api/package.json ./package.json.orig
RUN sed 's|"workspace:\*"|"file:./shared"|g' package.json.orig > package.json && rm package.json.orig
COPY apps/api/prisma ./prisma

# Instalar deps (incluindo dev para prisma generate), gerar client, remover dev deps
ENV NODE_ENV=development
RUN npm install --legacy-peer-deps && \
    npx prisma generate && \
    npm prune --omit=dev && \
    npm cache clean --force
ENV NODE_ENV=production

# Copiar dist pre-compilado
COPY --chown=nestjs:nodejs apps/api/dist ./dist

# Criar diretorio de uploads
RUN mkdir -p /app/uploads && chown nestjs:nodejs /app/uploads

USER nestjs

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/src/main.js"]
