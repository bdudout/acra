/**
 * Traitements RÉELS des écarts de conformité (plan d'action / dérogation /
 * acceptation de risque), au niveau du socle d'organisation.
 *  GET  ?referentiel=X&entite=Y — liste les traitements du suivi.
 *  POST { referentiel, entite, type, intitule, refs[], … } — crée un traitement.
 * Écriture réservée aux rôles de gouvernance (ADMIN / RSSI / Risk Manager).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canReadOrgResource, peutGererConformite } from '@/lib/permissions'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { isTraitementType, sanitizeRefs } from '@/lib/conformite-traitement'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string }> }

const cleanEntite = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 80) : '')

// GET /api/organizations/[orgId]/conformite/traitements — liste les traitements d'écarts de conformité de l'org.
export async function GET(req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const g = await requireSession()
  if (g.error) return g.error
  const scope = await getAnalyseScope(g.user.id, g.user.role)
  if (!canReadOrgResource(orgId, scope.scope)) {
    return NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 })
  }
  const sp = new URL(req.url).searchParams
  const referentiel = (sp.get('referentiel') ?? '').trim()
  const entite = cleanEntite(sp.get('entite'))
  const rows = await prisma.conformiteTraitement.findMany({
    where: { organizationId: orgId, ...(referentiel ? { referentiel } : {}), entite },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, type: true, intitule: true, description: true, refs: true, statut: true,
      responsable: true, echeance: true, niveauRisqueMaintenu: true, niveauRisque: true,
      referentiel: true, derogationId: true, createdAt: true,
    },
  })
  return NextResponse.json({ traitements: rows })
}

// POST /api/organizations/[orgId]/conformite/traitements — crée un traitement d'écart (plan d'action / dérogation / acceptation) sur un contrôle.
// Gestion de la conformité : gouvernance, dont CONFORMITE et DPO (lib/permissions).
export const POST = withAccess({ org: { param: 'orgId' }, allow: peutGererConformite, rateLimit: { bucket: 'conf-traitements' } }, async (req, { user, role, orgId }) => {
  const body = await req.json().catch(() => ({}))
  const referentiel = typeof body?.referentiel === 'string' ? body.referentiel.trim() : ''
  const entite = cleanEntite(body?.entite)
  const type = body?.type
  const intitule = typeof body?.intitule === 'string' ? body.intitule.trim().slice(0, 200) : ''
  if (!referentiel || referentiel === 'CUSTOM' || !isTraitementType(type) || !intitule) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }
  const refs = sanitizeRefs(body?.refs)
  const echeance = typeof body?.echeance === 'string' && body.echeance ? new Date(body.echeance) : null
  const created = await prisma.conformiteTraitement.create({
    data: {
      organizationId: orgId, referentiel, entite, type, intitule,
      description: typeof body?.description === 'string' ? body.description.trim().slice(0, 4000) || null : null,
      responsable: typeof body?.responsable === 'string' ? body.responsable.trim().slice(0, 120) || null : null,
      echeance: echeance && !isNaN(echeance.getTime()) ? echeance : null,
      statut: type === 'ACCEPTATION_RISQUE' || type === 'DEROGATION' ? 'ACTIVE' : 'EN_COURS',
      niveauRisqueMaintenu: type === 'ACCEPTATION_RISQUE' ? Boolean(body?.niveauRisqueMaintenu) : false,
      niveauRisque: type === 'ACCEPTATION_RISQUE' && typeof body?.niveauRisque === 'string' ? body.niveauRisque.trim().slice(0, 60) || null : null,
      refs: refs as unknown as Prisma.InputJsonValue,
      createdById: user.id,
    },
    select: { id: true, type: true, intitule: true, refs: true, statut: true },
  })
  await auditLog('CONFORMITE_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'conformite_traitement', targetId: created.id, details: { action: 'traitement-create', type, referentiel, entite, refs: refs.length } })
  return NextResponse.json({ traitement: created }, { status: 201 })
})
