import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/health
 * Health check endpoint for load balancers, orchestrators, and monitoring.
 * Returns 200 OK when the app and DB are healthy, 503 otherwise.
 *
 * Response body:
 *   { status: 'ok' | 'degraded', db: 'connected' | 'error', version: string, uptime: number }
 */
export async function GET() {
  const start = Date.now()

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
        version: process.env.npm_package_version ?? 'unknown',
        uptime: Math.floor(process.uptime()),
        responseTimeMs: Date.now() - start,
      },
      { status: 503 }
    )
  }

  return NextResponse.json(
    {
      status: 'ok',
      db: dbStatus,
      version: process.env.npm_package_version ?? 'unknown',
      uptime: Math.floor(process.uptime()),
      responseTimeMs: Date.now() - start,
    },
    { status: 200 }
  )
}
