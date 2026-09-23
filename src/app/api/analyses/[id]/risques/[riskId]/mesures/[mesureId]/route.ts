// ─── Suppression d'une mesure rattachée à un risque (saisie directe) ─────────
// DELETE — détache/supprime une mesure. Mêmes gardes que la collection ; la mesure
// doit appartenir au risque ET à l'analyse ciblés (sinon 404, sans divulgation).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; riskId: string; mesureId: string }> }

function auth(session: unknown): { userId: string; role: UserRole } | null {
  const u = (session as { user?: { id?: string; role?: string } } | null)?.user
  if (!u?.id) return null
  return { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole }
}

// DELETE /api/analyses/:id/risques/:riskId/mesures/:mesureId
export async function DELETE(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, riskId, mesureId } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  // Mesure bornée au risque + analyse (aucune fuite inter-analyses).
  const exists = await prisma.mesure.count({ where: { id: mesureId, risqueId: riskId, analyseId: g.analyse.id } })
  if (!exists) return NextResponse.json({ error: 'Mesure introuvable' }, { status: 404 })

  await prisma.mesure.delete({ where: { id: mesureId } })
  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: a.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-mesure', action: 'delete', riskId, mesureId },
  })
  return NextResponse.json({ ok: true })
}
