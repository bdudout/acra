// ─── Risques types d'une analyse à saisie directe (import en phase d'identification) ─
// GET  — catalogue groupé par origine (registre, sous-secteurs, architecture, secteur, transverse), déjà présents signalés.
// POST — { intitules: string[] } : crée les risques retenus, uniquement s'ils figurent au catalogue recalculé ici et ne
//        sont pas déjà dans l'analyse (contenu jamais repris du client). Même garde que la saisie directe (édition, gel).
// Session (et rate limit du POST) : withAccess (org 'none') ; garde guardDirectRisk inchangée.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { sanitizeDirectRisque } from '@/lib/risque-direct'
import { selectionRisquesTypes } from '@/lib/risque-exemples'
import { catalogueRisquesTypesAnalyse } from '@/lib/risques-types.server'
import { getServerLocale, getServerT } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
const MAX_IMPORT = 200

async function catalogue(analyseId: string, organizationId: string | null) {
  const t = await getServerT()
  return catalogueRisquesTypesAnalyse(analyseId, organizationId, t.risquesDirects.risquesTransverses, await getServerLocale())
}

export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id } }) => {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json({ risques: await catalogue(g.analyse.id, g.analyse.organizationId) })
})

export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'risques-types' } }, async (req, { user, params: { id } }) => {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  const demandes: unknown[] = Array.isArray(body?.intitules) ? body.intitules.slice(0, MAX_IMPORT) : []
  const retenus = selectionRisquesTypes(await catalogue(g.analyse.id, g.analyse.organizationId), demandes)
  if (!retenus.length) return NextResponse.json({ created: 0 })

  const { nbNiveaux } = await getEffectiveScaleConfig(g.analyse.organizationId)
  const { count } = await prisma.risque.createMany({
    data: retenus.map(r => {
      const p = sanitizeDirectRisque({ nom: r.intitule, description: r.description, gravite: r.gravite, vraisemblance: r.vraisemblance, strategie: 'REDUIRE', ...(r.domaine ? { domaine: r.domaine } : {}) }, nbNiveaux)
      const { vulnerabilites: _v, ...row } = p
      void _v
      return { ...row, description: p.description ?? null, analyseId: g.analyse.id }
    }),
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: user.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-direct', action: 'import-risques-types', count },
  })
  return NextResponse.json({ created: count }, { status: 201 })
})
