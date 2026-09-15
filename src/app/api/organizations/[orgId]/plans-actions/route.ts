/**
 * Plans d'action UNIFIÉS d'une organisation.
 *  GET  ?type=&targetId=&statut= — liste (filtrable par lien source / statut).
 *  POST { titre, …, liens[] } — crée un plan d'action + ses liens polymorphes.
 * Écriture réservée aux rôles de gouvernance (ADMIN / RSSI / Risk Manager /
 * Direction métier). Lecture : périmètre visible.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { validatePlanActionInput, cleanPlanActionInput, sanitizeLiens, isLienType } from '@/lib/plan-action'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string }> }

function canManage(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'DIRECTION_METIER'
}

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

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const role = await getEffectiveRoleForOrg(userId, instanceRole, orgId)
  if (!role) return NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 })
  if (!canManage(role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const rl = rateLimit(`plans-actions:${userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const body = await req.json().catch(() => ({}))
  const err = validatePlanActionInput(body)
  if (err) return NextResponse.json({ error: err }, { status: 400 })
  const clean = cleanPlanActionInput(body)
  const liens = sanitizeLiens(body?.liens)

  const created = await prisma.planAction.create({
    data: {
      organizationId: orgId,
      titre: clean.titre, description: clean.description, porteur: clean.porteur, entite: clean.entite,
      echeance: clean.echeance ? new Date(clean.echeance) : null,
      priorite: clean.priorite, statut: clean.statut, createdById: userId,
      liens: { create: liens.map(l => ({ type: l.type, targetId: l.targetId, ref: l.ref ?? null, label: l.label ?? null })) },
    },
    include: { liens: true },
  })
  return NextResponse.json({ plan: created }, { status: 201 })
}
