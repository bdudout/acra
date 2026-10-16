/**
 * Plans d'action UNIFIÉS d'une organisation.
 *  GET  ?type=&targetId=&statut= — liste (filtrable par lien source / statut).
 *  POST { titre, …, liens[] } — crée un plan d'action + ses liens polymorphes.
 * Écriture réservée aux rôles de gouvernance (ADMIN / RSSI / Risk Manager /
 * Direction métier). Lecture : périmètre visible.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canReadOrgResource, peutGererPlansAction } from '@/lib/permissions'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { validatePlanActionInput, cleanPlanActionInput, sanitizeLiens, isLienType } from '@/lib/plan-action'
import { entiteIdPourTexte } from '@/lib/entites.server'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string }> }

// GET /api/organizations/[orgId]/plans-actions — liste les plans d'action unifiés de l'org (avec leurs liens d'origine).
export async function GET(req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const g = await requireSession()
  if (g.error) return g.error
  const scope = await getAnalyseScope(g.user.id, g.user.role)
  if (!canReadOrgResource(orgId, scope.scope)) {
    return NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 })
  }
  const sp = new URL(req.url).searchParams
  const type = sp.get('type'); const targetId = sp.get('targetId'); const statut = sp.get('statut')
  const rows = await prisma.planAction.findMany({
    where: {
      organizationId: orgId,
      ...(statut ? { statut } : {}),
      ...(isLienType(type) ? { liens: { some: { type, ...(targetId ? { targetId } : {}) } } } : {}),
    },
    orderBy: [{ echeance: 'asc' }, { createdAt: 'desc' }],
    include: { liens: { select: { id: true, type: true, targetId: true, ref: true, label: true } } },
  })
  return NextResponse.json({ plans: rows })
}

// POST /api/organizations/[orgId]/plans-actions — crée un plan d'action unifié, éventuellement rattaché à une origine (lien polymorphe).
export const POST = withAccess(
  { org: { param: 'orgId' }, allow: peutGererPlansAction, rateLimit: { bucket: 'plans-actions' } },
  async (req, { user, orgId }) => {
    const body = await req.json().catch(() => ({}))
    const err = validatePlanActionInput(body)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    const clean = cleanPlanActionInput(body)
    const liens = sanitizeLiens(body?.liens)

    const created = await prisma.planAction.create({
      data: {
        organizationId: orgId,
        titre: clean.titre, description: clean.description, porteur: clean.porteur, entite: clean.entite,
        entiteId: await entiteIdPourTexte(orgId, clean.entite), // lien au référentiel si texte identique (lot E5)
        echeance: clean.echeance ? new Date(clean.echeance) : null,
        priorite: clean.priorite, statut: clean.statut, createdById: user.id,
        liens: { create: liens.map(l => ({ type: l.type, targetId: l.targetId, ref: l.ref ?? null, label: l.label ?? null })) },
      },
      include: { liens: true },
    })
    return NextResponse.json({ plan: created }, { status: 201 })
  },
)
