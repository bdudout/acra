/**
 * Plans d'action UNIFIÉS d'une organisation.
 *  GET  ?type=&targetId=&statut= — liste (filtrable par lien source / statut). Sans `page` : liste complète
 *       (réponse historique) ; avec `?page=&taille=&tri=&ordre=&q=` : `plans` de la page + `pagination` +
 *       `synthese` (compteurs sur tout le résultat filtré) — lot V1.
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
import { auditLog, getClientIp } from '@/lib/logger'
import { lirePagination, paginer, trier, correspond } from '@/lib/pagination'
import { effectiveStatut, summarizeActions } from '@/lib/risk-action'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string }> }
// Tris proposés par la liste paginée (lot V1) ; « defaut » = ordre historique (échéance, puis plus récent).
const TRIS_PLANS = ['defaut', 'titre', 'porteur', 'priorite', 'statut', 'echeance', 'createdAt'] as const
const PRIORITE_RANG: Record<string, number> = { CRITIQUE: 0, MAJEUR: 1, MODERE: 2 }
const STATUT_RANG: Record<string, number> = { EN_RETARD: 0, A_FAIRE: 1, EN_COURS: 2, FAIT: 3 }

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
  const where = {
    organizationId: orgId,
    ...(statut ? { statut } : {}),
    ...(isLienType(type) ? { liens: { some: { type, ...(targetId ? { targetId } : {}) } } } : {}),
  }
  const orderBy = [{ echeance: 'asc' as const }, { createdAt: 'desc' as const }]
  const include = { liens: { select: { id: true, type: true, targetId: true, ref: true, label: true } } }
  const pg = lirePagination(sp, { tris: TRIS_PLANS, triDefaut: 'defaut' })
  // Sans `page` : réponse complète historique (plans d'UN objet : popovers de traitement, grille de conformité…).
  if (!pg) return NextResponse.json({ plans: await prisma.planAction.findMany({ where, orderBy, include }) })

  // Lot V1 : requête LÉGÈRE (colonnes de recherche, tri et compteurs), puis détail des seules lignes de la page.
  const now = new Date()
  const legers = await prisma.planAction.findMany({ where, orderBy, select: { id: true, titre: true, porteur: true, entite: true, statut: true, priorite: true, echeance: true, createdAt: true } })
  const filtres = legers.filter(p => correspond(pg.q, p.titre, p.porteur, p.entite))
  const cle: Record<(typeof TRIS_PLANS)[number], ((p: (typeof legers)[number]) => unknown) | null> = {
    defaut: null, titre: p => p.titre, porteur: p => p.porteur, priorite: p => PRIORITE_RANG[p.priorite] ?? null,
    statut: p => STATUT_RANG[effectiveStatut(p, now)], echeance: p => p.echeance, createdAt: p => p.createdAt,
  }
  const k = cle[pg.tri]
  const page = paginer(k ? trier(filtres, k, pg.ordre) : filtres, pg)
  const rang = new Map(page.items.map((p, i) => [p.id, i]))
  const plans = (await prisma.planAction.findMany({ where: { id: { in: page.items.map(p => p.id) } }, include }))
    .sort((a, b) => (rang.get(a.id) ?? 0) - (rang.get(b.id) ?? 0))
  // Compteurs sur TOUT le résultat filtré (statut effectif : le retard se dérive de l'échéance).
  return NextResponse.json({ plans, pagination: page.pagination, synthese: summarizeActions(filtres, now) })
}

// POST /api/organizations/[orgId]/plans-actions — crée un plan d'action unifié, éventuellement rattaché à une origine (lien polymorphe).
export const POST = withAccess(
  { org: { param: 'orgId' }, allow: peutGererPlansAction, rateLimit: { bucket: 'plans-actions' } },
  async (req, { user, role, orgId }) => {
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
    await auditLog('PLAN_ACTION_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'plan_action', targetId: created.id, details: { action: 'create', liens: liens.length } })
    return NextResponse.json({ plan: created }, { status: 201 })
  },
)
