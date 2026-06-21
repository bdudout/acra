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

// GET — membres d'une organisation
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  const { id } = await params

  const members = await prisma.orgMembership.findMany({
    where: { organizationId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, scope: true, user: { select: { id: true, name: true, email: true } } },
  })
  return NextResponse.json({ members })
}

const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN']),
  scope: z.enum(['NODE', 'SUBTREE']).default('NODE'),
})

// POST — ajouter (ou mettre à jour) une appartenance par e-mail
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  const { id } = await params

  let data: z.infer<typeof addSchema>
  try {
    data = addSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true } })
  if (!org) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })

  const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Aucun compte avec cet e-mail' }, { status: 404 })

  const membership = await prisma.orgMembership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: id } },
    create: { userId: user.id, organizationId: id, role: data.role, scope: data.scope },
    update: { role: data.role, scope: data.scope },
    select: { id: true, role: true, scope: true, user: { select: { id: true, name: true, email: true } } },
  })

  await auditLog('ORG_MEMBER_ADDED', {
    userId: (auth.session!.user as any).id,
    targetId: id, targetType: 'organization',
    ip: getClientIp(req),
    details: { memberEmail: data.email, role: data.role, scope: data.scope },
  })
  return NextResponse.json({ membership }, { status: 201 })
}

// DELETE — retirer une appartenance (?membershipId=...)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  const { id } = await params
  const membershipId = new URL(req.url).searchParams.get('membershipId')
  if (!membershipId) return NextResponse.json({ error: 'membershipId requis' }, { status: 400 })

  const m = await prisma.orgMembership.findFirst({ where: { id: membershipId, organizationId: id }, select: { id: true } })
  if (!m) return NextResponse.json({ error: 'Appartenance introuvable' }, { status: 404 })

  await prisma.orgMembership.delete({ where: { id: membershipId } })
  await auditLog('ORG_MEMBER_REMOVED', {
    userId: (auth.session!.user as any).id,
    targetId: id, targetType: 'organization',
    ip: getClientIp(req),
    details: { membershipId },
  })
  return NextResponse.json({ ok: true })
}
