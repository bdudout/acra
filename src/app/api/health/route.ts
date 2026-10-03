import { releaseInfo } from '@/lib/release-info'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { migrationDrift, type MigrationRow } from '@/lib/migration-drift'
import { listShippedMigrations } from '@/lib/migrations-on-disk.server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 * Health check endpoint for load balancers, orchestrators, and monitoring.
 * Returns 200 OK when the app and DB are healthy, 503 otherwise.
 *
 * Response body:
 *   { status: 'ok' | 'degraded', db: 'connected' | 'error', version: string, uptime: number }
 *
 * `?deep=1` (mise à jour : scripts/update-lib.sh) ajoute `migrations: { expected, applied, pending, failed }`
 * et passe en `degraded` (503) si une migration livrée est en attente ou en échec.
 */
export async function GET(req: Request) {
  const start = Date.now()
  const deep = new URL(req.url).searchParams.get('deep') === '1'

  // Probe the database with a lightweight query
  let dbStatus: 'connected' | 'error' = 'error'
  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = 'connected'
  } catch {
    // DB unavailable — return 503 so orchestrators skip this instance
    return NextResponse.json(
      {
        status: 'degraded',
        db: 'error',
        ...releaseInfo(process.env),
        uptime: Math.floor(process.uptime()),
        responseTimeMs: Date.now() - start,
      },
      { status: 503 }
    )
  }

  let migrations: ReturnType<typeof migrationDrift> | undefined
  if (deep) {
    const shipped = listShippedMigrations()
    if (shipped) {
      try {
        const rows = await prisma.$queryRaw<MigrationRow[]>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`
        const d = migrationDrift(shipped, rows)
        // Seuls les noms de migrations (publics dans le dépôt) sont divulgués.
        migrations = { expected: d.expected, applied: d.applied, pending: d.pending, failed: d.failed }
      } catch {
        migrations = { expected: shipped.length, applied: 0, pending: shipped, failed: [] }
      }
    }
  }
  const degraded = Boolean(migrations && (migrations.pending.length || migrations.failed.length))

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'ok',
      db: dbStatus,
      ...releaseInfo(process.env),
      uptime: Math.floor(process.uptime()),
      responseTimeMs: Date.now() - start,
      ...(migrations ? { migrations } : {}),
    },
    { status: degraded ? 503 : 200 }
  )
}
