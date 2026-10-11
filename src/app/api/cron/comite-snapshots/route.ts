import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { capturerPhotoComite } from '@/lib/comite-historique.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/comite-snapshots — photo MENSUELLE des indicateurs du dossier de comité de chaque organisation (registre
 * des risques actif), référence de la tendance ↑↓. Idempotent : n'écrase jamais la photo du mois. Planificateur externe,
 * `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide. Aucune donnée métier retournée.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  const now = new Date()
  const orgs = await prisma.organization.findMany({ select: { id: true }, take: 5000 })
  let crees = 0
  for (const o of orgs) {
    try { if (await capturerPhotoComite(o.id, now)) crees++ } catch { /* une organisation en échec ne bloque pas les autres */ }
  }
  return NextResponse.json({ ok: true, organisations: orgs.length, crees })
}
