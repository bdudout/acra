/**
 * Membres & rôles d'une ENTITÉ (sous-organisation), gérés par l'ADMIN de l'org.
 *  GET    — membres de l'entité.
 *  POST   { email, role, scope } — ajoute/actualise une appartenance.
 *  DELETE ?membershipId — retire une appartenance.
 *
 * Sécurité : ADMIN effectif de [orgId] ET l'entité cible DOIT appartenir au
 * sous-arbre de [orgId] (anti-escalade hors périmètre). Rôles limités aux rôles
 * d'organisation (jamais SUPER_ADMIN). scope NODE = ce nœud, SUBTREE = + descendants.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { isInSubtree } from '@/lib/org-context'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string; entiteId: string }> }

/** ADMIN effectif de orgId + entité dans le sous-arbre de orgId. */
async function guard(orgId: string, entiteId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const role = await getEffectiveRoleForOrg(userId, instanceRole, orgId)
  if (!role || !isAdminRole(role)) return { error: NextResponse.json({ error: 'Réservé à l\'administrateur de l\'organisation' }, { status: 403 }) }

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } })
  const entite = await prisma.organization.findUnique({ where: { id: entiteId }, select: { id: true, path: true } })
  if (!org || !entite || !isInSubtree(entite.path, org.path)) {
    return { error: NextResponse.json({ error: 'Entité hors de votre périmètre' }, { status: 403 }) }
  }
  return { userId, entiteId }
}

// GET /api/organizations/[orgId]/entites/[entiteId]/membres — liste les membres rattachés à une entité de l'organisation.
export async function GET(_req: NextRequest, { params }: Params) {
  const { orgId, entiteId } = await params
  const g = await guard(orgId, entiteId)
  if ('error' in g) return g.error
  const members = await prisma.orgMembership.findMany({
    where: { organizationId: entiteId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, scope: true, user: { select: { id: true, name: true, email: true } } },
  })
  return NextResponse.json({ members })
}

// Rôles assignables : rôles d'ORGANISATION uniquement (jamais SUPER_ADMIN).
const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'DIRECTION_METIER']),
  scope: z.enum(['NODE', 'SUBTREE']).default('NODE'),
})

// POST /api/organizations/[orgId]/entites/[entiteId]/membres — rattache un membre à une entité de l'organisation.
export async function POST(req: NextRequest, { params }: Params) {
  const { orgId, entiteId } = await params
  const g = await guard(orgId, entiteId)
  if ('error' in g) return g.error

  const rl = rateLimit(`entite-membres:${g.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  let data: z.infer<typeof addSchema>
  try { data = addSchema.parse(await req.json()) }
  catch { return NextResponse.json({ error: 'Requête invalide' }, { status: 400 }) }

  const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Aucun compte avec cet e-mail' }, { status: 404 })

  const membership = await prisma.orgMembership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: entiteId } },
    create: { userId: user.id, organizationId: entiteId, role: data.role, scope: data.scope },
    update: { role: data.role, scope: data.scope },
    select: { id: true, role: true, scope: true, user: { select: { id: true, name: true, email: true } } },
  })
  await auditLog('ORG_MEMBER_ADDED', {
    userId: g.userId, targetId: entiteId, targetType: 'organization',
    ip: getClientIp(req), details: { memberEmail: data.email, role: data.role, scope: data.scope, viaOrgAdmin: orgId },
  })
  return NextResponse.json({ membership }, { status: 201 })
}

// DELETE /api/organizations/[orgId]/entites/[entiteId]/membres — détache un membre d'une entité de l'organisation.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { orgId, entiteId } = await params
  const g = await guard(orgId, entiteId)
  if ('error' in g) return g.error
  const membershipId = new URL(req.url).searchParams.get('membershipId')
  if (!membershipId) return NextResponse.json({ error: 'membershipId requis' }, { status: 400 })

  const m = await prisma.orgMembership.findFirst({ where: { id: membershipId, organizationId: entiteId }, select: { id: true } })
  if (!m) return NextResponse.json({ error: 'Appartenance introuvable' }, { status: 404 })
  await prisma.orgMembership.delete({ where: { id: membershipId } })
  await auditLog('ORG_MEMBER_REMOVED', {
    userId: g.userId, targetId: entiteId, targetType: 'organization',
    ip: getClientIp(req), details: { membershipId, viaOrgAdmin: orgId },
  })
  return NextResponse.json({ ok: true })
}
