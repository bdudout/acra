/**
 * Gestion des ENTITÉS (sous-organisations) par l'ADMIN d'une organisation.
 *  GET  /api/organizations/[orgId]/entites — sous-arbre de l'org (racine incluse).
 *  POST { nom, parentId? } — crée une entité enfant DANS le sous-arbre de l'org.
 *
 * Sécurité : réservé au rôle EFFECTIF ADMIN dans l'org cible ; toute création est
 * contrainte au sous-arbre de l'org (anti-escalade : impossible d'agir sur un
 * parent, un frère ou la racine hors périmètre). Cf. isInSubtree (path matérialisé).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { rootPath, childPath, isInSubtree } from '@/lib/org-context'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string }> }

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'org'
}
async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  for (let i = 0; i < 50; i++) {
    const exists = await prisma.organization.findUnique({ where: { slug }, select: { id: true } })
    if (!exists) return slug
    slug = `${base}-${i + 2}`.slice(0, 40)
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 40)
}

/** Session + rôle EFFECTIF ADMIN dans l'org cible ; renvoie l'org (id, path, nom). */
async function guardAdmin(orgId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const role = await getEffectiveRoleForOrg(userId, instanceRole, orgId)
  if (!role) return { error: NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 }) }
  if (!isAdminRole(role)) return { error: NextResponse.json({ error: 'Réservé à l\'administrateur de l\'organisation' }, { status: 403 }) }
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, nom: true, path: true } })
  if (!org) return { error: NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 }) }
  return { userId, org }
}

// GET — sous-arbre de l'organisation (racine + descendants), avec compteurs.
export async function GET(_req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const g = await guardAdmin(orgId)
  if ('error' in g) return g.error

  const rows = await prisma.organization.findMany({
    where: { path: { startsWith: g.org.path } },
    orderBy: { path: 'asc' },
    select: {
      id: true, nom: true, parentId: true, path: true, actif: true,
      _count: { select: { membres: true, analyses: true } },
    },
  })
  const baseDepth = g.org.path.split('/').filter(Boolean).length
  const entites = rows.map(o => ({
    id: o.id, nom: o.nom, parentId: o.parentId, actif: o.actif,
    depth: o.path.split('/').filter(Boolean).length - baseDepth,
    isRoot: o.id === orgId,
    membres: o._count.membres, analyses: o._count.analyses,
  }))
  return NextResponse.json({ entites })
}

const createSchema = z.object({
  nom: z.string().min(1).max(120),
  parentId: z.string().min(1).max(40).optional(),
})

// POST — créer une entité enfant dans le sous-arbre de l'org.
export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const g = await guardAdmin(orgId)
  if ('error' in g) return g.error

  const rl = await rateLimit(`entites:${g.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  let data: z.infer<typeof createSchema>
  try { data = createSchema.parse(await req.json()) }
  catch { return NextResponse.json({ error: 'Requête invalide' }, { status: 400 }) }

  // Parent = org elle-même par défaut ; sinon il DOIT être dans le sous-arbre de l'org.
  const parentId = data.parentId ?? orgId
  const parent = await prisma.organization.findUnique({ where: { id: parentId }, select: { path: true } })
  if (!parent || !isInSubtree(parent.path, g.org.path)) {
    return NextResponse.json({ error: 'Entité parente hors de votre périmètre' }, { status: 403 })
  }

  const slug = await uniqueSlug(slugify(data.nom))
  const created = await prisma.organization.create({
    data: { nom: data.nom.trim(), slug, parentId, path: '/' },
    select: { id: true },
  })
  const path = childPath(parent.path, created.id) || rootPath(created.id)
  const entite = await prisma.organization.update({
    where: { id: created.id }, data: { path },
    select: { id: true, nom: true, parentId: true, actif: true },
  })

  await auditLog('ORG_CREATED', {
    userId: g.userId, targetId: entite.id, targetType: 'organization',
    ip: getClientIp(req), details: { nom: entite.nom, parentId, viaOrgAdmin: orgId },
  })
  return NextResponse.json({ entite }, { status: 201 })
}
