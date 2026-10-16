// ─── Saisie DIRECTE des risques d'une analyse (méthodes type ISO 31000) ──────
// GET  — liste les risques de l'analyse (saisie directe).
// POST — crée un risque directement (intitulé + gravité + vraisemblance).
// Réservé aux analyses dont la méthode autorise la saisie directe (cf.
// lib/methodes.ts) ; en EBIOS RM les risques dérivent des scénarios.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { sanitizeDirectRisque, isDirectRisqueValid, DIRECT_RISK_SELECT } from '@/lib/risque-direct'

export const dynamic = 'force-dynamic'

// GET /api/analyses/:id/risques — liste des risques (saisie directe).
export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id } }) => {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const [risques, mesures, plans] = await Promise.all([
    prisma.risque.findMany({
      where: { analyseId: g.analyse.id },
      orderBy: [{ niveauRisque: 'desc' }, { createdAt: 'asc' }],
      select: DIRECT_RISK_SELECT,
    }),
    prisma.mesure.findMany({
      where: { analyseId: g.analyse.id, risqueId: { not: null } },
      select: { risqueId: true },
    }),
    prisma.planAction.findMany({
      where: {
        organizationId: g.analyse.organizationId ?? undefined,
        liens: { some: { type: 'RISQUE_ANALYSE', ref: g.analyse.id } },
      },
      select: { liens: { where: { type: 'RISQUE_ANALYSE', ref: g.analyse.id }, select: { targetId: true } } },
    }),
  ])
  const mesuresCount = new Map<string, number>()
  for (const mesure of mesures) {
    if (mesure.risqueId) mesuresCount.set(mesure.risqueId, (mesuresCount.get(mesure.risqueId) ?? 0) + 1)
  }
  const plansCount = new Map<string, number>()
  for (const plan of plans) {
    for (const lien of plan.liens) plansCount.set(lien.targetId, (plansCount.get(lien.targetId) ?? 0) + 1)
  }
  return NextResponse.json({
    risques: risques.map(risque => ({
      ...risque,
      mesuresCount: mesuresCount.get(risque.id) ?? 0,
      plansCount: plansCount.get(risque.id) ?? 0,
    })),
  })
})

// POST /api/analyses/:id/risques — crée un risque directement.
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'analyse-risques' } }, async (req, { user, params: { id } }) => {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  // Cotation bornée par l'échelle de l'organisation (4 ou 5 niveaux).
  const { nbNiveaux } = await getEffectiveScaleConfig(g.analyse.organizationId)
  const payload = sanitizeDirectRisque(await req.json().catch(() => ({})), nbNiveaux)
  if (!isDirectRisqueValid(payload)) {
    return NextResponse.json({ error: 'intitule_requis' }, { status: 400 })
  }

  const risque = await prisma.risque.create({
    data: {
      analyseId: g.analyse.id,
      nom: payload.nom,
      description: payload.description,
      gravite: payload.gravite,
      vraisemblance: payload.vraisemblance,
      niveauRisque: payload.niveauRisque,
      graviteActuelle: payload.graviteActuelle,
      vraisemblanceActuelle: payload.vraisemblanceActuelle,
      niveauActuel: payload.niveauActuel,
      graviteResiduelle: payload.graviteResiduelle,
      vraisemblanceResiduelle: payload.vraisemblanceResiduelle,
      niveauResiduel: payload.niveauResiduel,
      strategie: payload.strategie,
      ...(payload.proprietaire !== undefined ? { proprietaire: payload.proprietaire } : {}),
      ...(payload.domaine !== undefined ? { domaine: payload.domaine } : {}),
    },
    select: DIRECT_RISK_SELECT,
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: user.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-direct', action: 'create', riskId: risque.id },
  })
  return NextResponse.json({ risque }, { status: 201 })
})
