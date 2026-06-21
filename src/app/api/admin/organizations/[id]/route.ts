import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { canManageOrganizations } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'

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
})

// PATCH /api/admin/organizations/:id — renommer / définir (ou retirer) le logo
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

  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true } })
  if (!org) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if (data.nom !== undefined) patch.nom = data.nom.trim()
  if (data.logo !== undefined) patch.logo = data.logo // null ⇒ retire le logo (auto-généré)
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

  const updated = await prisma.organization.update({
    where: { id }, data: patch,
    select: { id: true, nom: true, slug: true, parentId: true, path: true, actif: true, logo: true },
  })

  await auditLog('ORG_UPDATED', {
    userId: (auth.session!.user as any).id,
    targetId: id, targetType: 'organization',
    ip: getClientIp(req),
    details: { fields: Object.keys(patch) },
  })
  return NextResponse.json({ organization: updated })
}
