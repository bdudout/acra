# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./
COPY prisma ./prisma/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund || \
    npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps

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

# Production image
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Template PDF pré-compilé par esbuild (chargé au runtime par la route d'export)
COPY --from=builder --chown=nextjs:nodejs /app/.pdf-runtime ./.pdf-runtime

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check — vérifie que l'app répond et que la DB est joignable
# Démarre après 30s (temps de migration Prisma), puis toutes les 30s
# 127.0.0.1 (et non localhost) : dans le conteneur, localhost résout en IPv6 ::1,
# sur lequel le serveur Next standalone n'écoute pas → connection refused.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
