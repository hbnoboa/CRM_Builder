# Dockerfile para Web Admin (Next.js)
# Usa artefatos pre-compilados pelo pnpm build (sem rebuild no Docker)

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Instalar dependencias de producao (necessario pois pnpm standalone nao copia deps completas)
COPY packages/shared/package.json ./shared/package.json
COPY packages/shared/dist ./shared/dist
COPY apps/web-admin/package.json ./package.json.orig
RUN sed 's|"workspace:\*"|"file:./shared"|g' package.json.orig > package.json && rm package.json.orig
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copiar standalone build (server.js + .next/server pages e chunks)
COPY --chown=nextjs:nodejs apps/web-admin/.next/standalone/.next ./.next
COPY --chown=nextjs:nodejs apps/web-admin/.next/standalone/server.js ./server.js
# Copiar static assets
COPY --chown=nextjs:nodejs apps/web-admin/.next/static ./.next/static
# Copiar public
COPY --chown=nextjs:nodejs apps/web-admin/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
