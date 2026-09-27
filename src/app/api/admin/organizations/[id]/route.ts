import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { canManageOrganizations } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { isOrganizationClosureConfirmed, organizationDeletionBlocker, planOrganizationReparenting } from '@/lib/org-context'

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const role = (session.user as any).role ?? 'ANALYSTE'
  if (!canManageOrganizations({ id: (session.user as any).id, role })) {
    return { error: NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 }) }
  }
  return { session }
}

// Logo personnalisé : data URL image, taille bornée (~64 Ko) pour éviter d'alourdir la base.
const schema = z.object({
  nom: z.string().min(1).max(120).optional(),
  logo: z.string().max(64_000).regex(/^data:image\//).nullable().optional(),
  parentId: z.string().min(1).max(40).nullable().optional(),
})

// PATCH /api/admin/organizations/:id — renommer, déplacer dans l'arbre, définir le logo
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  const { id } = await params

  let data: z.infer<typeof schema>
  try {
    data = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, parentId: true } })
  if (!org) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if (data.nom !== undefined) {
    const nom = data.nom.trim()
    if (!nom) return NextResponse.json({ error: 'Le nom de l’organisation est obligatoire' }, { status: 400 })
    patch.nom = nom
  }
  if (data.logo !== undefined) patch.logo = data.logo // null ⇒ retire le logo (auto-généré)
  let pathUpdates: Array<{ id: string; path: string }> = []
  if (data.parentId !== undefined) {
    const orgs = await prisma.organization.findMany({ select: { id: true, parentId: true, path: true } })
    const plan = planOrganizationReparenting(orgs, id, data.parentId)
    if (!plan.ok) {
      const errors = {
        PARENT_NOT_FOUND: 'Organisation parente introuvable',
        CYCLE: 'Une organisation ne peut pas être déplacée dans sa propre sous-hiérarchie',
        ORGANIZATION_NOT_FOUND: 'Organisation introuvable',
      }
      return NextResponse.json({ error: errors[plan.reason] }, { status: 400 })
    }
    patch.parentId = data.parentId
    pathUpdates = plan.pathUpdates
    patch.path = pathUpdates.find(update => update.id === id)!.path
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

  const updated = await prisma.$transaction(async tx => {
    const updatedOrg = await tx.organization.update({
      where: { id }, data: patch,
      select: { id: true, nom: true, slug: true, parentId: true, path: true, actif: true, logo: true },
    })
    await Promise.all(pathUpdates
      .filter(update => update.id !== id)
      .map(update => tx.organization.update({ where: { id: update.id }, data: { path: update.path } })))
    return updatedOrg
  })

  await auditLog('ORG_UPDATED', {
    userId: (auth.session!.user as any).id,
    targetId: id, targetType: 'organization',
    ip: getClientIp(req),
    details: { fields: Object.keys(patch), previousParentId: org.parentId },
  })
  return NextResponse.json({ organization: updated })
}

// DELETE /api/admin/organizations/:id — seulement une organisation réellement vide.
// Les configurations techniques éventuelles sont supprimées en cascade, jamais les données métier.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  const { id } = await params
  let closeWithData = false
  let confirmation = ''
  try {
    const body = await req.json()
    closeWithData = body?.mode === 'CLOSED'
    confirmation = typeof body?.confirmation === 'string' ? body.confirmation : ''
  } catch { /* Suppression d'une organisation vide : corps optionnel. */ }

  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true, nom: true,
      _count: {
        select: {
          enfants: true,
          membres: true,
          analyses: true,
          conformites: true,
          derogations: true,
          processus: true,
          riskItems: true,
          incidents: true,
          controles: true,
          campagnes: true,
          auditMissions: true,
          kris: true,
          arrangementsTic: true,
          campagnesControle: true,
          referentiels: true,
          documents: true,
          apiKeys: true,
          webhooks: true,
          traitements: true,
          traitementsConformite: true,
          plansAction: true,
        },
      },
    },
  })
  if (!org) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })

  const { enfants, membres, ...dataCounts } = org._count
  const blocker = organizationDeletionBlocker({
    children: enfants,
    memberships: membres,
    data: Object.values(dataCounts).reduce((total, count) => total + count, 0),
  })
  if (blocker === 'HAS_CHILDREN') {
    return NextResponse.json({ error: 'Impossible de supprimer une organisation qui possède des sous-organisations' }, { status: 409 })
  }
  if (blocker && !closeWithData) {
    const errors = {
      HAS_CHILDREN: 'Impossible de supprimer une organisation qui possède des sous-organisations',
      HAS_MEMBERS: 'Impossible de supprimer une organisation qui possède des membres',
      HAS_DATA: 'Impossible de supprimer une organisation qui contient des données métier',
    }
    return NextResponse.json({ error: errors[blocker] }, { status: 409 })
  }

  if (closeWithData && !isOrganizationClosureConfirmed(org.nom, confirmation)) {
    return NextResponse.json({ error: 'Saisissez exactement le nom de l’organisation pour confirmer sa fermeture' }, { status: 400 })
  }

  await prisma.$transaction(async tx => {
    // La relation Analyse → Organization est restrictive : les analyses (et leurs
    // risques/ateliers en cascade) sont supprimées explicitement après confirmation.
    if (closeWithData) await tx.analyse.deleteMany({ where: { organizationId: id } })
    await tx.organization.delete({ where: { id } })
  })
  await auditLog('ORG_DELETED', {
    userId: (auth.session!.user as any).id,
    targetId: id, targetType: 'organization',
    ip: getClientIp(req), details: { mode: closeWithData ? 'CLOSED' : 'EMPTY' },
  })
  return NextResponse.json({ deleted: true })
}
