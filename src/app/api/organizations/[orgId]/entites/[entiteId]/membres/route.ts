/**
 * Membres & rôles d'une ENTITÉ (sous-organisation), gérés par l'ADMIN de l'org.
 *  GET    — membres de l'entité.
 *  POST   { email, role, scope } — ajoute/actualise une appartenance (mode DIRECT) ou
 *         envoie une invitation à accepter (mode INVITATION, T23).
 *  DELETE ?membershipId — retire une appartenance.
 *
 * Sécurité : ADMIN effectif de [orgId] ET l'entité cible DOIT appartenir au
 * sous-arbre de [orgId] (anti-escalade hors périmètre). Rôles limités aux rôles
 * d'organisation (jamais SUPER_ADMIN). scope NODE = ce nœud, SUBTREE = + descendants.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { isAdminRole, ROLES_ATTRIBUABLES } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { isInSubtree } from '@/lib/org-context'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'
import { getMembershipMode, inviteToOrganization, notifyMemberAdded } from '@/lib/org-invitation.server'

export const dynamic = 'force-dynamic'
/** ADMIN effectif de orgId (withAccess) ; l'entité doit appartenir au sous-arbre de orgId (anti-escalade). */
const ADMIN_ORG = { org: { param: 'orgId' }, allow: isAdminRole } as const
async function entiteDansPerimetre(orgId: string, entiteId: string | undefined): Promise<boolean> {
  if (!entiteId) return false
  const [org, entite] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } }),
    prisma.organization.findUnique({ where: { id: entiteId }, select: { path: true } }),
  ])
  return !!org && !!entite && isInSubtree(entite.path, org.path)
}
const horsPerimetre = () => NextResponse.json({ error: 'Entité hors de votre périmètre' }, { status: 403 })

// GET /api/organizations/[orgId]/entites/[entiteId]/membres — liste les membres rattachés à une entité de l'organisation.
export const GET = withAccess(ADMIN_ORG, async (_req, { orgId, params: { entiteId } }) => {
  if (!(await entiteDansPerimetre(orgId, entiteId))) return horsPerimetre()
  const members = await prisma.orgMembership.findMany({
    where: { organizationId: entiteId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, scope: true, user: { select: { id: true, name: true, email: true } } },
  })
  return NextResponse.json({ members })
})

// Rôles assignables : rôles d'ORGANISATION uniquement (jamais SUPER_ADMIN).
const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES_ATTRIBUABLES),
  scope: z.enum(['NODE', 'SUBTREE']).default('NODE'),
})

// POST /api/organizations/[orgId]/entites/[entiteId]/membres — rattache un membre à une entité de l'organisation.
export const POST = withAccess({ ...ADMIN_ORG, rateLimit: { bucket: 'entite-membres' }, body: addSchema }, async (req, { user: acteur, orgId, params: { entiteId }, body: data }) => {
  if (!(await entiteDansPerimetre(orgId, entiteId))) return horsPerimetre()

  // Mode de rattachement (T23) : instance ouverte → INVITATION (consentement, réponse
  // identique que l'e-mail ait un compte ou non) ; sur site → DIRECT (+ e-mail d'information).
  const { mode, notify } = await getMembershipMode()
  if (mode === 'INVITATION') {
    // Chaque invitation envoie un e-mail : débit borné par auteur ET par destinataire (anti mail-bombing).
    const email = data.email.toLowerCase().trim()
    const [byActor, byDest] = await Promise.all([
      rateLimit(`org-invite:${acteur.id}`, 30, 60 * 60 * 1000),
      rateLimit(`org-invite-dest:${email}`, 3, 60 * 60 * 1000),
    ])
    if (!byActor.allowed || !byDest.allowed) return NextResponse.json({ error: 'Trop d\'invitations, réessayez plus tard.' }, { status: 429 })
    await inviteToOrganization({ organizationId: entiteId, email: data.email, role: data.role, scope: data.scope, invitedById: acteur.id, locale: req.cookies.get('acra-locale')?.value })
    await auditLog('ORG_MEMBER_INVITED', {
      userId: acteur.id, targetId: entiteId, targetType: 'organization', organizationId: entiteId,
      ip: getClientIp(req), details: { memberEmail: data.email, role: data.role, scope: data.scope, viaOrgAdmin: orgId },
    })
    return NextResponse.json({ invited: true }, { status: 202 })
  }

  const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Aucun compte avec cet e-mail' }, { status: 404 })

  const existing = await prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: entiteId } }, select: { id: true } })
  const membership = await prisma.orgMembership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: entiteId } },
    create: { userId: user.id, organizationId: entiteId, role: data.role, scope: data.scope },
    update: { role: data.role, scope: data.scope },
    select: { id: true, role: true, scope: true, user: { select: { id: true, name: true, email: true } } },
  })
  await auditLog('ORG_MEMBER_ADDED', {
    userId: acteur.id, targetId: entiteId, targetType: 'organization',
    ip: getClientIp(req), details: { memberEmail: data.email, role: data.role, scope: data.scope, viaOrgAdmin: orgId },
  })
  if (!existing && notify) await notifyMemberAdded(user.id, entiteId)
  return NextResponse.json({ membership }, { status: 201 })
})

// DELETE /api/organizations/[orgId]/entites/[entiteId]/membres — détache un membre d'une entité de l'organisation.
export const DELETE = withAccess({ ...ADMIN_ORG, rateLimit: { bucket: 'entite-membres' } }, async (req, { user: acteur, orgId, params: { entiteId } }) => {
  if (!(await entiteDansPerimetre(orgId, entiteId))) return horsPerimetre()
  const membershipId = new URL(req.url).searchParams.get('membershipId')
  if (!membershipId) return NextResponse.json({ error: 'membershipId requis' }, { status: 400 })

  const m = await prisma.orgMembership.findFirst({ where: { id: membershipId, organizationId: entiteId }, select: { id: true } })
  if (!m) return NextResponse.json({ error: 'Appartenance introuvable' }, { status: 404 })
  await prisma.orgMembership.delete({ where: { id: membershipId } })
  await auditLog('ORG_MEMBER_REMOVED', {
    userId: acteur.id, targetId: entiteId, targetType: 'organization',
    ip: getClientIp(req), details: { membershipId, viaOrgAdmin: orgId },
  })
  return NextResponse.json({ ok: true })
})
