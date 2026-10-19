// ─── Suppression d'une mesure rattachée à un risque (saisie directe) ─────────
// DELETE — détache/supprime une mesure. Mêmes gardes que la collection ; la mesure
// doit appartenir au risque ET à l'analyse ciblés (sinon 404, sans divulgation).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'

export const dynamic = 'force-dynamic'

// DELETE /api/analyses/:id/risques/:riskId/mesures/:mesureId
// Garde déléguée à guardDirectRisk (accès, méthode, édition, gel) avec le rôle d'instance.
export const DELETE = withAccess({ org: 'none', rateLimit: { bucket: 'analyse-risques' } }, async (req, { user, params: { id, riskId, mesureId } }) => {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  // Mesure bornée au risque + analyse (aucune fuite inter-analyses).
  const exists = await prisma.mesure.count({ where: { id: mesureId, risqueId: riskId, analyseId: g.analyse.id } })
  if (!exists) return NextResponse.json({ error: 'Mesure introuvable' }, { status: 404 })

  await prisma.mesure.delete({ where: { id: mesureId } })
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: user.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-mesure', action: 'delete', riskId, mesureId },
  })
  return NextResponse.json({ ok: true })
})
