# syntax=docker/dockerfile:1
FROM node:26-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* .npmrc* prisma.config.ts ./
COPY prisma ./prisma/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

# Rebuild the source code only when needed
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
ENV DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder
# Borne le heap V8 pour éviter que le worker de build Next soit tué (OOM) sur les
# machines à mémoire Docker limitée (build worker exited with code 1 / signal null).
ENV NODE_OPTIONS=--max-old-space-size=2048

RUN npx prisma generate
RUN npm run build

# CLI Prisma autonome pour le service migrator (Prisma 7 : la CLI a de nombreuses
# dépendances, absentes de la sortie standalone de Next). Même version que le lockfile.
FROM base AS prisma-cli
WORKDIR /prisma-cli
COPY package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    PRISMA_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
    && echo '{"private":true}' > package.json \
    && npm install --no-audit --no-fund "prisma@${PRISMA_VERSION}"

# Production image
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ARG ACRA_VERSION=development
ARG ACRA_REVISION=unknown
ENV ACRA_VERSION=$ACRA_VERSION
ENV ACRA_REVISION=$ACRA_REVISION
LABEL org.opencontainers.image.version=$ACRA_VERSION
LABEL org.opencontainers.image.revision=$ACRA_REVISION
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# CLI Prisma et ses dépendances à part ; le lien garde le chemin historique
# node_modules/prisma/build/index.js (service migrator, scripts/migrate-recover.sh).
COPY --from=prisma-cli /prisma-cli/node_modules ./prisma-cli/node_modules
RUN ln -s ../prisma-cli/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/create-admin.mjs ./scripts/create-admin.mjs
# Template PDF pré-compilé par esbuild (chargé au runtime par la route d'export)
COPY --from=builder --chown=nextjs:nodejs /app/.pdf-runtime ./.pdf-runtime

RUN mkdir -p /app/.data/documents && chown -R nextjs:nodejs /app/.data

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check — vérifie l'app, la DB et les migrations livrées
# Démarre après 30s (temps de migration Prisma), puis toutes les 30s
# 127.0.0.1 (et non localhost) : dans le conteneur, localhost résout en IPv6 ::1,
# sur lequel le serveur Next standalone n'écoute pas → connection refused.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
