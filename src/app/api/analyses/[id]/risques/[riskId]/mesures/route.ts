// ─── Mesures de sécurité rattachées à un risque (saisie directe) ─────────────
// GET  — liste les mesures (contrôles) rattachées à un risque.
// POST — rattache une mesure au risque (documente la réduction brut → actuel).
// Mêmes gardes que la collection risques (accès, méthode à saisie directe, édition,
// gel) + le risque doit appartenir à l'analyse ciblée (sinon 404, sans divulgation).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { sanitizeRiskMesure, isRiskMesureValid, RISK_MESURE_SELECT } from '@/lib/risque-mesure'

export const dynamic = 'force-dynamic'

/** Vrai si le risque appartient bien à l'analyse ciblée. */
async function riskInAnalyse(riskId: string, analyseId: string): Promise<boolean> {
  return (await prisma.risque.count({ where: { id: riskId, analyseId } })) > 0
}

// GET /api/analyses/:id/risques/:riskId/mesures
// Garde déléguée à guardDirectRisk (accès, méthode, édition, gel) avec le rôle d'instance.
export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id, riskId } }) => {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!(await riskInAnalyse(riskId, g.analyse.id))) return NextResponse.json({ error: 'Risque introuvable' }, { status: 404 })

  const mesures = await prisma.mesure.findMany({
    where: { analyseId: g.analyse.id, risqueId: riskId },
    orderBy: { createdAt: 'asc' },
    select: RISK_MESURE_SELECT,
  })
  return NextResponse.json({ mesures })
})

// POST /api/analyses/:id/risques/:riskId/mesures — rattache une mesure au risque.
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'analyse-risques' } }, async (req, { user, params: { id, riskId } }) => {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!(await riskInAnalyse(riskId, g.analyse.id))) return NextResponse.json({ error: 'Risque introuvable' }, { status: 404 })

  const payload = sanitizeRiskMesure(await req.json().catch(() => ({})))
  if (!isRiskMesureValid(payload)) return NextResponse.json({ error: 'intitule_requis' }, { status: 400 })

  const mesure = await prisma.mesure.create({
    data: {
      analyseId: g.analyse.id,
      risqueId: riskId,
      nom: payload.nom,
      type: payload.type,
      statut: payload.statut,
      ...(payload.efficacite != null ? { efficacite: payload.efficacite } : {}),
      ...(payload.description != null ? { description: payload.description } : {}),
      ...(payload.responsable != null ? { responsable: payload.responsable } : {}),
      ...(payload.echeance ? { echeance: new Date(payload.echeance) } : {}),
    },
    select: RISK_MESURE_SELECT,
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: user.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-mesure', action: 'create', riskId, mesureId: mesure.id },
  })
  return NextResponse.json({ mesure }, { status: 201 })
})
