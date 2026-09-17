/**
 * Traitements RÉELS des écarts de conformité (plan d'action / dérogation /
 * acceptation de risque), au niveau du socle d'organisation.
 *  GET  ?referentiel=X&entite=Y — liste les traitements du suivi.
 *  POST { referentiel, entite, type, intitule, refs[], … } — crée un traitement.
 * Écriture réservée aux rôles de gouvernance (ADMIN / RSSI / Risk Manager).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { isTraitementType, sanitizeRefs } from '@/lib/conformite-traitement'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string }> }

function canManage(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER'
}
const cleanEntite = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 80) : '')

// GET /api/organizations/[orgId]/conformite/traitements — liste les traitements d'écarts de conformité de l'org.
export async function GET(req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  const visibles = scope.scope.visibleOrgIds ?? []
  if (!(orgId === 'global' || visibles.length === 0 || visibles.includes(orgId))) {
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
export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const role = await getEffectiveRoleForOrg(userId, instanceRole, orgId)
  if (!role) return NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 })
  if (!canManage(role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const rl = rateLimit(`conf-traitements:${userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

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
      createdById: userId,
    },
    select: { id: true, type: true, intitule: true, refs: true, statut: true },
  })
  return NextResponse.json({ traitement: created }, { status: 201 })
}
