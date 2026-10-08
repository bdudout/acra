import { releaseInfo } from '@/lib/release-info'
import { depotIssues } from '@/lib/signalement-erreur'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { migrationDrift, type MigrationRow } from '@/lib/migration-drift'
import { listShippedMigrations } from '@/lib/migrations-on-disk.server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 * Health check endpoint for load balancers, orchestrators, and monitoring.
 * Returns 200 OK when the app, DB and shipped schema are healthy, 503 otherwise.
 *
 * Response body:
 *   { status: 'ok' | 'degraded', db: 'connected' | 'error',
 *     schema: 'ok' | 'outdated' | 'unknown', version: string, uptime: number }
 *
 * La vérification des migrations est systématique, y compris pour Docker. `?deep=1`
 * (mise à jour : scripts/update-lib.sh) ajoute les noms et comptes des migrations.
 */
export async function GET(req: Request) {
  const start = Date.now()
  const deep = new URL(req.url).searchParams.get('deep') === '1'

  // Probe the database before checking that its schema matches this release.
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
        schema: 'unknown',
        ...releaseInfo(process.env),
        // Dépôt où signaler une erreur (écran d'erreur) : ACRA_ISSUES_REPO, sinon le dépôt d'ACRA.
        issuesRepo: depotIssues(process.env.ACRA_ISSUES_REPO),
        uptime: Math.floor(process.uptime()),
        responseTimeMs: Date.now() - start,
      },
      { status: 503 }
    )
  }

  let schema: 'ok' | 'outdated' | 'unknown' = 'unknown'
  let migrations: ReturnType<typeof migrationDrift> | undefined
  const shipped = listShippedMigrations()
  if (shipped) {
    try {
      const rows = await prisma.$queryRaw<MigrationRow[]>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`
      const drift = migrationDrift(shipped, rows)
      schema = drift.pending.length || drift.failed.length ? 'outdated' : 'ok'
      if (deep) {
        // Seuls les noms de migrations (publics dans le dépôt) sont divulgués.
        migrations = { expected: drift.expected, applied: drift.applied, pending: drift.pending, failed: drift.failed }
      }
    } catch {
      // Never report healthy when the migration history cannot be checked.
    }
  }
  const degraded = schema !== 'ok'

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'ok',
      db: dbStatus,
      schema,
      ...releaseInfo(process.env),
      issuesRepo: depotIssues(process.env.ACRA_ISSUES_REPO),
      uptime: Math.floor(process.uptime()),
      responseTimeMs: Date.now() - start,
      ...(migrations ? { migrations } : {}),
    },
    { status: degraded ? 503 : 200 }
  )
}
