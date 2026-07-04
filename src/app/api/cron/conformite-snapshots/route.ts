import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { sanitizeConformite } from '@/lib/conformite'
import { sanitizeSnapshotMode, dueForAutoSnapshot } from '@/lib/conformite-config'

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
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron désactivé (CRON_SECRET absent)' }, { status: 503 })
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.nextUrl.searchParams.get('token') ?? ''
  if (token !== secret) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const now = new Date()
  const confs = await prisma.conformite.findMany({
    select: {
      id: true, organizationId: true, entries: true,
      snapshots: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })

  // Cache de config par organisation (évite N résolutions).
  const cfgCache = new Map<string, string>()
  const modeFor = async (orgId: string): Promise<string> => {
    if (!cfgCache.has(orgId)) cfgCache.set(orgId, sanitizeSnapshotMode((await getOrgConfig(orgId)).conformiteSnapshotMode))
    return cfgCache.get(orgId)!
  }

  let created = 0
  for (const c of confs) {
    if ((await modeFor(c.organizationId)) !== 'AUTO') continue
    const lastAt = c.snapshots[0]?.createdAt ?? null
    if (!dueForAutoSnapshot(lastAt, now)) continue
    await prisma.conformiteSnapshot.create({
      data: { conformiteId: c.id, entries: sanitizeConformite(c.entries) as unknown as object, createdById: null },
    })
    created++
  }
  return NextResponse.json({ ok: true, checked: confs.length, created })
}
