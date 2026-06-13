/**
 * prisma.ts — Singleton Prisma client
 *
 * Next.js hot-reload in development creates a new module instance on every
 * file change, which would leak database connections if we instantiated
 * PrismaClient at module scope naively. This pattern stores the client on
 * `globalThis` so it survives module reloads while still being a proper
 * singleton in production.
 *
 * Query logging is enabled in development (queries + errors + warnings) and
 * limited to errors only in production to keep logs clean.
 *
 * Usage: `import { prisma } from '@/lib/prisma'` — never instantiate directly.
 */
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
