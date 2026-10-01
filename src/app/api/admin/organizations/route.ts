import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { rootPath, childPath } from '@/lib/org-context'
import { auditLog, getClientIp } from '@/lib/logger'
import { requireInstanceAdmin } from '@/lib/route-guard.server'

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


// GET /api/admin/organizations — arbre des organisations (+ dépendances de suppression)
export async function GET() {
  const auth = await requireInstanceAdmin()
  if (auth.error) return auth.error

  const orgs = await prisma.organization.findMany({
    orderBy: { path: 'asc' },
    select: {
      id: true, nom: true, slug: true, parentId: true, path: true, actif: true, logo: true,
      _count: { select: { enfants: true, membres: true, analyses: true } },
    },
  })
  return NextResponse.json({ organizations: orgs })
}

const createSchema = z.object({
  nom: z.string().min(1).max(120),
  parentId: z.string().min(1).max(40).nullable().optional(),
})

// POST /api/admin/organizations — créer une organisation (racine ou enfant)
export async function POST(req: NextRequest) {
  const auth = await requireInstanceAdmin()
  if (auth.error) return auth.error

  let data: z.infer<typeof createSchema>
  try {
    data = createSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  let parentPath: string | null = null
  if (data.parentId) {
    const parent = await prisma.organization.findUnique({ where: { id: data.parentId }, select: { path: true } })
    if (!parent) return NextResponse.json({ error: 'Organisation parente introuvable' }, { status: 400 })
    parentPath = parent.path
  }

  const slug = await uniqueSlug(slugify(data.nom))
  // Création puis calcul du chemin matérialisé (nécessite l'id généré).
  const created = await prisma.organization.create({
    data: { nom: data.nom.trim(), slug, parentId: data.parentId ?? null, path: '/' },
    select: { id: true },
  })
  const path = parentPath ? childPath(parentPath, created.id) : rootPath(created.id)
  const org = await prisma.organization.update({
    where: { id: created.id },
    data: { path },
    select: { id: true, nom: true, slug: true, parentId: true, path: true, actif: true },
  })

  await auditLog('ORG_CREATED', {
    userId: (auth.session!.user as any).id,
    targetId: org.id, targetType: 'organization',
    ip: getClientIp(req),
    details: { nom: org.nom, parentId: org.parentId },
  })
  return NextResponse.json({ organization: org }, { status: 201 })
}
