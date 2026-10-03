import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { capturerInstantane } from '@/lib/appetit-historique.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/appetence-snapshots — instantané MENSUEL d'appétence (RAS / RAD) de chaque organisation qui a au moins
 * une source active. Idempotent : n'écrase jamais l'instantané du mois (manuel ou déjà capturé). Planificateur externe,
 * `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide. Aucune donnée métier retournée.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  const now = new Date()
  const orgs = await prisma.organization.findMany({ select: { id: true }, take: 5000 })
  let crees = 0
  for (const o of orgs) {
    try { if ((await capturerInstantane(o.id, { now, userId: null, ecraser: false }))?.cree) crees++ } catch { /* une organisation en échec ne bloque pas les autres */ }
  }
  return NextResponse.json({ ok: true, organisations: orgs.length, crees })
}
