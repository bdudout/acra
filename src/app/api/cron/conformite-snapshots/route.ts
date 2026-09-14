import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { sanitizeConformite } from '@/lib/conformite'
import { sanitizeSnapshotMode, snapshotPeriodeDays, dueForAutoSnapshot } from '@/lib/conformite-config'

/**
 * POST /api/cron/conformite-snapshots — snapshots PÉRIODIQUES (mode AUTO).
 *
 * À appeler par un planificateur externe (cron système, tâche planifiée…) avec
 * l'en-tête `Authorization: Bearer <CRON_SECRET>`. Pour chaque entité Conformite
 * dont l'organisation est en mode AUTO et dont le dernier snapshot dépasse la
 * période, crée un snapshot automatique (createdById = null).
 *
 * Sécurité : désactivé (503) si CRON_SECRET n'est pas configuré ; 401 si le secret
 * ne correspond pas. Aucune donnée métier retournée.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied

  const now = new Date()
  const confs = await prisma.conformite.findMany({
    select: {
      id: true, organizationId: true, entries: true,
      snapshots: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })

  // Cache de config par organisation (évite N résolutions) : mode + périodicité.
  const cfgCache = new Map<string, { mode: string; periodeJours: number }>()
  const cfgFor = async (orgId: string) => {
    if (!cfgCache.has(orgId)) {
      const cfg = await getOrgConfig(orgId)
      cfgCache.set(orgId, { mode: sanitizeSnapshotMode(cfg.conformiteSnapshotMode), periodeJours: snapshotPeriodeDays(cfg.conformiteSnapshotPeriode) })
    }
    return cfgCache.get(orgId)!
  }

  let created = 0
  for (const c of confs) {
    const cfg = await cfgFor(c.organizationId)
    if (cfg.mode !== 'AUTO') continue
    const lastAt = c.snapshots[0]?.createdAt ?? null
    if (!dueForAutoSnapshot(lastAt, now, cfg.periodeJours)) continue
    await prisma.conformiteSnapshot.create({
      data: { conformiteId: c.id, entries: sanitizeConformite(c.entries) as unknown as object, createdById: null },
    })
    created++
  }
  return NextResponse.json({ ok: true, checked: confs.length, created })
}
