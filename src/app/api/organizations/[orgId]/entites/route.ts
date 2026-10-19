/**
 * Gestion des ENTITÉS (sous-organisations) par l'ADMIN d'une organisation.
 *  GET  /api/organizations/[orgId]/entites — sous-arbre de l'org (racine incluse).
 *  POST { nom, parentId? } — crée une entité enfant DANS le sous-arbre de l'org.
 *
 * Sécurité : réservé au rôle EFFECTIF ADMIN dans l'org cible ; toute création est
 * contrainte au sous-arbre de l'org (anti-escalade : impossible d'agir sur un
 * parent, un frère ou la racine hors périmètre). Cf. isInSubtree (path matérialisé).
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { isAdminRole } from '@/lib/permissions'
import { withAccess, type OrgTarget } from '@/lib/with-access.server'
import { rootPath, childPath, isInSubtree } from '@/lib/org-context'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
const ORG = { param: 'orgId' } satisfies OrgTarget

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

/** Organisation cible (id, nom, path). */
const chargerOrg = (orgId: string) => prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, nom: true, path: true } })
const introuvable = () => NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })

// GET — sous-arbre de l'organisation (racine + descendants), avec compteurs.
// Réservé au rôle EFFECTIF ADMIN dans l'org cible.
export const GET = withAccess({ org: ORG, allow: isAdminRole }, async (_req, { orgId }) => {
  const org = await chargerOrg(orgId)
  if (!org) return introuvable()

  const rows = await prisma.organization.findMany({
    where: { path: { startsWith: org.path } },
    orderBy: { path: 'asc' },
    select: {
      id: true, nom: true, parentId: true, path: true, actif: true,
      _count: { select: { membres: true, analyses: true } },
    },
  })
  const baseDepth = org.path.split('/').filter(Boolean).length
  const entites = rows.map(o => ({
    id: o.id, nom: o.nom, parentId: o.parentId, actif: o.actif,
    depth: o.path.split('/').filter(Boolean).length - baseDepth,
    isRoot: o.id === orgId,
    membres: o._count.membres, analyses: o._count.analyses,
  }))
  return NextResponse.json({ entites })
})

const createSchema = z.object({
  nom: z.string().min(1).max(120),
  parentId: z.string().min(1).max(40).optional(),
})

// POST — créer une entité enfant dans le sous-arbre de l'org.
export const POST = withAccess({ org: ORG, allow: isAdminRole, rateLimit: { bucket: 'entites' }, body: createSchema }, async (req, { user, orgId, body: data }) => {
  const org = await chargerOrg(orgId)
  if (!org) return introuvable()

  // Parent = org elle-même par défaut ; sinon il DOIT être dans le sous-arbre de l'org.
  const parentId = data.parentId ?? orgId
  const parent = await prisma.organization.findUnique({ where: { id: parentId }, select: { path: true } })
  if (!parent || !isInSubtree(parent.path, org.path)) {
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
    userId: user.id, targetId: entite.id, targetType: 'organization',
    ip: getClientIp(req), details: { nom: entite.nom, parentId, viaOrgAdmin: orgId },
  })
  return NextResponse.json({ entite }, { status: 201 })
})
